import { COLORS, MAZE_OFFSET_Y, SCREEN_WIDTH } from '../config/constants';
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
