import type { ClientMsg, ServerMsg } from '@cs/shared';

type Handler = (msg: ServerMsg) => void;

const RETRY_DELAY_MS = 2500;
const PING_INTERVAL_MS = 20000;

/**
 * WebSocket wrapper with auto-reconnect. If the connection drops (mobile
 * sleep, tunnel hiccup, server restart) it keeps retrying with the same
 * hello; the server treats the rejoin as a fresh player and the 'welcome'
 * message rebuilds client state. A periodic empty-inputs ping keeps idle
 * lobby connections alive through proxies that kill quiet sockets.
 */
export class Net {
  private ws: WebSocket | null = null;
  private handlers: Handler[] = [];
  private url = '';
  private hello: ClientMsg | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private everConnected = false;
  /** Fired when the connection is lost (a reconnect attempt follows). */
  onDisconnect: (() => void) | null = null;

  connect(url: string, hello: ClientMsg): Promise<void> {
    this.url = url;
    this.hello = hello;
    return new Promise((resolve, reject) => {
      this.open(resolve, reject);
    });
  }

  private open(resolve?: () => void, reject?: (err: Error) => void): void {
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      if (this.hello) ws.send(JSON.stringify(this.hello));
      this.everConnected = true;
      this.startPing();
      resolve?.();
    };
    ws.onerror = () => {
      // Initial connection failure: surface it to boot(). Later errors are
      // followed by onclose, which handles the retry.
      if (!this.everConnected) reject?.(new Error('WebSocket connection failed'));
    };
    ws.onclose = () => {
      this.stopPing();
      if (!this.everConnected) return; // initial failure already rejected
      this.onDisconnect?.();
      setTimeout(() => {
        // Don't stack sockets if something else already reopened one.
        if (this.ws === ws || this.ws === null || this.ws.readyState === WebSocket.CLOSED) {
          this.open();
        }
      }, RETRY_DELAY_MS);
    };
    ws.onmessage = (ev) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      for (const h of this.handlers) {
        try {
          h(msg);
        } catch (err) {
          console.error('message handler error', err);
        }
      }
    };
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.send({ t: 'inputs', inputs: [] });
    }, PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  onMessage(h: Handler): void {
    this.handlers.push(h);
  }

  send(msg: ClientMsg): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
