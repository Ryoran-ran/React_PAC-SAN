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
  x: number, y: number, power: boolean): void {
  context.fillStyle = COLORS.dot;
  if (!power) {
    context.fillRect(x - 1, y - 1, 2, 2);
    return;
  }
  for (let row = 0; row < POWER_COOKIE.length; row++) {
    const start = POWER_COOKIE[row].indexOf('#');
    context.fillRect(x - 4 + start, y - 4 + row,
      POWER_COOKIE[row].lastIndexOf('#') - start + 1, 1);
  }
}
