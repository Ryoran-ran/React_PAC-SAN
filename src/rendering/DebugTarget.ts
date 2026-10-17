import { MAZE_OFFSET_Y, MAZE_ROWS, SCREEN_HEIGHT, SCREEN_WIDTH, TILE_SIZE } from '../config/constants';

const MARKER_INSET = 3;
const MAZE_TOP = MAZE_OFFSET_Y + MARKER_INSET;
const MAZE_BOTTOM = MAZE_OFFSET_Y + MAZE_ROWS * TILE_SIZE - MARKER_INSET;

type Point = { x: number; y: number };

// Leave visible targets unchanged. Project off-screen targets onto the maze edge
// so their markers do not overlap the score or footer text.
export function visibleDebugTarget(origin: Point, target: Point): Point {
  if (target.x >= MARKER_INSET && target.x <= SCREEN_WIDTH - MARKER_INSET
    && target.y >= MARKER_INSET && target.y <= SCREEN_HEIGHT - MARKER_INSET) {
    return target;
  }

  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  let fraction = 1;

  if (dx > 0) fraction = Math.min(fraction, (SCREEN_WIDTH - MARKER_INSET - origin.x) / dx);
  else if (dx < 0) fraction = Math.min(fraction, (MARKER_INSET - origin.x) / dx);
  if (dy > 0) fraction = Math.min(fraction, (MAZE_BOTTOM - origin.y) / dy);
  else if (dy < 0) fraction = Math.min(fraction, (MAZE_TOP - origin.y) / dy);

  const clipped = Math.max(0, fraction);
  return {
    x: Math.max(MARKER_INSET, Math.min(SCREEN_WIDTH - MARKER_INSET, origin.x + dx * clipped)),
    y: Math.max(MAZE_TOP, Math.min(MAZE_BOTTOM, origin.y + dy * clipped)),
  };
}
