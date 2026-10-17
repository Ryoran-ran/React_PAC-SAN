import {
  GHOST_HOUSE_IDLE_RELEASE_FRAMES,
  GHOST_HOUSE_LIMITS,
  GHOST_HOUSE_RELEASE_DOTS,
} from '../config/levelTables';
import type { Ghost } from '../entities/Ghost';
import { ghostStepCount } from '../systems/MovementSystem';

const RELEASE_ORDER = ['pinky', 'inky', 'clyde'] as const;

export class GhostHouse {
  public dotCounter = 0;
  public idleFrames = 0;

  public reset(): void {
    this.dotCounter = 0;
    this.idleFrames = 0;
  }

  public onDotConsumed(): void {
    this.dotCounter += 1;
    this.idleFrames = 0;
  }

  public update(ghosts: readonly Ghost[]): void {
    this.idleFrames += 1;
    const leaving = ghosts.some((ghost) => ghost.houseState === 'LEAVING_HOME');
    if (!leaving) this.releaseNextEligible(ghosts);

    for (const ghost of ghosts) {
      if (ghost.houseState === 'LEAVING_HOME') this.advanceLeavingGhost(ghost);
      else if (ghost.houseState === 'PACING_HOME') this.advancePacingGhost(ghost);
    }
  }

  private releaseNextEligible(ghosts: readonly Ghost[]): void {
    const next = RELEASE_ORDER
      .map((id) => ghosts.find((ghost) => ghost.id === id))
      .find((ghost) => ghost?.houseState === 'PACING_HOME');
    if (!next) return;

    const reachedDotLimit = this.dotCounter >= GHOST_HOUSE_RELEASE_DOTS[next.id];
    const timedOut = this.idleFrames >= GHOST_HOUSE_IDLE_RELEASE_FRAMES;
    if (!reachedDotLimit && !timedOut) return;

    next.houseState = 'LEAVING_HOME';
    next.lastDecision = null;
    if (timedOut && !reachedDotLimit) this.idleFrames = 0;
  }

  private advancePacingGhost(ghost: Ghost): void {
    const steps = ghostStepCount(ghost);
    ghost.moving = false;
    for (let step = 0; step < steps; step++) {
      if (ghost.y <= GHOST_HOUSE_LIMITS.upperY) ghost.direction = 'down';
      if (ghost.y >= GHOST_HOUSE_LIMITS.lowerY) ghost.direction = 'up';
      ghost.y += ghost.direction === 'up' ? -1 : 1;
      ghost.stepsMoved += 1;
      ghost.moving = true;
    }
  }

  private advanceLeavingGhost(ghost: Ghost): void {
    const steps = ghostStepCount(ghost);
    ghost.moving = false;
    for (let step = 0; step < steps; step++) {
      if (ghost.x !== GHOST_HOUSE_LIMITS.exitX) {
        ghost.direction = ghost.x < GHOST_HOUSE_LIMITS.exitX ? 'right' : 'left';
        ghost.x += ghost.direction === 'right' ? 1 : -1;
      } else {
        ghost.direction = 'up';
        ghost.y -= 1;
      }
      ghost.stepsMoved += 1;
      ghost.moving = true;

      if (ghost.y <= GHOST_HOUSE_LIMITS.exitY) {
        ghost.y = GHOST_HOUSE_LIMITS.exitY;
        ghost.direction = 'left';
        ghost.houseState = 'OUTSIDE';
        ghost.lastDecision = null;
        break;
      }
    }
  }
}
