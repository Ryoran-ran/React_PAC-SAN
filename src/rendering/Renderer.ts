import {
  COLORS, GHOST_EAT_FREEZE_FRAMES, GHOST_SCORE_POPUP_FRAMES, MAZE_COLUMNS,
  MAZE_OFFSET_Y, MAZE_ROWS, SCREEN_HEIGHT, SCREEN_WIDTH, TILE_CENTER, TILE_SIZE,
} from '../config/constants';
import { getLevelConfig } from '../config/levelTables';
import type { GameEngine } from '../engine/GameEngine';
import { canPlayerEnter } from '../map/tileRules';
import { visibleDebugTarget } from './DebugTarget';
import { MazeRenderer } from './MazeRenderer';
import { pixelText } from './PixelText';
import { drawDyingPlayer, drawFruit, drawGhost, drawPlayer } from './SpriteRenderer';
import { FRUIT_POSITION } from '../systems/FruitSystem';

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
    if (engine.fruit.visible) drawFruit(ctx, engine.fruit.kind, FRUIT_POSITION.x, FRUIT_POSITION.y);
    const config = getLevelConfig(engine.level);
    const flash = engine.frightenedFramesRemaining > 0
      && engine.frightenedFramesRemaining <= config.frightenedFlashes * 24
      && Math.floor(engine.frightenedFramesRemaining / 12) % 2 === 0;
    if (engine.state !== 'PLAYER_DYING') {
      for (const ghost of engine.ghosts) drawGhost(ctx, ghost, flash);
      if (engine.ghostEatFreezeFrames === 0) drawPlayer(ctx, engine.player);
    } else drawDyingPlayer(ctx, engine.player, engine.stateFramesRemaining);
    for (let life = 0; life < Math.min(engine.lives - 1, 6); life++) {
      ctx.fillStyle = COLORS.player;
      ctx.beginPath();
      ctx.moveTo(12 + life * 15, 283);
      ctx.arc(12 + life * 15, 283, 5, 0.25 * Math.PI, 1.75 * Math.PI);
      ctx.closePath(); ctx.fill();
    }
    pixelText(ctx, `ROUND ${String(engine.level).padStart(2, '0')}`, SCREEN_WIDTH - 8, 278, COLORS.text, 'right');

    const message = {
      TITLE: 'PUSH ENTER', READY: 'READY', PLAYING: '', PAUSED: 'PAUSED',
      PLAYER_DYING: '', LEVEL_CLEAR: 'CLEAR', GAME_OVER: 'GAME OVER',
    }[engine.state];
    if (message) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(66, 159, 92, 13);
      pixelText(ctx, message, SCREEN_WIDTH / 2, 162, COLORS.player, 'center');
    }
    if (engine.debug) this.drawDebug(engine);
    this.drawGhostScorePopups(engine);
  }

  private drawGhostScorePopups(engine: GameEngine): void {
    const ctx = this.context;
    for (const [index, popup] of engine.ghostScorePopups.entries()) {
      const elapsed = GHOST_SCORE_POPUP_FRAMES - popup.framesRemaining;
      const rise = Math.floor(Math.max(0, elapsed - GHOST_EAT_FREEZE_FRAMES) / 8);
      const overlap = engine.ghostScorePopups.slice(0, index)
        .filter((earlier) => earlier.x === popup.x && earlier.y === popup.y).length;
      const y = popup.y + MAZE_OFFSET_Y - 4 - rise - overlap * 9;
      const width = String(popup.points).length * 6 - 1;
      ctx.save();
      ctx.globalAlpha = Math.min(1, popup.framesRemaining / 10);
      for (const offset of [-SCREEN_WIDTH, 0, SCREEN_WIDTH]) {
        const x = popup.x + offset;
        ctx.fillStyle = COLORS.background;
        ctx.fillRect(Math.round(x - width / 2) - 2, y - 1, width + 4, 9);
        pixelText(ctx, String(popup.points), x, y, '#a8ffff', 'center');
      }
      ctx.restore();
    }
  }

  private drawDebug(engine: GameEngine): void {
    const ctx = this.context;
    const display = engine.debugDisplay;
    ctx.save();
    if (display.mazeGrid) {
      ctx.strokeStyle = '#50d7bd44';
      ctx.lineWidth = 0.4;
      for (let y = 0; y < MAZE_ROWS; y++) {
        for (let x = 0; x < MAZE_COLUMNS; x++) {
          if (canPlayerEnter(x, y)) ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE + MAZE_OFFSET_Y, TILE_SIZE, TILE_SIZE);
        }
      }
    }
    if (display.playerCenter) {
      ctx.strokeStyle = COLORS.debug;
      const { x, y } = engine.player;
      ctx.strokeRect(x - 2, y + MAZE_OFFSET_Y - 2, 4, 4);
    }
    for (const ghost of engine.ghosts) {
      if (display.ghostTargets) {
        const targetX = ghost.targetTile.x * TILE_SIZE + TILE_CENTER;
        const targetY = ghost.targetTile.y * TILE_SIZE + TILE_CENTER + MAZE_OFFSET_Y;
        const visibleTarget = visibleDebugTarget(
          { x: ghost.x, y: ghost.y + MAZE_OFFSET_Y },
          { x: targetX, y: targetY },
        );
        ctx.strokeStyle = `${ghost.color}88`;
        ctx.beginPath();
        ctx.moveTo(ghost.x, ghost.y + MAZE_OFFSET_Y);
        ctx.lineTo(visibleTarget.x, visibleTarget.y);
        ctx.stroke();
        ctx.strokeRect(visibleTarget.x - 2.5, visibleTarget.y - 2.5, 5, 5);
      }

      if (display.directionChoices && ghost.lastDecision) {
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
