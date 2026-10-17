import { DIRECTIONS, TILE_CENTER, TILE_SIZE, type Direction } from '../config/constants';
import { canPlayerEnter } from '../map/tileRules';

const mod = (value: number) => ((value % TILE_SIZE) + TILE_SIZE) % TILE_SIZE;
interface PixelPosition { readonly x: number; readonly y: number; }
export const isAtTileCenter = (entity: PixelPosition): boolean =>
  mod(entity.x) === TILE_CENTER && mod(entity.y) === TILE_CENTER;

/** Called only at corridor centers. Movement between centers remains on one axis. */
export function canMoveFromCenter(player: PixelPosition, direction: Direction): boolean {
  const vector = DIRECTIONS[direction];
  return canPlayerEnter(
    Math.floor(player.x / TILE_SIZE) + vector.x,
    Math.floor(player.y / TILE_SIZE) + vector.y,
  );
}
