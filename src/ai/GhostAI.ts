import { DIRECTIONS, OPPOSITE, type Direction } from '../config/constants';
import type { GhostDecision, TilePoint } from '../entities/Ghost';
import { canGhostEnter, isGhostNoUpTile } from '../map/tileRules';

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
): DirectionChoice {
  const available = availableDirections(tile);
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
