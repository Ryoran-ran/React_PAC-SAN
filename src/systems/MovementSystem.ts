import { DIRECTIONS, OPPOSITE, SCREEN_WIDTH, TILE_CENTER, TILE_SIZE, TUNNEL_ROW } from '../config/constants';
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
  onDotCheck?: () => boolean): boolean {
  player.moving = false;
  if (player.freezeFrames > 0) {
    player.freezeFrames--;
    return false;
  }
  const steps = speedSteps(player.movementFrame++, speedPercent);
  for (let step = 0; step < steps; step++) {
    // Reversals are allowed immediately, including between tile centers.
    if (!player.turning && player.requestedDirection === OPPOSITE[player.direction]) {
      player.direction = player.requestedDirection;
    }
    if (!player.turning && player.requestedDirection !== player.direction
      && player.requestedDirection !== OPPOSITE[player.direction]) {
      const turn = availablePlayerTurn(player);
      if (turn) {
        player.turning = turn;
        player.direction = player.requestedDirection;
      }
    }
    if (!player.turning && isAtTileCenter(player)) {
      if (canMoveFromCenter(player, player.requestedDirection)) {
        player.direction = player.requestedDirection;
      }
      if (!canMoveFromCenter(player, player.direction)) break;
    }
    const vector = DIRECTIONS[player.direction];
    if (player.turning) {
      const { centerX, centerY, from } = player.turning;
      const oldAxis = DIRECTIONS[from].x !== 0 ? 'x' : 'y';
      const remaining = (oldAxis === 'x' ? centerX - player.x : centerY - player.y);
      player[oldAxis] += Math.sign(remaining);
      player.x += vector.x;
      player.y += vector.y;
      if (player[oldAxis] === (oldAxis === 'x' ? centerX : centerY)) player.turning = null;
    } else {
      player.x += vector.x;
      player.y += vector.y;
    }
    // Keep a full-width, continuous tunnel, including sprite wrapping in Renderer.
    if (Math.floor(player.y / TILE_SIZE) === TUNNEL_ROW) {
      player.x = ((player.x % SCREEN_WIDTH) + SCREEN_WIDTH) % SCREEN_WIDTH;
    }
    player.steps++;
    player.moving = true;
    // A faster level can cross a center on the first of two pixel steps.
    // A diagonal turn also needs a check before it bypasses that center.
    if ((player.turning || isAtTileCenter(player)) && onDotCheck?.()) break;
  }
  return player.moving;
}

/** The arcade permits a perpendicular turn 3/4 pixels before or after a center. */
function availablePlayerTurn(player: PacSan): PacSan['turning'] {
  const from = player.direction;
  const axis = DIRECTIONS[from].x !== 0 ? 'x' : 'y';
  const crossAxis = axis === 'x' ? 'y' : 'x';
  if (player[crossAxis] % TILE_SIZE !== TILE_CENTER) return null;
  const coordinate = player[axis];
  const lowerCenter = Math.floor((coordinate - TILE_CENTER) / TILE_SIZE) * TILE_SIZE + TILE_CENTER;
  const centers = DIRECTIONS[from][axis] > 0
    ? [lowerCenter, lowerCenter + TILE_SIZE] : [lowerCenter + TILE_SIZE, lowerCenter];
  for (const center of centers) {
    const signedDistance = (coordinate - center) * DIRECTIONS[from][axis];
    const postLimit = from === 'right' || from === 'down' ? 4 : 3;
    const preLimit = from === 'left' || from === 'up' ? 4 : 3;
    if (signedDistance < -preLimit || signedDistance > postLimit) continue;
    const junction = axis === 'x'
      ? { x: center, y: player.y } : { x: player.x, y: center };
    if (!canMoveFromCenter(junction, player.requestedDirection)) continue;
    // The center step is an ordinary turn; diagonal correction is unnecessary.
    if (signedDistance === 0) return null;
    return { from, centerX: junction.x, centerY: junction.y };
  }
  return null;
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
