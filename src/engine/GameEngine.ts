import {
  DYING_FRAMES, EXTRA_LIFE_SCORE, INITIAL_LIVES, LEVEL_CLEAR_FRAMES,
  NORMAL_DOT_FREEZE_FRAMES, POWER_DOT_FREEZE_FRAMES, READY_FRAMES,
  TILE_SIZE, TOTAL_DOTS, type Direction,
} from '../config/constants';
import { GHOST_HOUSE_LIMITS, getLevelConfig } from '../config/levelTables';
import { PacSan } from '../entities/PacSan';
import { createGhosts, type Ghost } from '../entities/Ghost';
import { GhostHouse } from '../ai/GhostHouse';
import { ModeScheduler } from '../ai/ModeScheduler';
import { getGhostTarget } from '../ai/Targeting';
import { chooseAutoDirection, type AutoPlayLevel } from '../ai/AutoPlayer';
import { Maze } from '../map/maze';
import { moveGhost, movePlayer } from '../systems/MovementSystem';
import { pointsForDot } from '../systems/ScoreSystem';
import { FruitSystem } from '../systems/FruitSystem';
import { isAtTileCenter } from './CollisionSystem';
import type { GameState } from './GameState';
import { DEFAULT_DEBUG_DISPLAY, type DebugDisplayKey, type DebugDisplayOptions } from './DebugDisplay';
import { GameRandom } from './Random';

export class GameEngine {
  state: GameState = 'TITLE';
  maze = new Maze();
  player = new PacSan();
  ghosts: Ghost[] = createGhosts();
  modeScheduler = new ModeScheduler();
  ghostHouse = new GhostHouse();
  fruit = new FruitSystem();
  random = new GameRandom();
  score = 0;
  highScore: number;
  level = 1;
  lives = INITIAL_LIVES;
  extraLifeAwarded = false;
  frame = 0;
  playFrame = 0;
  readyFrames = 0;
  stateFramesRemaining = 0;
  frightenedFramesRemaining = 0;
  ghostCombo = 0;
  debug = false;
  debugDisplay: DebugDisplayOptions = { ...DEFAULT_DEBUG_DISPLAY };
  autoPlayLevel: AutoPlayLevel | null = null;
  autoPlayTarget: { x: number; y: number } | null = null;
  private autoDecisionCenter: string | null = null;
  private pausedFrom: 'READY' | 'PLAYING' = 'PLAYING';

  constructor(highScore = 0) {
    this.highScore = highScore;
    this.fruit.reset(this.level);
  }

  start(): void {
    if (this.state !== 'TITLE' && this.state !== 'GAME_OVER') return;
    this.level = 1;
    this.lives = INITIAL_LIVES;
    this.extraLifeAwarded = false;
    this.score = 0;
    this.frame = 0;
    this.playFrame = 0;
    this.beginRound(true, false);
  }

  private beginRound(newMaze: boolean, afterDeath: boolean): void {
    if (newMaze) this.maze = new Maze();
    this.player = new PacSan();
    this.ghosts = createGhosts();
    this.modeScheduler.setSchedule(getLevelConfig(this.level).modeSchedule);
    this.ghostHouse.reset(this.level);
    if (afterDeath) this.ghostHouse.onLifeLost();
    if (newMaze) this.fruit.reset(this.level);
    else this.fruit.hide();
    this.random.reset();
    this.readyFrames = READY_FRAMES;
    this.stateFramesRemaining = 0;
    this.frightenedFramesRemaining = 0;
    this.ghostCombo = 0;
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

  setDebugDisplayOption(key: DebugDisplayKey, visible: boolean): void {
    this.debugDisplay[key] = visible;
  }

  update(): void {
    if (this.state === 'TITLE' || this.state === 'PAUSED' || this.state === 'GAME_OVER') return;
    this.frame++;
    if (this.state === 'PLAYER_DYING' || this.state === 'LEVEL_CLEAR') {
      if (--this.stateFramesRemaining <= 0) {
        if (this.state === 'PLAYER_DYING') {
          if (this.lives > 0) this.beginRound(false, true);
          else this.state = 'GAME_OVER';
        } else {
          this.level++;
          this.beginRound(true, false);
        }
      }
      return;
    }
    if (this.state === 'READY') {
      if (--this.readyFrames <= 0) this.state = 'PLAYING';
      return;
    }
    this.playFrame++;
    const config = getLevelConfig(this.level);

    if (this.frightenedFramesRemaining > 0) {
      if (--this.frightenedFramesRemaining === 0) {
        for (const ghost of this.ghosts) {
          if (ghost.state === 'FRIGHTENED') ghost.state = 'NORMAL';
        }
        this.ghostCombo = 0;
      }
    } else if (this.modeScheduler.tick()) {
      for (const ghost of this.ghosts) ghost.requestReverse();
    }
    for (const ghost of this.ghosts) ghost.mode = this.modeScheduler.mode;
    this.fruit.tick();

    const decideAutoAtCenter = (): void => {
      if (!this.autoPlayLevel) return;
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
    };
    decideAutoAtCenter();
    // Consume at each corridor center crossed, including the first pixel of a
    // two-pixel update. Keep the stationary-center check for zero-step frames.
    let completedLevel = false;
    const consumeAtCenter = (): boolean => {
      if (!isAtTileCenter(this.player)) return false;
      const dot = this.maze.consumeAt(this.player.x, this.player.y);
      if (dot) {
        this.addScore(pointsForDot(dot));
        this.ghostHouse.onDotConsumed();
        this.player.freezeFrames = dot === 'power' ? POWER_DOT_FREEZE_FRAMES : NORMAL_DOT_FREEZE_FRAMES;
        this.fruit.onDotCollected(this.maze.remainingDots, this.random);
        if (dot === 'power') this.activateFrightened(config.frightenedFrames);
        if (this.maze.remainingDots === 0) {
          this.state = 'LEVEL_CLEAR';
          this.stateFramesRemaining = LEVEL_CLEAR_FRAMES;
          this.fruit.hide();
          completedLevel = true;
        }
        return true;
      }
      return false;
    };
    movePlayer(this.player, this.frightenedFramesRemaining > 0
      ? config.frightenedPlayerSpeedPercent : config.playerSpeedPercent, () => {
        const consumed = consumeAtCenter();
        if (!consumed) decideAutoAtCenter();
        return consumed;
      });
    if (completedLevel) return;
    consumeAtCenter();
    if (completedLevel) return;

    this.addScore(this.fruit.collectAt(this.player.x, this.player.y));
    if (this.resolveGhostContacts()) return;
    const blinky = this.ghosts.find((ghost) => ghost.id === 'blinky')!;
    for (const ghost of this.ghosts) {
      if (ghost.houseState !== 'OUTSIDE') continue;
      ghost.targetTile = ghost.state === 'EATEN'
        ? { x: 13, y: 11 }
        : getGhostTarget(ghost, this.player, blinky, ghost.id === 'blinky' && this.elroyStage > 0);
    }
    for (const ghost of this.ghosts) {
      if (ghost.houseState !== 'OUTSIDE') continue;
      const tileX = Math.floor(ghost.x / TILE_SIZE);
      const tileY = Math.floor(ghost.y / TILE_SIZE);
      const inTunnel = tileY === 14 && (tileX < 6 || tileX > 21);
      const speed = ghost.state === 'EATEN' ? 200
        : ghost.state === 'FRIGHTENED' ? config.frightenedGhostSpeedPercent
          : inTunnel ? config.ghostTunnelSpeedPercent
            : ghost.id === 'blinky' && this.elroyStage > 0
              ? config.elroySpeedPercent[this.elroyStage - 1] : config.ghostSpeedPercent;
      moveGhost(ghost, speed, this.random);
      if (ghost.state === 'EATEN' && ghost.x === GHOST_HOUSE_LIMITS.exitX
        && ghost.y === GHOST_HOUSE_LIMITS.exitY) {
        ghost.houseState = 'RETURNING_HOME';
        ghost.lastDecision = null;
      }
    }
    this.ghostHouse.update(this.ghosts);
    this.resolveGhostContacts();
  }

  get elroyStage(): 0 | 1 | 2 {
    const clyde = this.ghosts.find((ghost) => ghost.id === 'clyde');
    if (clyde?.houseState !== 'OUTSIDE') return 0;
    const [first, second] = getLevelConfig(this.level).elroyDots;
    return this.maze.remainingDots <= second ? 2 : this.maze.remainingDots <= first ? 1 : 0;
  }

  private activateFrightened(frames: number): void {
    this.frightenedFramesRemaining = frames;
    this.ghostCombo = 0;
    for (const ghost of this.ghosts) {
      if (ghost.state === 'EATEN') continue;
      ghost.state = frames > 0 ? 'FRIGHTENED' : 'NORMAL';
      ghost.requestReverse();
    }
  }

  private resolveGhostContacts(): boolean {
    const playerTileX = Math.floor(this.player.x / TILE_SIZE);
    const playerTileY = Math.floor(this.player.y / TILE_SIZE);
    for (const ghost of this.ghosts) {
      if (ghost.houseState !== 'OUTSIDE' || ghost.state === 'EATEN'
        || Math.floor(ghost.x / TILE_SIZE) !== playerTileX
        || Math.floor(ghost.y / TILE_SIZE) !== playerTileY) continue;
      if (ghost.state === 'FRIGHTENED') {
        ghost.state = 'EATEN';
        ghost.targetTile = { x: 13, y: 11 };
        ghost.requestReverse();
        this.addScore(200 * 2 ** Math.min(this.ghostCombo, 3));
        this.ghostCombo++;
      } else {
        this.lives--;
        this.state = 'PLAYER_DYING';
        this.stateFramesRemaining = DYING_FRAMES;
        this.fruit.hide();
        this.autoPlayTarget = null;
        return true;
      }
    }
    return false;
  }

  private addScore(points: number): void {
    if (points <= 0) return;
    this.score += points;
    this.highScore = Math.max(this.highScore, this.score);
    if (!this.extraLifeAwarded && this.score >= EXTRA_LIFE_SCORE) {
      this.lives++;
      this.extraLifeAwarded = true;
    }
  }

  snapshot() {
    return {
      state: this.state, score: this.score, highScore: this.highScore,
      lives: this.lives, stateFramesRemaining: this.stateFramesRemaining,
      frightenedFramesRemaining: this.frightenedFramesRemaining,
      ghostCombo: this.ghostCombo, randomState: this.random.state,
      elroyStage: this.elroyStage,
      fruit: { kind: this.fruit.kind, points: this.fruit.points,
        visible: this.fruit.visible, framesRemaining: this.fruit.framesRemaining,
        spawnedCount: this.fruit.spawnedCount },
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
        state: ghost.state,
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
      debugDisplay: { ...this.debugDisplay },
    };
  }
}
