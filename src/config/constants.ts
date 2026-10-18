export const TILE_SIZE = 8;
export const TILE_CENTER = TILE_SIZE / 2;
export const MAZE_COLUMNS = 28;
export const MAZE_ROWS = 31;
export const SCREEN_WIDTH = 224;
export const SCREEN_HEIGHT = 288;
export const MAZE_OFFSET_Y = 24;
export const TUNNEL_ROW = 14;
export const FIXED_FPS = 60;
export const FRAME_DURATION_MS = 1000 / FIXED_FPS;
export const MAX_UPDATES_PER_RENDER = 240;
export const NORMAL_DOT_POINTS = 10;
export const POWER_DOT_POINTS = 50;
export const NORMAL_DOT_FREEZE_FRAMES = 1;
export const POWER_DOT_FREEZE_FRAMES = 3;
export const GHOST_EAT_FREEZE_FRAMES = 12;
export const GHOST_SCORE_POPUP_FRAMES = 36;
export const FRUIT_SCORE_POPUP_FRAMES = 90;
export const TOTAL_DOTS = 244;
// TODO Phase 4: verify the arcade READY duration against frame recordings.
export const READY_FRAMES = 90;
export const DYING_FRAMES = 90;
export const LEVEL_CLEAR_FRAMES = 90;
export const INITIAL_LIVES = 3;
export const EXTRA_LIFE_SCORE = 10_000;
export const PLAYER_START = { x: 112, y: 188 } as const;
export const HIGH_SCORE_KEY = 'pac-san.high-score.v1';

export const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
} as const;
export type Direction = keyof typeof DIRECTIONS;
export const OPPOSITE: Record<Direction, Direction> = {
  up: 'down', down: 'up', left: 'right', right: 'left',
};

export const COLORS = {
  background: '#000000', wall: '#2121ff', dot: '#ffb8ae',
  player: '#ffdf00', text: '#f5f5f5', gate: '#ffb8ff', debug: '#50d7bd',
} as const;
