import { DIRECTIONS, TILE_CENTER, TILE_SIZE, type Direction } from '../config/constants';
import type { PacSan } from '../entities/PacSan';
import { canPlayerEnter } from '../map/tileRules';

const mod = (value: number) => ((value % TILE_SIZE) + TILE_SIZE) % TILE_SIZE;
export const isAtTileCenter = (player: PacSan): boolean =>
  mod(player.x) === TILE_CENTER && mod(player.y) === TILE_CENTER;

/** Called only at corridor centers. Movement between centers remains on one axis. */
export function canMoveFromCenter(player: PacSan, direction: Direction): boolean {
  const vector = DIRECTIONS[direction];
  return canPlayerEnter(
    Math.floor(player.x / TILE_SIZE) + vector.x,
    Math.floor(player.y / TILE_SIZE) + vector.y,
  );
}
