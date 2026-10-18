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

export type FruitKind = 'cherry' | 'strawberry' | 'peach' | 'apple'
  | 'melon' | 'galaxian' | 'bell' | 'key';

export interface LevelConfig {
  readonly playerSpeedPercent: number;
  readonly frightenedPlayerSpeedPercent: number;
  readonly ghostSpeedPercent: number;
  readonly frightenedGhostSpeedPercent: number;
  readonly ghostTunnelSpeedPercent: number;
  readonly frightenedFrames: number;
  readonly frightenedFlashes: number;
  readonly fruit: FruitKind;
  readonly fruitPoints: number;
  readonly elroyDots: readonly [number, number];
  readonly elroySpeedPercent: readonly [number, number];
  readonly ghostReleaseDots: { readonly blinky: number; readonly pinky: number; readonly inky: number; readonly clyde: number };
  readonly ghostHouseIdleFrames: number;
  readonly modeSchedule: readonly GhostModePhase[];
}

// Tables A.1 and the ghost-house discussion in The Pac-Man Dossier:
// https://pacman.holenet.info/ (ROM-level timing remains a Phase 4 task).
const FRUITS: readonly [FruitKind, number][] = [
  ['cherry', 100], ['strawberry', 300], ['peach', 500], ['peach', 500],
  ['apple', 700], ['apple', 700], ['melon', 1000], ['melon', 1000],
  ['galaxian', 2000], ['galaxian', 2000], ['bell', 3000], ['bell', 3000],
];

/** Current round at the left, up to six earlier rounds toward the right. */
export function getFruitCounter(level: number): FruitKind[] {
  const round = Math.max(1, Math.floor(level));
  return Array.from({ length: Math.min(round, 7) }, (_, index) =>
    FRUITS[round - index - 1]?.[0] ?? 'key');
}

const FRIGHT_SECONDS = [6, 5, 4, 3, 2, 5, 2, 2, 1, 5, 2, 1, 1, 3, 1, 1, 0, 1] as const;

export function getLevelConfig(level: number): LevelConfig {
  const round = Math.max(1, Math.floor(level));
  const early = round === 1;
  const middle = round >= 2 && round <= 4;
  const late = round >= 21;
  const frightSeconds = FRIGHT_SECONDS[round - 1] ?? 0;
  const fruit = FRUITS[round - 1] ?? ['key', 5000];
  const elroyDots: readonly [number, number] = early ? [20, 10]
    : round === 2 ? [30, 15] : round <= 5 ? [40, 20]
      : round <= 8 ? [50, 25] : round <= 11 ? [60, 30]
        : round <= 14 ? [80, 40] : round <= 18 ? [100, 50] : [120, 60];
  const scatterSeconds = middle || early ? 7 : 5;
  const schedule: readonly GhostModePhase[] = early ? LEVEL_ONE_GHOST_MODE_SCHEDULE : [
    { mode: 'SCATTER', durationFrames: scatterSeconds * 60 },
    { mode: 'CHASE', durationFrames: 20 * 60 },
    { mode: 'SCATTER', durationFrames: scatterSeconds * 60 },
    { mode: 'CHASE', durationFrames: 20 * 60 },
    { mode: 'SCATTER', durationFrames: 5 * 60 },
    { mode: 'CHASE', durationFrames: (middle ? 1033 : 1037) * 60 },
    { mode: 'SCATTER', durationFrames: 1 },
    { mode: 'CHASE', durationFrames: null },
  ];

  return {
    playerSpeedPercent: early ? 80 : middle || late ? 90 : 100,
    frightenedPlayerSpeedPercent: early ? 90 : middle ? 95 : 100,
    ghostSpeedPercent: early ? 75 : middle ? 85 : 95,
    frightenedGhostSpeedPercent: early ? 50 : middle ? 55 : 60,
    ghostTunnelSpeedPercent: early ? 40 : middle ? 45 : 50,
    frightenedFrames: frightSeconds * 60,
    frightenedFlashes: frightSeconds === 0 ? 0 : frightSeconds === 1 ? 3 : 5,
    fruit: fruit[0], fruitPoints: fruit[1],
    elroyDots,
    elroySpeedPercent: [early ? 80 : middle ? 90 : 100, early ? 85 : middle ? 95 : 105],
    ghostReleaseDots: { blinky: 0, pinky: 0, inky: early ? 30 : 0, clyde: early ? 60 : round === 2 ? 50 : 0 },
    ghostHouseIdleFrames: (round <= 4 ? 4 : 3) * 60,
    modeSchedule: schedule,
  };
}

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
