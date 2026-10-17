import {
  NORMAL_DOT_FREEZE_FRAMES, POWER_DOT_FREEZE_FRAMES, READY_FRAMES,
  TILE_SIZE, TOTAL_DOTS, type Direction,
} from '../config/constants';
import { PacSan } from '../entities/PacSan';
import { Maze } from '../map/maze';
import { movePlayer } from '../systems/MovementSystem';
import { pointsForDot } from '../systems/ScoreSystem';
import { isAtTileCenter } from './CollisionSystem';
import type { GameState } from './GameState';

export class GameEngine {
  state: GameState = 'TITLE';
  maze = new Maze();
  player = new PacSan();
  score = 0;
  highScore: number;
  readonly level = 1;
  frame = 0;
  playFrame = 0;
  readyFrames = 0;
  debug = false;
  private pausedFrom: 'READY' | 'PLAYING' = 'PLAYING';

  constructor(highScore = 0) { this.highScore = highScore; }

  start(): void {
    if (this.state !== 'TITLE' && this.state !== 'LEVEL_CLEAR') return;
    this.maze = new Maze();
    this.player = new PacSan();
    this.score = 0;
    this.frame = 0;
    this.playFrame = 0;
    this.readyFrames = READY_FRAMES;
    this.state = 'READY';
  }

  requestDirection(direction: Direction): void {
    if (this.state === 'READY' || this.state === 'PLAYING' || this.state === 'PAUSED') {
      this.player.requestedDirection = direction;
    }
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

  toggleDebug(): void { this.debug = !this.debug; }

  update(): void {
    if (this.state === 'TITLE' || this.state === 'PAUSED' || this.state === 'LEVEL_CLEAR') return;
    this.frame++;
    if (this.state === 'READY') {
      if (--this.readyFrames <= 0) this.state = 'PLAYING';
      return;
    }
    this.playFrame++;
    movePlayer(this.player);
    // Phase 1 compatibility: consume at the corridor center, not on tile entry.
    if (isAtTileCenter(this.player)) {
      const dot = this.maze.consumeAt(this.player.x, this.player.y);
      if (dot) {
        this.score += pointsForDot(dot);
        this.highScore = Math.max(this.highScore, this.score);
        this.player.freezeFrames = dot === 'power' ? POWER_DOT_FREEZE_FRAMES : NORMAL_DOT_FREEZE_FRAMES;
        if (this.maze.remainingDots === 0) this.state = 'LEVEL_CLEAR';
      }
    }
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
      debug: this.debug,
    };
  }
}
