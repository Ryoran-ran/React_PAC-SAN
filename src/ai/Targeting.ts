import { DIRECTIONS, TILE_SIZE, type Direction } from '../config/constants';
import type { Ghost, GhostId, TilePoint } from '../entities/Ghost';
import type { UpwardTargeting } from '../engine/GameModes';

export function tileFromPosition(entity: { readonly x: number; readonly y: number }): TilePoint {
  return { x: Math.floor(entity.x / TILE_SIZE), y: Math.floor(entity.y / TILE_SIZE) };
}

function tileAhead(origin: TilePoint, direction: Direction, distance: number): TilePoint {
  const vector = DIRECTIONS[direction];
  return { x: origin.x + vector.x * distance, y: origin.y + vector.y * distance };
}

export const getBlinkyTarget = (playerTile: TilePoint): TilePoint => ({ ...playerTile });

export function getPinkyTarget(playerTile: TilePoint, playerDirection: Direction,
  upwardTargeting: UpwardTargeting = 'corrected'): TilePoint {
  if (playerDirection === 'up' && upwardTargeting === 'original') {
    return { x: playerTile.x - 4, y: playerTile.y - 4 };
  }
  return tileAhead(playerTile, playerDirection, 4);
}

export function getInkyTarget(
  playerTile: TilePoint,
  playerDirection: Direction,
  blinkyTile: TilePoint,
  upwardTargeting: UpwardTargeting = 'corrected',
): TilePoint {
  const pivot = playerDirection === 'up' && upwardTargeting === 'original'
    ? { x: playerTile.x - 2, y: playerTile.y - 2 }
    : tileAhead(playerTile, playerDirection, 2);
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
  chaseStyle: GhostId = ghost.id,
  upwardTargeting: UpwardTargeting = 'corrected',
): TilePoint {
  if (ghost.mode === 'SCATTER' && !(ghost.id === 'blinky' && elroy)) return { ...ghost.scatterTarget };

  const playerTile = tileFromPosition(player);
  const ghostTile = tileFromPosition(ghost);
  const blinkyTile = tileFromPosition(blinky);
  const targeting: Record<GhostId, () => TilePoint> = {
    blinky: () => getBlinkyTarget(playerTile),
    pinky: () => getPinkyTarget(playerTile, player.direction, upwardTargeting),
    inky: () => getInkyTarget(playerTile, player.direction, blinkyTile, upwardTargeting),
    clyde: () => getClydeTarget(ghostTile, playerTile, ghost.scatterTarget),
  };
  return targeting[chaseStyle]();
}
