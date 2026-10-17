export type DebugDisplayKey =
  | 'mazeGrid'
  | 'playerCenter'
  | 'ghostTargets'
  | 'directionChoices'
  | 'autoPlay'
  | 'engineStats'
  | 'ghostTable';

export type DebugDisplayOptions = Record<DebugDisplayKey, boolean>;

export const DEFAULT_DEBUG_DISPLAY: DebugDisplayOptions = {
  mazeGrid: true,
  playerCenter: true,
  ghostTargets: true,
  directionChoices: true,
  autoPlay: true,
  engineStats: true,
  ghostTable: true,
};
