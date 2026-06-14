import WebSocket from 'ws';

import { gamePort } from './port.mjs';

export const WS_URL = `ws://localhost:${gamePort()}/ws`;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

export function roomName(prefix) {
  return `${prefix}-${Date.now()}`;
}

export async function until(desc, cond, timeoutMs = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (cond()) return;
    await sleep(50);
  }
  fail(`timeout: ${desc}`);
}

export class TestClient {
  constructor(name, room, opts = {}) {
    this.name = name;
    this.roomName = room;
    this.id = null;
    this.room = null;
    this.you = null;
    this.players = [];
    this.events = [];
    this.seq = 0;
    this.waiters = [];
    this.onEvent = opts.onEvent ?? null;
    this.verbose = opts.verbose ?? false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      this.ws.on('open', () => {
        this.send({ t: 'hello', name: this.name, avatarUrl: null, instanceId: this.roomName });
        resolve();
      });
      this.ws.on('error', reject);
      this.ws.on('message', (raw) => this.handleMessage(raw));
    });
  }

  handleMessage(raw) {
    const msg = JSON.parse(raw.toString());
    if (msg.t === 'welcome') {
      this.id = msg.id;
      this.room = msg.room;
    } else if (msg.t === 'room') {
      this.room = msg.room;
    } else if (msg.t === 'snap') {
      this.you = msg.you;
      this.players = msg.players;
    } else {
      this.events.push(msg);
      this.onEvent?.(msg, this);
      if (this.verbose) console.log(`  [${this.name}]`, JSON.stringify(msg));
    }
    this.waiters = this.waiters.filter((w) => !w(msg));
  }

  send(msg) {
    this.ws.send(JSON.stringify(msg));
  }

  join(team) {
    this.send({ t: 'team', team });
  }

  start() {
    this.send({ t: 'start' });
  }

  addBot(team) {
    this.send({ t: 'addBot', team });
  }

  removeBot(id) {
    this.send({ t: 'removeBot', id });
  }

  wait(desc, pred, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${desc}`)), timeoutMs);
      this.waiters.push((msg) => {
        if (pred(msg)) {
          clearTimeout(timer);
          resolve(msg);
          return true;
        }
        return false;
      });
    });
  }

  input(frame = {}) {
    this.send({
      t: 'inputs',
      inputs: [
        {
          seq: ++this.seq,
          dt: 0.033,
          mx: 0,
          mz: 0,
          jump: false,
          yaw: 0,
          pitch: 0,
          fire: false,
          reload: false,
          use: false,
          zoom: false,
          ...frame,
        },
      ],
    });
  }

  close() {
    this.ws?.close();
  }
}
