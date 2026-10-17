import { COLORS, DIRECTIONS, MAZE_OFFSET_Y, SCREEN_WIDTH } from '../config/constants';
import type { Ghost } from '../entities/Ghost';
import type { PacSan } from '../entities/PacSan';
import type { FruitKind } from '../config/levelTables';

const angles = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

// The arcade sprite's visible 14x14 pixels, with its two alternating foot frames.
// Reference: https://github.com/sgothel/pacman/blob/master/media/tiles_all.png
// # is the body, o is the face, and . is transparent.
const FRIGHTENED_HEAD = [
  '.....####.....',
  '...########...',
  '..##########..',
  '.############.',
  '.############.',
  '.###oo##oo###.',
  '####oo##oo####',
  '##############',
  '##############',
  '##oo##oo##oo##',
  '#o##oo##oo##o#',
  '##############',
] as const;
const FRIGHTENED_FEET = [
  ['####.####.####', '.##...##...##.'],
  ['##.###..###.##', '#...##..##...#'],
] as const;

function drawFrightenedGhost(context: CanvasRenderingContext2D, x: number, y: number, flash: boolean, footFrame: number): void {
  const rows = [...FRIGHTENED_HEAD, ...FRIGHTENED_FEET[footFrame]];
  const left = Math.round(x) - 7;
  const top = Math.round(y) - 7;
  const bodyColor = flash ? '#dedeff' : '#2121ff';
  const faceColor = flash ? '#ff0000' : '#ffb7ae';

  for (let row = 0; row < rows.length; row++) {
    const pixels = rows[row];
    for (let column = 0; column < pixels.length;) {
      const pixel = pixels[column];
      if (pixel === '.') { column++; continue; }
      let end = column + 1;
      while (end < pixels.length && pixels[end] === pixel) end++;
      context.fillStyle = pixel === '#' ? bodyColor : faceColor;
      context.fillRect(left + column, top + row, end - column, 1);
      column = end;
    }
  }
}

export function drawPlayer(context: CanvasRenderingContext2D, player: PacSan): void {
  const phase = Math.floor(player.steps / 3) % 4;
  const mouth = [0.04, 0.22, 0.38, 0.22][phase] * Math.PI;
  const angle = angles[player.direction];
  context.fillStyle = COLORS.player;
  for (const offset of [-SCREEN_WIDTH, 0, SCREEN_WIDTH]) {
    context.beginPath();
    context.moveTo(player.x + offset, player.y + MAZE_OFFSET_Y);
    context.arc(player.x + offset, player.y + MAZE_OFFSET_Y, 6.5, angle + mouth, angle + Math.PI * 2 - mouth);
    context.closePath();
    context.fill();
  }
}

export function drawDyingPlayer(context: CanvasRenderingContext2D, player: PacSan, framesRemaining: number): void {
  const progress = 1 - framesRemaining / 90;
  const radius = Math.max(0, 6.5 * (1 - Math.max(0, progress - 0.35) / 0.65));
  if (radius <= 0) return;
  context.fillStyle = COLORS.player;
  context.beginPath();
  context.arc(player.x, player.y + MAZE_OFFSET_Y, radius,
    -Math.PI / 2 + progress * Math.PI, Math.PI * 1.5 - progress * Math.PI);
  context.lineTo(player.x, player.y + MAZE_OFFSET_Y);
  context.fill();
}

export function drawGhost(context: CanvasRenderingContext2D, ghost: Ghost, flash = false): void {
  const y = ghost.y + MAZE_OFFSET_Y;
  const pupil = DIRECTIONS[ghost.direction];
  for (const offset of [-SCREEN_WIDTH, 0, SCREEN_WIDTH]) {
    const x = ghost.x + offset;
    if (ghost.state === 'FRIGHTENED') {
      drawFrightenedGhost(context, x, y, flash, Math.floor(ghost.stepsMoved / 4) % 2);
      continue;
    }
    if (ghost.state === 'NORMAL') {
      context.fillStyle = ghost.color;
      context.beginPath();
      context.arc(x, y - 1, 6.5, Math.PI, 0);
      context.lineTo(x + 6.5, y + 6);
      context.lineTo(x + 3.25, y + 3.5);
      context.lineTo(x, y + 6);
      context.lineTo(x - 3.25, y + 3.5);
      context.lineTo(x - 6.5, y + 6);
      context.closePath();
      context.fill();
    }

    context.fillStyle = '#ffffff';
    context.beginPath(); context.arc(x - 2.6, y - 1.7, 2.2, 0, Math.PI * 2); context.fill();
    context.beginPath(); context.arc(x + 2.6, y - 1.7, 2.2, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#2121b5';
    context.beginPath();
    context.arc(x - 2.6 + pupil.x, y - 1.7 + pupil.y, 1.1, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(x + 2.6 + pupil.x, y - 1.7 + pupil.y, 1.1, 0, Math.PI * 2);
    context.fill();
  }
}

export function drawFruit(context: CanvasRenderingContext2D, kind: FruitKind, x: number, y: number): void {
  const cx = x;
  const cy = y + MAZE_OFFSET_Y;
  context.save();
  context.fillStyle = {
    cherry: '#f63838', strawberry: '#ed3039', peach: '#ff9436', apple: '#e93434',
    grapes: '#9d65e8', galaxian: '#eede48', bell: '#ffd84a', key: '#f4d747',
  }[kind];
  if (kind === 'cherry') {
    context.beginPath(); context.arc(cx - 3, cy + 2, 3, 0, Math.PI * 2);
    context.arc(cx + 3, cy + 2, 3, 0, Math.PI * 2); context.fill();
  } else if (kind === 'grapes') {
    for (const [dx, dy] of [[-3, -2], [2, -2], [-4, 2], [1, 2], [-1, 5]]) {
      context.beginPath(); context.arc(cx + dx, cy + dy, 2.5, 0, Math.PI * 2); context.fill();
    }
  } else if (kind === 'key') {
    context.beginPath(); context.arc(cx - 3, cy, 3, 0, Math.PI * 2); context.fill();
    context.fillRect(cx, cy - 1, 7, 2); context.fillRect(cx + 4, cy + 1, 2, 3);
  } else if (kind === 'galaxian') {
    context.beginPath(); context.moveTo(cx, cy - 6); context.lineTo(cx + 7, cy + 5);
    context.lineTo(cx, cy + 2); context.lineTo(cx - 7, cy + 5); context.closePath(); context.fill();
  } else if (kind === 'bell') {
    context.beginPath(); context.arc(cx, cy, 5, Math.PI, 0);
    context.lineTo(cx + 6, cy + 5); context.lineTo(cx - 6, cy + 5); context.closePath(); context.fill();
  } else if (kind === 'strawberry') {
    context.beginPath(); context.moveTo(cx - 6, cy - 3); context.lineTo(cx + 6, cy - 3);
    context.lineTo(cx, cy + 7); context.closePath(); context.fill();
  } else {
    context.beginPath(); context.arc(cx, cy + 1, 6, 0, Math.PI * 2); context.fill();
  }
  if (kind !== 'key' && kind !== 'galaxian' && kind !== 'bell') {
    context.fillStyle = '#55c54c';
    context.fillRect(cx, cy - 7, 2, 4);
  }
  context.restore();
}
