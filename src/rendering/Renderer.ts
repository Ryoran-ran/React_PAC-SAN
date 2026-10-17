import { COLORS, MAZE_COLUMNS, MAZE_OFFSET_Y, MAZE_ROWS, SCREEN_HEIGHT, SCREEN_WIDTH, TILE_CENTER, TILE_SIZE } from '../config/constants';
import type { GameEngine } from '../engine/GameEngine';
import { canPlayerEnter } from '../map/tileRules';
import { MazeRenderer } from './MazeRenderer';
import { pixelText } from './PixelText';
import { drawGhost, drawPlayer } from './SpriteRenderer';

export class Renderer {
  private maze = new MazeRenderer();

  constructor(private context: CanvasRenderingContext2D) {
    context.imageSmoothingEnabled = false;
  }

  draw(engine: GameEngine): void {
    const ctx = this.context;
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    pixelText(ctx, '1UP', 8, 1, COLORS.text);
    pixelText(ctx, 'HIGH SCORE', 136, 1, COLORS.text, 'center');
    pixelText(ctx, String(engine.score).padStart(6, '0'), 8, 12, COLORS.text);
    pixelText(ctx, String(engine.highScore).padStart(6, '0'), 136, 12, COLORS.text, 'center');
    ctx.save();
    ctx.translate(0, MAZE_OFFSET_Y);
    this.maze.draw(ctx);
    for (const [index, dot] of engine.maze.dots) {
      const x = (index % MAZE_COLUMNS) * TILE_SIZE + TILE_CENTER;
      const y = Math.floor(index / MAZE_COLUMNS) * TILE_SIZE + TILE_CENTER;
      ctx.fillStyle = COLORS.dot;
      if (dot === 'power') {
        if (engine.state !== 'PLAYING' || Math.floor(engine.playFrame / 10) % 2 === 0) {
          ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
        }
      } else ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    ctx.restore();
    for (const ghost of engine.ghosts) drawGhost(ctx, ghost);
    drawPlayer(ctx, engine.player);
    pixelText(ctx, 'ROUND 01', 8, 278, COLORS.text);
    pixelText(ctx, 'PAC-SAN', SCREEN_WIDTH - 8, 278, COLORS.player, 'right');

    const message = {
      TITLE: 'PUSH ENTER', READY: 'READY!', PLAYING: '', PAUSED: 'PAUSED', LEVEL_CLEAR: 'CLEAR!',
    }[engine.state].replace('!', '');
    if (message) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(66, 159, 92, 13);
      pixelText(ctx, message, SCREEN_WIDTH / 2, 162, COLORS.player, 'center');
    }
    if (engine.debug) this.drawDebug(engine);
  }

  private drawDebug(engine: GameEngine): void {
    const ctx = this.context;
    ctx.save();
    ctx.strokeStyle = '#50d7bd44';
    ctx.lineWidth = 0.4;
    for (let y = 0; y < MAZE_ROWS; y++) {
      for (let x = 0; x < MAZE_COLUMNS; x++) {
        if (canPlayerEnter(x, y)) ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE + MAZE_OFFSET_Y, TILE_SIZE, TILE_SIZE);
      }
    }
    ctx.strokeStyle = COLORS.debug;
    const { x, y } = engine.player;
    ctx.strokeRect(x - 2, y + MAZE_OFFSET_Y - 2, 4, 4);
    for (const ghost of engine.ghosts) {
      const targetX = ghost.targetTile.x * TILE_SIZE + TILE_CENTER;
      const targetY = ghost.targetTile.y * TILE_SIZE + TILE_CENTER + MAZE_OFFSET_Y;
      ctx.strokeStyle = `${ghost.color}88`;
      ctx.beginPath();
      ctx.moveTo(ghost.x, ghost.y + MAZE_OFFSET_Y);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
      ctx.strokeRect(targetX - 2.5, targetY - 2.5, 5, 5);

      if (ghost.lastDecision) {
        ctx.fillStyle = ghost.color;
        for (const direction of ghost.lastDecision.candidates) {
          const vector = { up: [0, -1], left: [-1, 0], down: [0, 1], right: [1, 0] }[direction];
          ctx.fillRect(
            ghost.x + vector[0] * 5 - 0.75,
            ghost.y + MAZE_OFFSET_Y + vector[1] * 5 - 0.75,
            1.5,
            1.5,
          );
        }
      }
    }
    ctx.restore();
  }
}
