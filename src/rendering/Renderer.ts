import {
  COLORS, FRUIT_SCORE_POPUP_FRAMES, GHOST_EAT_FREEZE_FRAMES, GHOST_SCORE_POPUP_FRAMES, MAZE_COLUMNS,
  MAZE_OFFSET_Y, MAZE_ROWS, SCREEN_HEIGHT, SCREEN_WIDTH, TILE_CENTER, TILE_SIZE,
} from '../config/constants';
import { getLevelConfig } from '../config/levelTables';
import type { GameEngine } from '../engine/GameEngine';
import { canPlayerEnter } from '../map/tileRules';
import { visibleDebugTarget } from './DebugTarget';
import { drawCookie } from './CookieRenderer';
import { drawFruit } from './FruitSprites';
import { MazeRenderer } from './MazeRenderer';
import { pixelText } from './PixelText';
import { drawDyingPlayer, drawGhost, drawLifeIcon, drawPlayer, ghostVisualX } from './SpriteRenderer';
import { FRUIT_POSITION } from '../systems/FruitSystem';

export class Renderer {
  private maze = new MazeRenderer();

  constructor(private context: CanvasRenderingContext2D) {
    context.imageSmoothingEnabled = false;
  }

  draw(engine: GameEngine): void {
    const ctx = this.context;
    ctx.setTransform(ctx.canvas.width / SCREEN_WIDTH, 0, 0,
      ctx.canvas.height / SCREEN_HEIGHT, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    pixelText(ctx, '1UP', 8, 1, COLORS.text);
    pixelText(ctx, 'HIGH SCORE', 136, 1, COLORS.text, 'center');
    pixelText(ctx, String(engine.score).padStart(6, '0'), 8, 12, COLORS.text);
    pixelText(ctx, String(engine.highScore).padStart(6, '0'), 136, 12, COLORS.text, 'center');
    ctx.save();
    ctx.translate(0, MAZE_OFFSET_Y);
    const clearing = engine.state === 'LEVEL_CLEAR';
    const whiteWalls = clearing && engine.stateFramesRemaining <= 60
      && Math.floor(engine.stateFramesRemaining / 8) % 2 === 0;
    this.maze.draw(ctx, whiteWalls);
    // Draw every cookie in backing-store pixels. Fractional CSS scaling would
    // otherwise turn identical 2×2 cookies into different visible sizes.
    const cookieTransform = ctx.getTransform();
    const cookieScale = Math.min(cookieTransform.a, cookieTransform.d);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const [index, dot] of engine.maze.dots) {
      const x = (index % MAZE_COLUMNS) * TILE_SIZE + TILE_CENTER;
      const y = Math.floor(index / MAZE_COLUMNS) * TILE_SIZE + TILE_CENTER;
      const displayX = x * cookieTransform.a + cookieTransform.e;
      const displayY = y * cookieTransform.d + cookieTransform.f;
      if (dot === 'power') {
        if (engine.state !== 'PLAYING' || Math.floor(engine.playFrame / 10) % 2 === 0) {
          drawCookie(ctx, displayX, displayY, true, cookieScale);
        }
      } else drawCookie(ctx, displayX, displayY, false, cookieScale);
    }
    ctx.restore();
    ctx.restore();
    if (engine.fruit.visible) {
      drawFruit(ctx, engine.fruit.kind, FRUIT_POSITION.x, FRUIT_POSITION.y + MAZE_OFFSET_Y);
    }
    const config = getLevelConfig(engine.level);
    const flash = engine.frightenedFramesRemaining > 0
      && engine.frightenedFramesRemaining <= config.frightenedFlashes * 24
      && Math.floor(engine.frightenedFramesRemaining / 12) % 2 === 0;
    if (engine.state !== 'PLAYER_DYING') {
      if (!clearing) for (const ghost of engine.ghosts) drawGhost(ctx, ghost, flash);
      if (engine.ghostEatFreezeFrames === 0) drawPlayer(ctx, engine.player);
    } else drawDyingPlayer(ctx, engine.player, engine.stateFramesRemaining);
    for (let life = 0; engine.gameMode !== 'freeplay' && life < Math.min(engine.lives - 1, 6); life++) {
      drawLifeIcon(ctx, 12 + life * 15, SCREEN_HEIGHT - 7);
    }
    pixelText(ctx, `ROUND ${String(engine.level).padStart(2, '0')}`,
      SCREEN_WIDTH - 8, SCREEN_HEIGHT - 10, COLORS.text, 'right');

    const message = {
      TITLE: 'PUSH ENTER', READY: 'READY', PLAYING: '', PAUSED: 'PAUSED',
      PLAYER_DYING: '', LEVEL_CLEAR: '', GAME_OVER: 'GAME OVER',
    }[engine.state];
    if (message) {
      const width = message.length * 6 - 1;
      const left = Math.round((SCREEN_WIDTH - width) / 2);
      const top = 160;
      ctx.fillStyle = '#000000';
      ctx.fillRect(left - 3, top - 2, width + 6, 11);
      pixelText(ctx, message, SCREEN_WIDTH / 2, top, COLORS.player, 'center');
    }
    if (engine.debug) this.drawDebug(engine, flash);
    this.drawGhostScorePopups(engine);
    if (engine.state === 'PLAYING') this.drawFruitScorePopup(engine);
  }

  private drawFruitScorePopup(engine: GameEngine): void {
    const popup = engine.fruitScorePopup;
    if (!popup) return;
    const ctx = this.context;
    const label = `+${popup.points}`;
    const elapsed = FRUIT_SCORE_POPUP_FRAMES - popup.framesRemaining;
    const x = FRUIT_POSITION.x;
    const y = FRUIT_POSITION.y + MAZE_OFFSET_Y - 4 - Math.floor(elapsed / 12);
    const width = label.length * 6 - 1;
    ctx.save();
    ctx.globalAlpha = Math.min(1, popup.framesRemaining / 15);
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(Math.round(x - width / 2) - 2, y - 1, width + 4, 9);
    pixelText(ctx, label, x, y, '#ffb8ff', 'center');
    ctx.restore();
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

  private drawDebug(engine: GameEngine, flash: boolean): void {
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
      const visualX = ghostVisualX(ghost);
      const frightened = ghost.state === 'FRIGHTENED';
      const debugColor = frightened ? flash ? '#dedeff' : '#2121ff' : ghost.color;
      if (display.ghostTargets) {
        const targetX = ghost.targetTile.x * TILE_SIZE + TILE_CENTER;
        const targetY = ghost.targetTile.y * TILE_SIZE + TILE_CENTER + MAZE_OFFSET_Y;
        const visibleTarget = visibleDebugTarget(
          { x: visualX, y: ghost.y + MAZE_OFFSET_Y },
          { x: targetX, y: targetY },
        );
        ctx.strokeStyle = `${debugColor}88`;
        const dx = visibleTarget.x - visualX;
        const dy = visibleTarget.y - (ghost.y + MAZE_OFFSET_Y);
        const distance = Math.hypot(dx, dy);
        const spriteEdge = frightened ? 8 : 0;
        if (distance > spriteEdge) {
          ctx.beginPath();
          ctx.moveTo(visualX + dx / distance * spriteEdge,
            ghost.y + MAZE_OFFSET_Y + dy / distance * spriteEdge);
          ctx.lineTo(visibleTarget.x, visibleTarget.y);
          ctx.stroke();
        }
        ctx.strokeRect(visibleTarget.x - 2.5, visibleTarget.y - 2.5, 5, 5);
      }

      if (display.directionChoices && ghost.lastDecision) {
        ctx.fillStyle = debugColor;
        const markerDistance = frightened ? 9 : 5;
        for (const direction of ghost.lastDecision.candidates) {
          const vector = { up: [0, -1], left: [-1, 0], down: [0, 1], right: [1, 0] }[direction];
          ctx.fillRect(
            visualX + vector[0] * markerDistance - 0.75,
            ghost.y + MAZE_OFFSET_Y + vector[1] * markerDistance - 0.75,
            1.5,
            1.5,
          );
        }
      }
    }
    ctx.restore();
  }
}
