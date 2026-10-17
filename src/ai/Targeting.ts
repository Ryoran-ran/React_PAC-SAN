import { DIRECTIONS, TILE_SIZE, type Direction } from '../config/constants';
import type { Ghost, GhostId, TilePoint } from '../entities/Ghost';

export function tileFromPosition(entity: { readonly x: number; readonly y: number }): TilePoint {
  return { x: Math.floor(entity.x / TILE_SIZE), y: Math.floor(entity.y / TILE_SIZE) };
}

function tileAhead(origin: TilePoint, direction: Direction, distance: number): TilePoint {
  if (direction === 'up') {
    // Original overflow bug: moving up also offsets the target to the left.
    return { x: origin.x - distance, y: origin.y - distance };
  }
  const vector = DIRECTIONS[direction];
  return { x: origin.x + vector.x * distance, y: origin.y + vector.y * distance };
}

export const getBlinkyTarget = (playerTile: TilePoint): TilePoint => ({ ...playerTile });

export function getPinkyTarget(playerTile: TilePoint, playerDirection: Direction): TilePoint {
  return tileAhead(playerTile, playerDirection, 4);
}

export function getInkyTarget(
  playerTile: TilePoint,
  playerDirection: Direction,
  blinkyTile: TilePoint,
): TilePoint {
  const pivot = tileAhead(playerTile, playerDirection, 2);
  return { x: pivot.x * 2 - blinkyTile.x, y: pivot.y * 2 - blinkyTile.y };
}

export function getClydeTarget(
  clydeTile: TilePoint,
  playerTile: TilePoint,
  scatterTarget: TilePoint,
): TilePoint {
  const dx = clydeTile.x - playerTile.x;
  const dy = clydeTile.y - playerTile.y;
  return dx * dx + dy * dy >= 64 ? { ...playerTile } : { ...scatterTarget };
}

export function getGhostTarget(
  ghost: Ghost,
  player: { readonly x: number; readonly y: number; readonly direction: Direction },
  blinky: Ghost,
  elroy = false,
): TilePoint {
  if (ghost.mode === 'SCATTER' && !(ghost.id === 'blinky' && elroy)) return { ...ghost.scatterTarget };

  const playerTile = tileFromPosition(player);
  const ghostTile = tileFromPosition(ghost);
  const blinkyTile = tileFromPosition(blinky);
  const targeting: Record<GhostId, () => TilePoint> = {
    blinky: () => getBlinkyTarget(playerTile),
    pinky: () => getPinkyTarget(playerTile, player.direction),
    inky: () => getInkyTarget(playerTile, player.direction, blinkyTile),
    clyde: () => getClydeTarget(ghostTile, playerTile, ghost.scatterTarget),
  };
  return targeting[ghost.id]();
}
