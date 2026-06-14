import * as THREE from 'three';
import { ARENA_HALF_Z } from '@cs/shared';

import { makeBuildingBlock } from './gfx/buildingBlock.js';
import { makeDome } from './gfx/dome.js';
import { makeDoorway } from './gfx/doorway.js';
import { makePalm } from './gfx/palm.js';

export function addDoorways(scene: THREE.Scene): void {
  for (const sign of [-1, 1] as const) {
    const door = makeDoorway();
    door.position.set(0, 1, sign * ARENA_HALF_Z);
    if (sign > 0) door.rotation.y = Math.PI;
    scene.add(door);
  }
}

export function addSkyline(scene: THREE.Scene): void {
  const dome = makeDome();
  dome.position.set(-24, 0, -8);
  scene.add(dome);

  const blocks: Array<[number, number, number, number, number]> = [
    [10, 7, 6, 7, -30.5],
    [8, 6.6, 5, -9, -29.5],
    [7, 7.6, 9, 23.5, 3],
    [6, 8.4, 8, 24.5, -15],
    [12, 6.8, 6, -6, 30.5],
  ];
  for (const [w, h, d, x, z] of blocks) {
    const block = makeBuildingBlock(w, h, d);
    block.position.set(x, 0, z);
    scene.add(block);
  }

  const palms: Array<[number, number, number, number]> = [
    [-21, -3.5, 1.55, 0.4],
    [-26.5, -13, 1.35, 2.1],
    [-20.5, 13, 1.3, 4.4],
    [-13, -28, 1.5, 1.2],
    [12.5, -27.5, 1.6, 5.3],
    [20.5, -6, 1.3, 3.0],
    [21.5, 17, 1.45, 0.9],
    [9, 28.5, 1.4, 2.6],
  ];
  for (const [x, z, scale, rot] of palms) {
    const palm = makePalm(scale);
    palm.position.set(x, 0, z);
    palm.rotation.y = rot;
    scene.add(palm);
  }
}
