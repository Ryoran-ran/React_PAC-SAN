import {
  DIRECTIONS, MAZE_COLUMNS, MAZE_ROWS, OPPOSITE, TUNNEL_ROW,
  type Direction,
} from '../config/constants';
import type { DirectionChoice } from './GhostAI';
import { GHOST_TIE_BREAK_ORDER } from './GhostAI';
import type { Ghost, GhostId, TilePoint } from '../entities/Ghost';
import { canGhostEnter } from '../map/tileRules';
import { tileFromPosition } from './Targeting';

const nodeCount = MAZE_COLUMNS * MAZE_ROWS;
const indexOf = (tile: TilePoint): number => tile.y * MAZE_COLUMNS + tile.x;
const pointOf = (index: number): TilePoint => ({
  x: index % MAZE_COLUMNS, y: Math.floor(index / MAZE_COLUMNS),
});

function nextTile(tile: TilePoint, direction: Direction): TilePoint | null {
  const vector = DIRECTIONS[direction];
  let x = tile.x + vector.x;
  const y = tile.y + vector.y;
  if (y === TUNNEL_ROW) x = (x + MAZE_COLUMNS) % MAZE_COLUMNS;
  if (x < 0 || x >= MAZE_COLUMNS || !canGhostEnter(x, y)) return null;
  return { x, y };
}

const neighbors: readonly (readonly number[])[] = Array.from({ length: nodeCount }, (_, index) => {
  const tile = pointOf(index);
  if (!canGhostEnter(tile.x, tile.y)) return [];
  return GHOST_TIE_BREAK_ORDER.flatMap((direction) => {
    const next = nextTile(tile, direction);
    return next ? [indexOf(next)] : [];
  });
});

function distancesFrom(origin: TilePoint): Int16Array {
  const distances = new Int16Array(nodeCount).fill(-1);
  if (!canGhostEnter(origin.x, origin.y)) return distances;
  const queue = new Int16Array(nodeCount);
  let read = 0;
  let write = 0;
  const start = indexOf(origin);
  distances[start] = 0;
  queue[write++] = start;
  while (read < write) {
    const current = queue[read++];
    for (const next of neighbors[current]) {
      if (distances[next] !== -1) continue;
      distances[next] = distances[current] + 1;
      queue[write++] = next;
    }
  }
  return distances;
}

/** Pursue along actual corridors, including the wrap tunnel. */
export function chooseNightmareDirection(
  tile: TilePoint, currentDirection: Direction, target: TilePoint,
): DirectionChoice {
  const available = GHOST_TIE_BREAK_ORDER.filter((direction) => nextTile(tile, direction));
  const forward = available.filter((direction) => direction !== OPPOSITE[currentDirection]);
  const candidates = forward.length ? forward : available;
  const distances = distancesFrom(target);
  let chosen = candidates[0] ?? OPPOSITE[currentDirection];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const direction of candidates) {
    const next = nextTile(tile, direction)!;
    const distance = distances[indexOf(next)];
    if (distance >= 0 && distance < bestDistance) {
      bestDistance = distance;
      chosen = direction;
    }
  }
  return {
    chosen,
    decision: { tile: { ...tile }, candidates: [...candidates], chosen },
  };
}

const interceptionRoles = ['pinky', 'inky', 'clyde'] as const;

/** Give the three interceptors separate exits around the player's route. */
export function planNightmareTargets(
  player: { readonly x: number; readonly y: number; readonly direction: Direction },
  ghosts: readonly Ghost[],
): Map<GhostId, TilePoint> {
  const playerTile = tileFromPosition(player);
  const targets = new Map<GhostId, TilePoint>([['blinky', playerTile]]);
  const playerDistances = distancesFrom(playerTile);
  const forward = DIRECTIONS[player.direction];
  const left = { x: forward.y, y: -forward.x };
  const desired: Record<'pinky' | 'inky' | 'clyde', TilePoint> = {
    pinky: { x: playerTile.x + forward.x * 6, y: playerTile.y + forward.y * 6 },
    inky: { x: playerTile.x + forward.x * 3 + left.x * 5,
      y: playerTile.y + forward.y * 3 + left.y * 5 },
    clyde: { x: playerTile.x - forward.x * 2 - left.x * 4,
      y: playerTile.y - forward.y * 2 - left.y * 4 },
  };
  const covered: TilePoint[] = [];

  for (const id of interceptionRoles) {
    const ghost = ghosts.find((candidate) => candidate.id === id);
    if (!ghost || ghost.houseState !== 'OUTSIDE' || ghost.state !== 'NORMAL') continue;
    const ghostDistances = distancesFrom(tileFromPosition(ghost));
    let best: TilePoint = playerTile;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let index = 0; index < nodeCount; index++) {
      const playerDistance = playerDistances[index];
      const ghostDistance = ghostDistances[index];
      if (playerDistance < 3 || playerDistance > 8 || ghostDistance < 0) continue;
      // Intersections and corridor ends are useful places to close an exit.
      if (neighbors[index].length < 3 && playerDistance < 5) continue;
      const tile = pointOf(index);
      const xDistance = Math.min(Math.abs(tile.x - desired[id].x),
        Math.abs(tile.x - desired[id].x + MAZE_COLUMNS),
        Math.abs(tile.x - desired[id].x - MAZE_COLUMNS));
      const geometry = xDistance + Math.abs(tile.y - desired[id].y);
      const lateArrival = Math.max(0, ghostDistance - playerDistance - 2);
      const separation = covered.reduce((penalty, target) => {
        const distance = Math.abs(tile.x - target.x) + Math.abs(tile.y - target.y);
        return penalty + (distance < 3 ? 18 : distance < 5 ? 5 : 0);
      }, 0);
      const score = geometry * 3 + ghostDistance * 0.8 + lateArrival * 3
        + Math.abs(playerDistance - 5) + separation;
      if (score < bestScore) {
        bestScore = score;
        best = tile;
      }
    }
    targets.set(id, best);
    covered.push(best);
  }
  return targets;
}
