import {
  DIRECTIONS, MAZE_COLUMNS, MAZE_ROWS, NORMAL_DOT_FREEZE_FRAMES, OPPOSITE,
  POWER_DOT_FREEZE_FRAMES, TILE_SIZE, TUNNEL_ROW, type Direction,
} from '../config/constants';
import { getLevelConfig } from '../config/levelTables';
import type { Ghost, TilePoint } from '../entities/Ghost';
import type { PacSan } from '../entities/PacSan';
import { tileIndex, type Maze } from '../map/maze';
import { canPlayerEnter } from '../map/tileRules';
import { moveGhost } from '../systems/MovementSystem';
import { FRUIT_POSITION } from '../systems/FruitSystem';

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

export interface TasContext {
  readonly round: number;
  readonly frightenedFramesRemaining: number;
  readonly fruit?: { readonly visible: boolean; readonly framesRemaining: number; readonly points: number };
  readonly elroyStage?: 0 | 1 | 2;
  readonly committedTarget?: TilePoint | null;
}

interface ForecastGhost {
  readonly index: number;
  readonly dangerous: boolean;
}

interface TasRoute {
  readonly index: number;
  readonly time: number;
  readonly score: number;
  readonly firstDirection: Direction;
  readonly target: number;
  readonly visited: ReadonlySet<number>;
  readonly poweredUntil: number;
}

const TAS_HORIZON_TILES = 9;
const TAS_BEAM_WIDTH = 14;

function ghostForecast(ghosts: readonly Ghost[], context: TasContext,
  frames: number): ForecastGhost[][] {
  const config = getLevelConfig(context.round);
  const copies = ghosts.map((ghost) => Object.assign(Object.create(Object.getPrototypeOf(ghost)) as Ghost, ghost));
  const result: ForecastGhost[][] = [];
  for (let frame = 0; frame <= frames; frame++) {
    result.push(copies.map((ghost) => ({
      index: tileIndex(Math.floor(ghost.x / TILE_SIZE), Math.floor(ghost.y / TILE_SIZE)),
      dangerous: ghost.houseState === 'OUTSIDE' && ghost.state !== 'EATEN'
        && (ghost.state === 'NORMAL' || frame >= context.frightenedFramesRemaining),
    })));
    if (frame === frames) break;
    for (const ghost of copies) {
      if (ghost.houseState !== 'OUTSIDE' || ghost.state === 'EATEN') continue;
      if (ghost.state === 'FRIGHTENED' && frame + 1 >= context.frightenedFramesRemaining) {
        ghost.state = 'NORMAL';
      }
      const ghostTile = tileOf(ghost);
      const inTunnel = ghostTile.y === TUNNEL_ROW && (ghostTile.x < 6 || ghostTile.x > 21);
      const speed = ghost.state === 'FRIGHTENED' ? config.frightenedGhostSpeedPercent
        : inTunnel ? config.ghostTunnelSpeedPercent
          : ghost.id === 'blinky' && context.elroyStage
            ? config.elroySpeedPercent[context.elroyStage - 1] : config.ghostSpeedPercent;
      // The visible target remains a useful short-term forecast. Replan at
      // the next center rather than assuming this path indefinitely.
      moveGhost(ghost, speed);
    }
  }
  return result;
}

function nearestDotDistances(maze: Maze): number[] {
  const distances = Array<number>(TILE_COUNT).fill(Number.POSITIVE_INFINITY);
  const queue = [...maze.dots.keys()];
  for (const index of queue) distances[index] = 0;
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    for (const neighbor of neighbors(current)) {
      if (distances[neighbor.index] <= distances[current] + 1) continue;
      distances[neighbor.index] = distances[current] + 1;
      queue.push(neighbor.index);
    }
  }
  return distances;
}

function projectedRisk(from: number, to: number, startTime: number, moveFrames: number,
  forecast: readonly ForecastGhost[][], poweredUntil: number): number {
  const fromX = from % MAZE_COLUMNS;
  const fromY = Math.floor(from / MAZE_COLUMNS);
  const toX = to % MAZE_COLUMNS;
  const toY = Math.floor(to / MAZE_COLUMNS);
  const dx = fromX === MAZE_COLUMNS - 1 && toX === 0 ? 1
    : fromX === 0 && toX === MAZE_COLUMNS - 1 ? -1 : toX - fromX;
  const dy = toY - fromY;
  let risk = 0;
  for (let step = 1; step <= moveFrames; step++) {
    const time = Math.min(startTime + step, forecast.length - 1);
    if (time < poweredUntil) continue;
    const progress = Math.min(1, step / moveFrames);
    const x = (fromX + 0.5 + dx * progress + MAZE_COLUMNS) % MAZE_COLUMNS;
    const y = fromY + 0.5 + dy * progress;
    const tileX = Math.floor(x);
    const tileY = Math.floor(y);
    for (let ghostIndex = 0; ghostIndex < forecast[time].length; ghostIndex++) {
      const ghost = forecast[time][ghostIndex];
      if (!ghost.dangerous) continue;
      const gx = ghost.index % MAZE_COLUMNS;
      const gy = Math.floor(ghost.index / MAZE_COLUMNS);
      if (tileX === gx && tileY === gy) return Number.POSITIVE_INFINITY;
      // The engine checks player contact before moving ghosts as well as after.
      // A tile swap in one frame is therefore a collision, not a safe pass.
      const previous = forecast[Math.max(0, time - 1)][ghostIndex];
      if (previous.dangerous && previous.index === tileIndex(tileX, tileY)) {
        return Number.POSITIVE_INFINITY;
      }
      const horizontal = Math.min(Math.abs(tileX - gx), MAZE_COLUMNS - Math.abs(tileX - gx));
      if (horizontal + Math.abs(tileY - gy) === 1) risk += 2;
    }
  }
  return risk;
}

function chooseTasDirection(player: PacSan, ghosts: readonly Ghost[], maze: Maze,
  context: TasContext): AutoPlayDecision | null {
  const playerTile = tileOf(player);
  const start = tileIndex(playerTile.x, playerTile.y);
  // Follow a whole-maze dot route during a safe frightened window or when
  // only scattered dots remain. The short beam can flip its distant goal.
  if ((maze.remainingDots <= 12 || context.frightenedFramesRemaining > 30)
    && ghosts.every((ghost) =>
      ghost.houseState !== 'OUTSIDE' || ghost.state === 'EATEN'
        || (ghost.state === 'FRIGHTENED' && context.frightenedFramesRemaining > 30)
        || Math.hypot(ghost.x - player.x, ghost.y - player.y) > TILE_SIZE * 6)) {
    const route = chooseAutoDirection(player, ghosts, maze, 'expert', context);
    if (route) return route;
  }
  const config = getLevelConfig(context.round);
  const speed = context.frightenedFramesRemaining > 0
    ? config.frightenedPlayerSpeedPercent : config.playerSpeedPercent;
  // MovementSystem advances at speed / 80 pixels per frame on average.
  const moveFrames = Math.ceil(TILE_SIZE * 80 / speed);
  const forecast = ghostForecast(ghosts, context,
    player.freezeFrames + TAS_HORIZON_TILES * (moveFrames + 3) + 1);
  const staticThreat = threatCosts(ghosts, POLICIES.tas);
  const dotDistances = nearestDotDistances(maze);
  const fruitIndex = tileIndex(Math.floor(FRUIT_POSITION.x / TILE_SIZE),
    Math.floor(FRUIT_POSITION.y / TILE_SIZE));
  let routes: TasRoute[] = neighbors(start).map((neighbor) => ({
    index: start, time: player.freezeFrames, score: 0,
    firstDirection: neighbor.direction, target: start,
    visited: new Set<number>([start]),
    poweredUntil: context.frightenedFramesRemaining,
  }));
  if (routes.length === 0) return null;

  for (let depth = 0; depth < TAS_HORIZON_TILES; depth++) {
    const expanded: TasRoute[] = [];
    for (const route of routes) {
      for (const neighbor of neighbors(route.index)) {
        if (depth === 0 && neighbor.direction !== route.firstDirection) continue;
        const time = route.time + moveFrames;
        const risk = projectedRisk(route.index, neighbor.index, route.time, moveFrames,
          forecast, route.poweredUntil);
        if (!Number.isFinite(risk)) continue;
        const dot = maze.dots.get(neighbor.index);
        const freshDot = dot && !route.visited.has(neighbor.index);
        const fruit = context.fruit?.visible && neighbor.index === fruitIndex
          && time < context.fruit.framesRemaining && !route.visited.has(neighbor.index);
        const poweredUntil = freshDot && dot === 'power' ? time + config.frightenedFrames
          : route.poweredUntil;
        const visited = new Set(route.visited);
        visited.add(neighbor.index);
        const backtrack = route.visited.has(neighbor.index) ? 4 : 0;
        const reverse = depth === 0 && neighbor.direction === OPPOSITE[player.direction] ? 1 : 0;
        const reward = freshDot ? dot === 'power' ? 22 : 11 : 0;
        const fruitReward = fruit ? Math.min(24, context.fruit!.points / 15) : 0;
        expanded.push({
          index: neighbor.index,
          time: time + (freshDot
            ? dot === 'power' ? POWER_DOT_FREEZE_FRAMES : NORMAL_DOT_FREEZE_FRAMES : 0),
          score: route.score + reward + fruitReward
            - 1.5 - risk - backtrack - reverse
            - Math.min(120, staticThreat[neighbor.index]) * 0.035,
          firstDirection: route.firstDirection,
          target: freshDot || fruit ? neighbor.index : route.target,
          visited, poweredUntil,
        });
      }
    }
    if (expanded.length === 0) break;
    routes = DIRECTIONS_IN_ORDER.flatMap((direction) => expanded
      .filter((route) => route.firstDirection === direction)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, TAS_BEAM_WIDTH));
  }
  routes.sort((a, b) =>
    (b.score - Math.min(12, dotDistances[b.index]) * 0.6)
      - (a.score - Math.min(12, dotDistances[a.index]) * 0.6)
    || DIRECTIONS_IN_ORDER.indexOf(a.firstDirection) - DIRECTIONS_IN_ORDER.indexOf(b.firstDirection));
  const best = routes[0];
  return best && {
    direction: best.firstDirection,
    target: { x: best.target % MAZE_COLUMNS, y: Math.floor(best.target / MAZE_COLUMNS) },
  };
}

/** Picks a dot route with deterministic tie breaks; TAS also forecasts collisions. */
export function chooseAutoDirection(
  player: PacSan,
  ghosts: readonly Ghost[],
  maze: Maze,
  level: AutoPlayLevel,
  tasContext?: TasContext,
): AutoPlayDecision | null {
  const playerTile = tileOf(player);
  const start = tileIndex(playerTile.x, playerTile.y);
  if (!canPlayerEnter(playerTile.x, playerTile.y) || maze.remainingDots === 0) return null;

  if (level === 'tas') return chooseTasDirection(player, ghosts, maze,
    tasContext ?? { round: 1, frightenedFramesRemaining: 0 });

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

  if (level === 'expert' && tasContext?.committedTarget) {
    const preferred = tileIndex(tasContext.committedTarget.x, tasContext.committedTarget.y);
    if (maze.dots.has(preferred) && firstDirections[preferred]) {
      return { direction: firstDirections[preferred], target: tasContext.committedTarget };
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
