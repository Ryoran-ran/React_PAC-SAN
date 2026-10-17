import { LEVEL_ONE_GHOST_MODE_SCHEDULE, type GhostModePhase } from '../config/levelTables';
import type { GhostMode } from '../entities/Ghost';

export class ModeScheduler {
  private phaseIndex = 0;
  private framesRemaining: number | null = null;

  public constructor(private readonly schedule: readonly GhostModePhase[] = LEVEL_ONE_GHOST_MODE_SCHEDULE) {
    this.reset();
  }

  public get mode(): GhostMode { return this.schedule[this.phaseIndex].mode; }
  public get remainingFrames(): number | null { return this.framesRemaining; }
  public get currentPhaseIndex(): number { return this.phaseIndex; }

  public reset(): void {
    this.phaseIndex = 0;
    this.framesRemaining = this.schedule[0].durationFrames;
  }

  /** Returns true exactly when the global mode changes. */
  public tick(): boolean {
    if (this.framesRemaining === null) return false;
    this.framesRemaining -= 1;
    if (this.framesRemaining > 0) return false;
    if (this.phaseIndex >= this.schedule.length - 1) {
      this.framesRemaining = null;
      return false;
    }
    this.phaseIndex += 1;
    this.framesRemaining = this.schedule[this.phaseIndex].durationFrames;
    return true;
  }
}
