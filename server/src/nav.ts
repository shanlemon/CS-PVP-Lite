// Navigation grid + A* pathfinding for server-side bots.
// Builds a 1m-cell walkability grid from the shared SOLIDS list. Crates and
// walls (expanded by the player half-width) block cells; platforms and steps
// stay walkable because the movement code steps up onto them.

import { ARENA_HALF_X, ARENA_HALF_Z, PLAYER_HALF_WIDTH, SOLIDS, STEP_HEIGHT } from '@cs/shared';
import { mulberry32 } from './random.js';

export interface NavPoint { x: number; z: number }

const CELL = 1; // meters per cell
const SMOOTH_SAMPLE = 0.4; // meters between line-of-walk samples
const SNAP_RADIUS = 2; // cells to search when snapping a blocked endpoint

export class NavGrid {
  private readonly width: number;
  private readonly depth: number;
  private readonly walkable: Uint8Array; // 1 = walkable
  private readonly rng = mulberry32(0xc5c5c5);

  constructor() {
    this.width = Math.round((ARENA_HALF_X * 2) / CELL);
    this.depth = Math.round((ARENA_HALF_Z * 2) / CELL);
    this.walkable = new Uint8Array(this.width * this.depth);
    this.build();
  }

  private build(): void {
    const pad = PLAYER_HALF_WIDTH;
    for (let cz = 0; cz < this.depth; cz++) {
      for (let cx = 0; cx < this.width; cx++) {
        const minX = -ARENA_HALF_X + cx * CELL;
        const minZ = -ARENA_HALF_Z + cz * CELL;
        const maxX = minX + CELL;
        const maxZ = minZ + CELL;
        let blocked = false;
        for (const s of SOLIDS) {
          if (s.kind === 'platform' || s.kind === 'step') continue;
          const b = s.box;
          // Only solids that obstruct a standing player (too tall to step onto).
          if (!(b.min.y < 1.5 && b.max.y > STEP_HEIGHT)) continue;
          if (
            b.min.x - pad < maxX &&
            b.max.x + pad > minX &&
            b.min.z - pad < maxZ &&
            b.max.z + pad > minZ
          ) {
            blocked = true;
            break;
          }
        }
        if (!blocked) this.walkable[cz * this.width + cx] = 1;
      }
    }
  }

  private cellX(x: number): number {
    return Math.floor((x + ARENA_HALF_X) / CELL);
  }

  private cellZ(z: number): number {
    return Math.floor((z + ARENA_HALF_Z) / CELL);
  }

  private inBounds(cx: number, cz: number): boolean {
    return cx >= 0 && cx < this.width && cz >= 0 && cz < this.depth;
  }

  private cellWalkable(cx: number, cz: number): boolean {
    return this.inBounds(cx, cz) && this.walkable[cz * this.width + cx] === 1;
  }

  private center(cx: number, cz: number): NavPoint {
    return { x: -ARENA_HALF_X + (cx + 0.5) * CELL, z: -ARENA_HALF_Z + (cz + 0.5) * CELL };
  }

  isWalkable(x: number, z: number): boolean {
    return this.cellWalkable(this.cellX(x), this.cellZ(z));
  }

  /** Nearest walkable cell within SNAP_RADIUS cells of (cx, cz), or null. */
  private snap(cx: number, cz: number): { cx: number; cz: number } | null {
    if (this.cellWalkable(cx, cz)) return { cx, cz };
    let best: { cx: number; cz: number } | null = null;
    let bestD = Infinity;
    for (let dz = -SNAP_RADIUS; dz <= SNAP_RADIUS; dz++) {
      for (let dx = -SNAP_RADIUS; dx <= SNAP_RADIUS; dx++) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (!this.cellWalkable(nx, nz)) continue;
        const d = dx * dx + dz * dz;
        if (d < bestD) {
          bestD = d;
          best = { cx: nx, cz: nz };
        }
      }
    }
    return best;
  }

  findPath(fromX: number, fromZ: number, toX: number, toZ: number): NavPoint[] {
    const scx = this.cellX(fromX);
    const scz = this.cellZ(fromZ);
    const ecx = this.cellX(toX);
    const ecz = this.cellZ(toZ);
    if (!this.inBounds(scx, scz) || !this.inBounds(ecx, ecz)) return [];
    const start = this.snap(scx, scz);
    const goal = this.snap(ecx, ecz);
    if (!start || !goal) return [];

    const w = this.width;
    const n = w * this.depth;
    const startIdx = start.cz * w + start.cx;
    const goalIdx = goal.cz * w + goal.cx;
    if (startIdx === goalIdx) return [this.center(goal.cx, goal.cz)];

    const gScore = new Float64Array(n).fill(Infinity);
    const cameFrom = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    gScore[startIdx] = 0;

    // Binary min-heap of [fScore, idx] pairs stored flat.
    const heap: number[] = [];
    const heapPush = (f: number, idx: number): void => {
      heap.push(f, idx);
      let i = heap.length / 2 - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p * 2] <= heap[i * 2]) break;
        const tf = heap[p * 2];
        const ti = heap[p * 2 + 1];
        heap[p * 2] = heap[i * 2];
        heap[p * 2 + 1] = heap[i * 2 + 1];
        heap[i * 2] = tf;
        heap[i * 2 + 1] = ti;
        i = p;
      }
    };
    const heapPop = (): number => {
      const top = heap[1];
      const lastIdx = heap.pop() as number;
      const lastF = heap.pop() as number;
      if (heap.length > 0) {
        heap[0] = lastF;
        heap[1] = lastIdx;
        let i = 0;
        const size = heap.length / 2;
        for (;;) {
          const l = i * 2 + 1;
          const r = l + 1;
          let m = i;
          if (l < size && heap[l * 2] < heap[m * 2]) m = l;
          if (r < size && heap[r * 2] < heap[m * 2]) m = r;
          if (m === i) break;
          const tf = heap[m * 2];
          const ti = heap[m * 2 + 1];
          heap[m * 2] = heap[i * 2];
          heap[m * 2 + 1] = heap[i * 2 + 1];
          heap[i * 2] = tf;
          heap[i * 2 + 1] = ti;
          i = m;
        }
      }
      return top;
    };

    const hCost = (idx: number): number => {
      const cx = idx % w;
      const cz = Math.floor(idx / w);
      return Math.hypot(cx - goal.cx, cz - goal.cz);
    };

    heapPush(hCost(startIdx), startIdx);
    const SQRT2 = Math.SQRT2;
    let found = false;

    while (heap.length > 0) {
      const cur = heapPop();
      if (cur === goalIdx) {
        found = true;
        break;
      }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % w;
      const cz = Math.floor(cur / w);

      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dz === 0) continue;
          const nx = cx + dx;
          const nz = cz + dz;
          if (!this.cellWalkable(nx, nz)) continue;
          // Diagonals only when both adjacent cardinals are free (no corner clipping).
          if (dx !== 0 && dz !== 0) {
            if (!this.cellWalkable(cx + dx, cz) || !this.cellWalkable(cx, cz + dz)) continue;
          }
          const nIdx = nz * w + nx;
          if (closed[nIdx]) continue;
          const cost = dx !== 0 && dz !== 0 ? SQRT2 : 1;
          const g = gScore[cur] + cost;
          if (g < gScore[nIdx]) {
            gScore[nIdx] = g;
            cameFrom[nIdx] = cur;
            heapPush(g + hCost(nIdx), nIdx);
          }
        }
      }
    }

    if (!found) return [];

    // Reconstruct cell-center path.
    const cells: number[] = [];
    for (let idx = goalIdx; idx !== -1; idx = cameFrom[idx]) cells.push(idx);
    cells.reverse();
    const raw: NavPoint[] = cells.map((idx) => this.center(idx % w, Math.floor(idx / w)));

    return this.smooth(raw);
  }

  /** Greedy string-pull: skip waypoints while the straight segment stays walkable. */
  private smooth(path: NavPoint[]): NavPoint[] {
    if (path.length <= 2) return path;
    const out: NavPoint[] = [path[0]];
    let i = 0;
    while (i < path.length - 1) {
      let j = path.length - 1;
      while (j > i + 1 && !this.segmentClear(path[i], path[j])) j--;
      out.push(path[j]);
      i = j;
    }
    return out;
  }

  private segmentClear(a: NavPoint, b: NavPoint): boolean {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(len / SMOOTH_SAMPLE));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      if (!this.isWalkable(a.x + dx * t, a.z + dz * t)) return false;
    }
    return true;
  }

  randomWalkable(): NavPoint {
    for (;;) {
      const cx = Math.floor(this.rng() * this.width);
      const cz = Math.floor(this.rng() * this.depth);
      if (this.cellWalkable(cx, cz)) return this.center(cx, cz);
    }
  }
}
