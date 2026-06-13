export interface Identity {
  name: string;
  avatarUrl: string | null;
  instanceId: string;
  embedded: boolean;
}

/**
 * When running inside Discord's activity iframe, do the Embedded App SDK
 * handshake + OAuth. Outside Discord (local dev in a plain browser) we fall
 * back to a guest identity — the game is fully playable without Discord.
 */
export async function resolveIdentity(): Promise<Identity> {
  const params = new URLSearchParams(location.search);
  const embedded = params.has('frame_id');

  if (!embedded) {
    const n = Math.floor(Math.random() * 900 + 100);
    return {
      name: localStorage.getItem('devName') ?? `Guest${n}`,
      avatarUrl: null,
      instanceId: params.get('room') ?? 'dev',
      embedded: false,
    };
  }

  const { DiscordSDK } = await import('@discord/embedded-app-sdk');
  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID as string;
  const sdk = new DiscordSDK(clientId);
  await sdk.ready();

  const { code } = await sdk.commands.authorize({
    client_id: clientId,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify'],
  });

  // All client traffic must go through Discord's proxy (/.proxy/ prefix).
  const resp = await fetch('/.proxy/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!resp.ok) throw new Error('Token exchange failed');
  const { access_token } = (await resp.json()) as { access_token: string };

  const auth = await sdk.commands.authenticate({ access_token });
  const user = auth.user;
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
    : null;

  return {
    name: (user as { global_name?: string | null }).global_name ?? user.username,
    avatarUrl,
    instanceId: sdk.instanceId,
    embedded: true,
  };
}

/** WebSocket URL respecting the Discord proxy when embedded. */
export function gameSocketUrl(embedded: boolean): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const prefix = embedded ? '/.proxy' : '';
  return `${proto}//${location.host}${prefix}/ws`;
}
