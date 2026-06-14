export const BOT_NAMES: ReadonlyArray<string> = [
  'Cliffe',
  'Hank',
  'Vitaliy',
  'Goose',
  'Minh',
  'Brett',
  'Kurt',
  'Crusher',
  'Ringo',
  'Quinn',
  'Wolf',
  'Zim',
];

export const TURN_RATE = 7; // rad/s max yaw/pitch slew
export const PITCH_LIMIT = 1.45;
export const FIRE_ANGLE = 0.05; // rad: only shoot when roughly on target
export const FIRE_RANGE = 60;
export const ERR_START = 0.06; // rad of aim error on target acquisition
export const ERR_TAU = 0.6; // exponential decay time constant
export const RESIGHT_GRACE = 0.6; // s out of sight before reaction timer restarts
export const REPATH_INTERVAL = 1.5;
export const WAYPOINT_RADIUS = 0.7;
export const STUCK_WINDOW = 0.7;
export const STUCK_DIST = 0.35;
export const ITEM_NOTICE_RANGE = 6;
export const ITEM_USE_RANGE = 1.0;
