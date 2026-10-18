import { COLORS } from '../config/constants';

// The energizer is an eight-pixel arcade disk, not an antialiased canvas arc.
const POWER_COOKIE = [
  '..####..',
  '.######.',
  '########',
  '########',
  '########',
  '########',
  '.######.',
  '..####..',
] as const;

export function drawCookie(context: CanvasRenderingContext2D,
  x: number, y: number, power: boolean, scale = 1): void {
  context.fillStyle = COLORS.dot;
  if (!power) {
    const size = Math.max(1, Math.round(2 * scale));
    context.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
    return;
  }
  const size = Math.max(1, Math.round(POWER_COOKIE.length * scale));
  const left = Math.round(x - size / 2);
  const top = Math.round(y - size / 2);
  for (let row = 0; row < POWER_COOKIE.length; row++) {
    const start = POWER_COOKIE[row].indexOf('#');
    const end = POWER_COOKIE[row].lastIndexOf('#') + 1;
    const rowTop = Math.round(row * size / POWER_COOKIE.length);
    const rowBottom = Math.round((row + 1) * size / POWER_COOKIE.length);
    const columnLeft = Math.round(start * size / POWER_COOKIE.length);
    const columnRight = Math.round(end * size / POWER_COOKIE.length);
    if (rowBottom > rowTop && columnRight > columnLeft) {
      context.fillRect(left + columnLeft, top + rowTop,
        columnRight - columnLeft, rowBottom - rowTop);
    }
  }
}
