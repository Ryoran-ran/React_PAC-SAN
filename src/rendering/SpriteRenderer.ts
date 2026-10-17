import { COLORS, DIRECTIONS, MAZE_OFFSET_Y, SCREEN_WIDTH } from '../config/constants';
import type { Ghost } from '../entities/Ghost';
import type { PacSan } from '../entities/PacSan';

const angles = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

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

export function drawGhost(context: CanvasRenderingContext2D, ghost: Ghost): void {
  const y = ghost.y + MAZE_OFFSET_Y;
  const pupil = DIRECTIONS[ghost.direction];
  for (const offset of [-SCREEN_WIDTH, 0, SCREEN_WIDTH]) {
    const x = ghost.x + offset;
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
