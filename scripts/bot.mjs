// Simple bot for manual testing: joins the 'dev' room on team CT, streams idle
// inputs, and slowly looks around. Usage: node scripts/bot.mjs [name] [team]
import WebSocket from 'ws';
import { WS_URL } from './ws-test-client.mjs';

const name = process.argv[2] ?? 'Bot';
const team = process.argv[3] ?? 'CT';
const ws = new WebSocket(WS_URL);
let seq = 0;
let yaw = team === 'CT' ? Math.PI : 0;

ws.on('open', () => {
  ws.send(JSON.stringify({ t: 'hello', name, avatarUrl: null, instanceId: 'dev' }));
  ws.send(JSON.stringify({ t: 'team', team }));
  console.log(`${name} joined team ${team} in room 'dev'`);
  setInterval(() => {
    yaw += 0.01;
    ws.send(
      JSON.stringify({
        t: 'inputs',
        inputs: [
          { seq: ++seq, dt: 0.05, mx: 0, mz: 0, jump: false, yaw, pitch: 0, fire: false, reload: false },
        ],
      }),
    );
  }, 50);
});
ws.on('close', () => process.exit(0));
setTimeout(() => process.exit(0), 180000);
