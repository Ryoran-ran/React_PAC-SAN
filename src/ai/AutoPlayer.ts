import { DIRECTIONS, MAZE_COLUMNS, MAZE_ROWS, TILE_SIZE, TUNNEL_ROW, type Direction } from '../config/constants';
import type { Ghost, TilePoint } from '../entities/Ghost';
import type { PacSan } from '../entities/PacSan';
import { tileIndex, type Maze } from '../map/maze';
import { canPlayerEnter } from '../map/tileRules';

export type AutoPlayLevel = 'beginner' | 'standard' | 'expert' | 'tas';

interface Policy {
  readonly dangerRadius: number;
  readonly dangerWeight: number;
  readonly projectionTiles: number;
  readonly clusterBonus: number;
}

/** The higher levels use more of the visible ghost state, not hidden randomness. */
const POLICIES: Record<AutoPlayLevel, Policy> = {
  beginner: { dangerRadius: 1, dangerWeight: 2, projectionTiles: 0, clusterBonus: 0 },
  standard: { dangerRadius: 2, dangerWeight: 3, projectionTiles: 1, clusterBonus: 0 },
  expert: { dangerRadius: 3, dangerWeight: 4, projectionTiles: 2, clusterBonus: 0.12 },
  tas: { dangerRadius: 4, dangerWeight: 5, projectionTiles: 4, clusterBonus: 0.25 },
};

const DIRECTIONS_IN_ORDER: readonly Direction[] = ['up', 'left', 'down', 'right'];
const TILE_COUNT = MAZE_COLUMNS * MAZE_ROWS;

interface Neighbor {
  readonly index: number;
  readonly direction: Direction;
}

function neighbors(index: number): Neighbor[] {
  const x = index % MAZE_COLUMNS;
  const y = Math.floor(index / MAZE_COLUMNS);
  const result: Neighbor[] = [];
  for (const direction of DIRECTIONS_IN_ORDER) {
    const vector = DIRECTIONS[direction];
    let nx = x + vector.x;
    const ny = y + vector.y;
    if (y === TUNNEL_ROW && (nx < 0 || nx >= MAZE_COLUMNS)) {
      nx = (nx + MAZE_COLUMNS) % MAZE_COLUMNS;
    }
    if (canPlayerEnter(nx, ny)) result.push({ index: tileIndex(nx, ny), direction });
  }
  return result;
}

function tileOf(entity: { readonly x: number; readonly y: number }): TilePoint {
  return { x: Math.floor(entity.x / TILE_SIZE), y: Math.floor(entity.y / TILE_SIZE) };
}

function graphDistances(origin: number): number[] {
  const distances = Array<number>(TILE_COUNT).fill(Number.POSITIVE_INFINITY);
  if (origin < 0 || origin >= TILE_COUNT) return distances;
  distances[origin] = 0;
  const queue = [origin];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    for (const neighbor of neighbors(current)) {
      if (distances[neighbor.index] !== Number.POSITIVE_INFINITY) continue;
      distances[neighbor.index] = distances[current] + 1;
      queue.push(neighbor.index);
    }
  }
  return distances;
}

function threatCosts(ghosts: readonly Ghost[], policy: Policy): number[] {
  const costs = Array<number>(TILE_COUNT).fill(0);
  for (const ghost of ghosts) {
    if (ghost.houseState === 'PACING_HOME' || ghost.state !== 'NORMAL') continue;
    const tile = tileOf(ghost);
    let projected = { ...tile };
    for (let step = 0; step <= policy.projectionTiles; step++) {
      if (canPlayerEnter(projected.x, projected.y)) {
        const distances = graphDistances(tileIndex(projected.x, projected.y));
        const projectionFactor = step === 0 ? 1 : 0.6 / step;
        const houseFactor = ghost.houseState === 'OUTSIDE' ? 1 : 0.5;
        for (let index = 0; index < TILE_COUNT; index++) {
          const distance = distances[index];
          if (distance > policy.dangerRadius) continue;
          costs[index] += (policy.dangerRadius + 1 - distance) ** 2
            * policy.dangerWeight * projectionFactor * houseFactor;
        }
      }
      const vector = DIRECTIONS[ghost.direction];
      let nextX = projected.x + vector.x;
      if (projected.y === TUNNEL_ROW && (nextX < 0 || nextX >= MAZE_COLUMNS)) {
        nextX = (nextX + MAZE_COLUMNS) % MAZE_COLUMNS;
      }
      const nextY = projected.y + vector.y;
      if (!canPlayerEnter(nextX, nextY)) break;
      projected = { x: nextX, y: nextY };
    }
  }
  return costs;
}

function nearbyDotCount(index: number, dots: ReadonlyMap<number, unknown>): number {
  let count = 0;
  for (const neighbor of neighbors(index)) {
    if (dots.has(neighbor.index)) count++;
    for (const next of neighbors(neighbor.index)) {
      if (dots.has(next.index)) count++;
    }
  }
  return count;
}

export interface AutoPlayDecision {
  readonly direction: Direction;
  readonly target: TilePoint;
}

/** Finds a low-cost route to a dot, with deterministic tie breaks at every level. */
export function chooseAutoDirection(
  player: PacSan,
  ghosts: readonly Ghost[],
  maze: Maze,
  level: AutoPlayLevel,
): AutoPlayDecision | null {
  const playerTile = tileOf(player);
  const start = tileIndex(playerTile.x, playerTile.y);
  if (!canPlayerEnter(playerTile.x, playerTile.y) || maze.remainingDots === 0) return null;

  const policy = POLICIES[level];
  const threat = threatCosts(ghosts, policy);
  const costs = Array<number>(TILE_COUNT).fill(Number.POSITIVE_INFINITY);
  const firstDirections = Array<Direction | null>(TILE_COUNT).fill(null);
  const visited = Array<boolean>(TILE_COUNT).fill(false);
  costs[start] = 0;

  // The maze has fewer than 250 walkable tiles, so a simple fixed-size
  // Dijkstra scan keeps the route and its tie order fully reproducible.
  for (let count = 0; count < TILE_COUNT; count++) {
    let current = -1;
    for (let index = 0; index < TILE_COUNT; index++) {
      if (!visited[index] && costs[index] < Number.POSITIVE_INFINITY
          && (current < 0 || costs[index] < costs[current])) current = index;
    }
    if (current < 0) break;
    visited[current] = true;
    for (const neighbor of neighbors(current)) {
      const nextCost = costs[current] + 1 + threat[neighbor.index];
      if (nextCost >= costs[neighbor.index]) continue;
      costs[neighbor.index] = nextCost;
      firstDirections[neighbor.index] = firstDirections[current] ?? neighbor.direction;
    }
  }

  let bestIndex = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const index of maze.dots.keys()) {
    if (index === start || !firstDirections[index]) continue;
    const score = costs[index] - policy.clusterBonus * nearbyDotCount(index, maze.dots);
    if (score < bestScore || (score === bestScore && index < bestIndex)) {
      bestIndex = index;
      bestScore = score;
    }
  }
  if (bestIndex < 0) return null;
  return {
    direction: firstDirections[bestIndex]!,
    target: { x: bestIndex % MAZE_COLUMNS, y: Math.floor(bestIndex / MAZE_COLUMNS) },
  };
}
