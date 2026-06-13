// Resolves the game server port the same way the server does:
// GAME_PORT env var, then the repo-root .env, then 3001.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function gamePort() {
  if (process.env.GAME_PORT) return Number(process.env.GAME_PORT);
  try {
    const envFile = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env'), 'utf8');
    const m = envFile.match(/^\s*GAME_PORT\s*=\s*(\d+)/m);
    if (m) return Number(m[1]);
  } catch {
    // no .env — fall through
  }
  return 3001;
}
