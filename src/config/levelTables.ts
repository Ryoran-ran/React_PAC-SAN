/** Compatibility step table, not a ROM-verified movement bit pattern.
 * Reference: https://github.com/masonicGIT/pacman/blob/master/src/Actor.js
 * Level 1 normal speed: one integer pixel per 60 Hz update (80% of 1.25).
 * TODO Phase 4: verify original hardware timing and ROM phase alignment.
 */
export const LEVEL_ONE = {
  level: 1,
  playerSpeedPercent: 80,
  playerStepPattern: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
} as const;
