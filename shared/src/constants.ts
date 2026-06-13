// Gameplay tuning shared by server (authority) and client (prediction).

export const TICK_RATE = 30; // server simulation + snapshot rate (Hz)
export const INPUT_SEND_INTERVAL = 0.05; // client batches inputs every 50ms
export const INTERP_DELAY = 0.1; // remote players rendered 100ms in the past

// Movement (CS-ish feel, meters/seconds)
export const MOVE_SPEED = 6.8;
export const ACCEL_GROUND = 60;
export const ACCEL_AIR = 14;
export const GRAVITY = 22;
export const JUMP_VELOCITY = 7.4;
export const STEP_HEIGHT = 0.55;
export const MAX_INPUT_DT = 0.05; // clamp per-input dt to prevent speedup

// Player capsule (approximated as an AABB)
export const PLAYER_HALF_WIDTH = 0.3;
export const PLAYER_HEIGHT = 1.8;
export const EYE_HEIGHT = 1.62;
export const HEAD_RADIUS = 0.24;

// Combat
export const MAX_HP = 100;
export const MAG_SIZE = 30;
export const RELOAD_TIME = 2.5;
export const FIRE_INTERVAL = 0.1; // 600 RPM
export const DMG_BODY = 30;
export const DMG_HEAD = 100;
export const BASE_SPREAD = 0.002; // radians
export const MOVE_SPREAD = 0.025; // extra at full speed
export const RECOIL_SPREAD = 0.012; // extra per recoil unit
export const RECOIL_MAX = 8;
export const RECOIL_DECAY = 7; // units/second
export const SHOT_RANGE = 200;

// Rounds
export const ROUNDS_TO_WIN = 8;
export const COUNTDOWN_TIME = 3; // freeze before a round goes live
export const ROUND_END_TIME = 4.5; // intermission after a team is wiped
export const TEAM_SIZE = 2;
