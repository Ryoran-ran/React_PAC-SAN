import { DIRECTIONS, OPPOSITE, SCREEN_WIDTH, TILE_SIZE, TUNNEL_ROW } from '../config/constants';
import { GHOST_HOUSE_LIMITS, getLevelConfig } from '../config/levelTables';
import { canMoveFromCenter, isAtTileCenter } from '../engine/CollisionSystem';
import { chooseFrightenedDirection, chooseGhostDirection } from '../ai/GhostAI';
import type { GameRandom } from '../engine/Random';
import type { Ghost } from '../entities/Ghost';
import type { PacSan } from '../entities/PacSan';

/** Returns true when a pixel was traversed. Never uses delta time or floats. */
export function speedSteps(frame: number, percent: number): number {
  // 100% = 1.25 px/frame; the integer difference preserves the old 80%/75% patterns.
  return Math.floor((frame + 1) * percent * 5 / 400) - Math.floor(frame * percent * 5 / 400);
}

export function movePlayer(player: PacSan, speedPercent = getLevelConfig(1).playerSpeedPercent,
  onReachCenter?: () => boolean): boolean {
  player.moving = false;
  if (player.freezeFrames > 0) {
    player.freezeFrames--;
    return false;
  }
  const steps = speedSteps(player.movementFrame++, speedPercent);
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
    // A faster level can cross a center on the first of two pixel steps.
    // Let scoring stop movement there so the dot freeze begins at that pixel.
    if (isAtTileCenter(player) && onReachCenter?.()) break;
  }
  return player.moving;
}

export function ghostStepCount(ghost: Ghost, speedPercent = getLevelConfig(1).ghostSpeedPercent): number {
  return speedSteps(ghost.movementFrame++, speedPercent);
}

export function moveGhost(ghost: Ghost, speedPercent = getLevelConfig(1).ghostSpeedPercent,
  random?: GameRandom): boolean {
  if (ghost.state === 'EATEN' && ghost.x === GHOST_HOUSE_LIMITS.exitX
    && ghost.y === GHOST_HOUSE_LIMITS.exitY) {
    ghost.houseState = 'RETURNING_HOME';
    ghost.lastDecision = null;
    return false;
  }
  const steps = ghostStepCount(ghost, speedPercent);
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
        const choice = ghost.state === 'FRIGHTENED' && random
          ? chooseFrightenedDirection(tile, ghost.direction, random)
          : chooseGhostDirection(tile, ghost.direction, ghost.targetTile, ghost.state === 'EATEN');
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
    if (ghost.state === 'EATEN' && ghost.x === GHOST_HOUSE_LIMITS.exitX
      && ghost.y === GHOST_HOUSE_LIMITS.exitY) {
      ghost.houseState = 'RETURNING_HOME';
      ghost.lastDecision = null;
      break;
    }
  }
  return ghost.moving;
}
