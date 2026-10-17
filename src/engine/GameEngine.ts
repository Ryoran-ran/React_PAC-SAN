import {
  NORMAL_DOT_FREEZE_FRAMES, POWER_DOT_FREEZE_FRAMES, READY_FRAMES,
  TILE_SIZE, TOTAL_DOTS, type Direction,
} from '../config/constants';
import { PacSan } from '../entities/PacSan';
import { createGhosts, type Ghost } from '../entities/Ghost';
import { GhostHouse } from '../ai/GhostHouse';
import { ModeScheduler } from '../ai/ModeScheduler';
import { getGhostTarget } from '../ai/Targeting';
import { chooseAutoDirection, type AutoPlayLevel } from '../ai/AutoPlayer';
import { Maze } from '../map/maze';
import { moveGhost, movePlayer } from '../systems/MovementSystem';
import { pointsForDot } from '../systems/ScoreSystem';
import { isAtTileCenter } from './CollisionSystem';
import type { GameState } from './GameState';

export class GameEngine {
  state: GameState = 'TITLE';
  maze = new Maze();
  player = new PacSan();
  ghosts: Ghost[] = createGhosts();
  modeScheduler = new ModeScheduler();
  ghostHouse = new GhostHouse();
  score = 0;
  highScore: number;
  readonly level = 1;
  frame = 0;
  playFrame = 0;
  readyFrames = 0;
  debug = false;
  autoPlayLevel: AutoPlayLevel | null = null;
  autoPlayTarget: { x: number; y: number } | null = null;
  private autoDecisionCenter: string | null = null;
  private pausedFrom: 'READY' | 'PLAYING' = 'PLAYING';

  constructor(highScore = 0) { this.highScore = highScore; }

  start(): void {
    if (this.state !== 'TITLE' && this.state !== 'LEVEL_CLEAR') return;
    this.maze = new Maze();
    this.player = new PacSan();
    this.ghosts = createGhosts();
    this.modeScheduler.reset();
    this.ghostHouse.reset();
    this.score = 0;
    this.frame = 0;
    this.playFrame = 0;
    this.readyFrames = READY_FRAMES;
    this.autoPlayTarget = null;
    this.autoDecisionCenter = null;
    this.state = 'READY';
  }

  requestDirection(direction: Direction): void {
    if (this.state === 'READY' || this.state === 'PLAYING' || this.state === 'PAUSED') {
      this.setAutoPlayLevel(null);
      this.player.requestedDirection = direction;
    }
  }

  setAutoPlayLevel(level: AutoPlayLevel | null): void {
    if (level && !this.debug) return;
    this.autoPlayLevel = level;
    this.autoPlayTarget = null;
    this.autoDecisionCenter = null;
    if (level) this.player.requestedDirection = this.player.direction;
  }

  togglePause(): void {
    if (this.state === 'PAUSED') this.state = this.pausedFrom;
    else if (this.state === 'READY' || this.state === 'PLAYING') {
      this.pausedFrom = this.state;
      this.state = 'PAUSED';
    }
  }

  pause(): void {
    if (this.state === 'READY' || this.state === 'PLAYING') this.togglePause();
  }

  toggleDebug(): void {
    this.debug = !this.debug;
    if (!this.debug) this.setAutoPlayLevel(null);
  }

  update(): void {
    if (this.state === 'TITLE' || this.state === 'PAUSED' || this.state === 'LEVEL_CLEAR') return;
    this.frame++;
    if (this.state === 'READY') {
      if (--this.readyFrames <= 0) this.state = 'PLAYING';
      return;
    }
    this.playFrame++;

    if (this.modeScheduler.tick()) {
      for (const ghost of this.ghosts) ghost.requestReverse();
    }
    for (const ghost of this.ghosts) ghost.mode = this.modeScheduler.mode;

    if (this.autoPlayLevel) {
      if (isAtTileCenter(this.player)) {
        const center = `${this.player.x},${this.player.y}`;
        if (center !== this.autoDecisionCenter) {
          const decision = chooseAutoDirection(this.player, this.ghosts, this.maze, this.autoPlayLevel);
          if (decision) {
            this.player.requestedDirection = decision.direction;
            this.autoPlayTarget = decision.target;
          }
          this.autoDecisionCenter = center;
        }
      } else this.autoDecisionCenter = null;
    }
    movePlayer(this.player);
    // Phase 1 compatibility: consume at the corridor center, not on tile entry.
    if (isAtTileCenter(this.player)) {
      const dot = this.maze.consumeAt(this.player.x, this.player.y);
      if (dot) {
        this.score += pointsForDot(dot);
        this.highScore = Math.max(this.highScore, this.score);
        this.ghostHouse.onDotConsumed();
        this.player.freezeFrames = dot === 'power' ? POWER_DOT_FREEZE_FRAMES : NORMAL_DOT_FREEZE_FRAMES;
        if (this.maze.remainingDots === 0) this.state = 'LEVEL_CLEAR';
      }
    }

    if (this.state !== 'PLAYING') return;
    const blinky = this.ghosts.find((ghost) => ghost.id === 'blinky')!;
    for (const ghost of this.ghosts) {
      if (ghost.houseState !== 'OUTSIDE') continue;
      ghost.targetTile = getGhostTarget(ghost, this.player, blinky);
    }
    for (const ghost of this.ghosts) {
      if (ghost.houseState !== 'OUTSIDE') continue;
      moveGhost(ghost);
    }
    this.ghostHouse.update(this.ghosts);
  }

  snapshot() {
    return {
      state: this.state, score: this.score, highScore: this.highScore,
      level: this.level, frame: this.frame, playFrame: this.playFrame,
      remainingDots: this.maze.remainingDots,
      collectedDots: TOTAL_DOTS - this.maze.remainingDots,
      player: {
        ...this.player,
        tileX: Math.floor(this.player.x / TILE_SIZE),
        tileY: Math.floor(this.player.y / TILE_SIZE),
      },
      ghostMode: this.modeScheduler.mode,
      ghostModeFramesRemaining: this.modeScheduler.remainingFrames,
      ghostHouse: {
        dotCounter: this.ghostHouse.dotCounter,
        idleFrames: this.ghostHouse.idleFrames,
      },
      autoPlayLevel: this.autoPlayLevel,
      autoPlayTarget: this.autoPlayTarget ? { ...this.autoPlayTarget } : null,
      ghosts: this.ghosts.map((ghost) => ({
        id: ghost.id,
        displayName: ghost.displayName,
        color: ghost.color,
        x: ghost.x,
        y: ghost.y,
        tileX: Math.floor(ghost.x / TILE_SIZE),
        tileY: Math.floor(ghost.y / TILE_SIZE),
        direction: ghost.direction,
        mode: ghost.mode,
        houseState: ghost.houseState,
        targetTile: { ...ghost.targetTile },
        pendingReverse: ghost.pendingReverse,
        moving: ghost.moving,
        lastDecision: ghost.lastDecision ? {
          tile: { ...ghost.lastDecision.tile },
          candidates: [...ghost.lastDecision.candidates],
          chosen: ghost.lastDecision.chosen,
        } : null,
      })),
      debug: this.debug,
    };
  }
}
