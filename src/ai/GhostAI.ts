import { DIRECTIONS, OPPOSITE, type Direction } from '../config/constants';
import type { GhostDecision, TilePoint } from '../entities/Ghost';
import { canGhostEnter, isGhostNoUpTile } from '../map/tileRules';
import type { GameRandom } from '../engine/Random';

export const GHOST_TIE_BREAK_ORDER: readonly Direction[] = ['up', 'left', 'down', 'right'];

export interface DirectionChoice {
  readonly chosen: Direction;
  readonly decision: GhostDecision;
}

const distanceSquared = (from: TilePoint, to: TilePoint) =>
  (from.x - to.x) ** 2 + (from.y - to.y) ** 2;

function availableDirections(tile: TilePoint): Direction[] {
  return GHOST_TIE_BREAK_ORDER.filter((direction) => {
    if (direction === 'up' && isGhostNoUpTile(tile.x, tile.y)) return false;
    const vector = DIRECTIONS[direction];
    return canGhostEnter(tile.x + vector.x, tile.y + vector.y);
  });
}

export function chooseGhostDirection(
  tile: TilePoint,
  currentDirection: Direction,
  target: TilePoint,
  ignoreNoUp = false,
): DirectionChoice {
  const available = ignoreNoUp
    ? GHOST_TIE_BREAK_ORDER.filter((direction) => {
      const vector = DIRECTIONS[direction];
      return canGhostEnter(tile.x + vector.x, tile.y + vector.y);
    })
    : availableDirections(tile);
  const reverse = OPPOSITE[currentDirection];
  const forwardChoices = available.filter((direction) => direction !== reverse);
  const candidates = forwardChoices.length > 0 ? forwardChoices : available;
  let chosen = candidates[0] ?? reverse;
  let shortestDistance = Number.POSITIVE_INFINITY;

  for (const direction of candidates) {
    const vector = DIRECTIONS[direction];
    const nextTile = { x: tile.x + vector.x, y: tile.y + vector.y };
    const distance = distanceSquared(nextTile, target);
    if (distance < shortestDistance) {
      shortestDistance = distance;
      chosen = direction;
    }
  }

  return {
    chosen,
    decision: { tile: { ...tile }, candidates: [...candidates], chosen },
  };
}

export function chooseFrightenedDirection(
  tile: TilePoint, currentDirection: Direction, random: GameRandom,
): DirectionChoice {
  const clockwise: readonly Direction[] = ['up', 'right', 'down', 'left'];
  const reverse = OPPOSITE[currentDirection];
  const available = clockwise.filter((direction) => {
    const vector = DIRECTIONS[direction];
    return canGhostEnter(tile.x + vector.x, tile.y + vector.y);
  });
  const candidates = available.filter((direction) => direction !== reverse);
  const choices = candidates.length ? candidates : available;
  const start = random.nextInt(clockwise.length);
  const chosen = Array.from({ length: clockwise.length }, (_, offset) => clockwise[(start + offset) % clockwise.length])
    .find((direction) => choices.includes(direction)) ?? reverse;
  return { chosen, decision: { tile: { ...tile }, candidates: [...choices], chosen } };
}
