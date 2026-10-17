/** Compatibility step table, not a ROM-verified movement bit pattern.
 * Reference: https://github.com/masonicGIT/pacman/blob/master/src/Actor.js
 * Level 1 normal speed: one integer pixel per 60 Hz update (80% of 1.25).
 * TODO Phase 4: verify original hardware timing and ROM phase alignment.
 */
export const LEVEL_ONE = {
  level: 1,
  playerSpeedPercent: 80,
  playerStepPattern: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ghostSpeedPercent: 75,
  ghostStepPattern: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
} as const;

export type ScheduledGhostMode = 'SCATTER' | 'CHASE';

export interface GhostModePhase {
  readonly mode: ScheduledGhostMode;
  /** null means that this phase never expires. */
  readonly durationFrames: number | null;
}

export const LEVEL_ONE_GHOST_MODE_SCHEDULE: readonly GhostModePhase[] = [
  { mode: 'SCATTER', durationFrames: 7 * 60 },
  { mode: 'CHASE', durationFrames: 20 * 60 },
  { mode: 'SCATTER', durationFrames: 7 * 60 },
  { mode: 'CHASE', durationFrames: 20 * 60 },
  { mode: 'SCATTER', durationFrames: 5 * 60 },
  { mode: 'CHASE', durationFrames: 20 * 60 },
  { mode: 'SCATTER', durationFrames: 5 * 60 },
  { mode: 'CHASE', durationFrames: null },
];

export const GHOST_HOUSE_RELEASE_DOTS = {
  blinky: 0,
  pinky: 0,
  inky: 30,
  clyde: 60,
} as const;

// TODO Phase 4: replace with a ROM-derived level table after exact timing is verified.
export const GHOST_HOUSE_IDLE_RELEASE_FRAMES = 4 * 60;

export const GHOST_HOUSE_LIMITS = {
  exitX: 13 * 8 + 4,
  exitY: 11 * 8 + 4,
  upperY: 13 * 8 + 4,
  lowerY: 15 * 8 + 4,
} as const;
