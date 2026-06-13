import { defineConfig, loadEnv } from 'vite';

// envDir '..' lets the client read VITE_DISCORD_CLIENT_ID from the repo-root .env.
// The proxy mirrors what Discord's activity proxy does in production: the page
// only ever talks to its own origin; /api and /ws are forwarded to the game server.
export default defineConfig(({ mode }) => {
  // The game server port comes from GAME_PORT (env var or repo-root .env).
  const env = loadEnv(mode, '..', '');
  const gamePort = process.env.GAME_PORT ?? env.GAME_PORT ?? '3001';
  const gameServer = `http://localhost:${gamePort}`;
  return {
    envDir: '..',
    server: {
      // Tooling (e.g. preview harnesses) can assign a port via PORT; the game
      // server is unaffected — it listens on GAME_PORT.
      port: Number(process.env.PORT ?? 5173),
      // Required when exposing the dev server through a cloudflared tunnel for
      // Discord activity testing.
      allowedHosts: true,
      proxy: {
        '/api': gameServer,
        '/ws': { target: gameServer, ws: true },
      },
    },
    build: {
      target: 'es2022',
      sourcemap: false,
    },
  };
});
