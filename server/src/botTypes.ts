import type { InputFrame, ItemState, Phase, Team, WeaponType } from '@cs/shared';

export interface BotSelfView {
  id: string;
  team: Team;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  grounded: boolean;
  hp: number;
  mag: number;
  reloading: boolean;
  weapon: WeaponType;
  alive: boolean;
}

export interface BotEnemyView {
  id: string;
  x: number;
  y: number;
  z: number;
  visible: boolean;
  distance: number;
}

export interface BotWorldView {
  enemies: BotEnemyView[];
  items: ItemState[];
  phase: Phase;
}

export type BotFrame = Omit<InputFrame, 'seq'>;
