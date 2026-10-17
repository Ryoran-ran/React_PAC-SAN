import { DIRECTIONS, OPPOSITE, SCREEN_WIDTH, TILE_SIZE, TUNNEL_ROW } from '../config/constants';
import { LEVEL_ONE } from '../config/levelTables';
import { canMoveFromCenter, isAtTileCenter } from '../engine/CollisionSystem';
import { chooseGhostDirection } from '../ai/GhostAI';
import type { Ghost } from '../entities/Ghost';
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

export function ghostStepCount(ghost: Ghost): number {
  const pattern = LEVEL_ONE.ghostStepPattern;
  return pattern[ghost.movementFrame++ % pattern.length];
}

export function moveGhost(ghost: Ghost): boolean {
  const steps = ghostStepCount(ghost);
  ghost.moving = false;

  for (let step = 0; step < steps; step++) {
    if (isAtTileCenter(ghost)) {
      const tile = { x: Math.floor(ghost.x / TILE_SIZE), y: Math.floor(ghost.y / TILE_SIZE) };
      const tileKey = `${tile.x},${tile.y}`;

      if (ghost.pendingReverse && tileKey === ghost.reversalTile) {
        ghost.direction = OPPOSITE[ghost.direction];
        ghost.pendingReverse = false;
        ghost.reversalTile = null;
        ghost.lastDecision = { tile, candidates: [ghost.direction], chosen: ghost.direction };
      } else if (!ghost.pendingReverse) {
        const choice = chooseGhostDirection(tile, ghost.direction, ghost.targetTile);
        ghost.direction = choice.chosen;
        ghost.lastDecision = choice.decision;
      }
    }

    const vector = DIRECTIONS[ghost.direction];
    ghost.x += vector.x;
    ghost.y += vector.y;
    if (Math.floor(ghost.y / TILE_SIZE) === TUNNEL_ROW) {
      ghost.x = ((ghost.x % SCREEN_WIDTH) + SCREEN_WIDTH) % SCREEN_WIDTH;
    }
    ghost.stepsMoved++;
    ghost.moving = true;
  }
  return ghost.moving;
}
