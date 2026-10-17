import { DIRECTIONS, OPPOSITE, SCREEN_WIDTH, TILE_SIZE, TUNNEL_ROW } from '../config/constants';
import { LEVEL_ONE } from '../config/levelTables';
import { canMoveFromCenter, isAtTileCenter } from '../engine/CollisionSystem';
import type { PacSan } from '../entities/PacSan';

/** Returns true when a pixel was traversed. Never uses delta time or floats. */
export function movePlayer(player: PacSan): boolean {
  player.moving = false;
  if (player.freezeFrames > 0) {
    player.freezeFrames--;
    return false;
  }
  const pattern = LEVEL_ONE.playerStepPattern;
  const steps = pattern[player.movementFrame++ % pattern.length];
  for (let step = 0; step < steps; step++) {
    // Reversals are allowed immediately, including between tile centers.
    if (player.requestedDirection === OPPOSITE[player.direction]) {
      player.direction = player.requestedDirection;
    }
    if (isAtTileCenter(player)) {
      if (canMoveFromCenter(player, player.requestedDirection)) {
        player.direction = player.requestedDirection;
      }
      if (!canMoveFromCenter(player, player.direction)) break;
    }
    const vector = DIRECTIONS[player.direction];
    player.x += vector.x;
    player.y += vector.y;
    // Keep a full-width, continuous tunnel, including sprite wrapping in Renderer.
    if (Math.floor(player.y / TILE_SIZE) === TUNNEL_ROW) {
      player.x = ((player.x % SCREEN_WIDTH) + SCREEN_WIDTH) % SCREEN_WIDTH;
    }
    player.steps++;
    player.moving = true;
  }
  return player.moving;
}
