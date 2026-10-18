import {
  DYING_FRAMES, EXTRA_LIFE_SCORE, FRUIT_SCORE_POPUP_FRAMES,
  GHOST_EAT_FREEZE_FRAMES, GHOST_SCORE_POPUP_FRAMES,
  INITIAL_LIVES, LEVEL_CLEAR_FRAMES,
  NORMAL_DOT_FREEZE_FRAMES, POWER_DOT_FREEZE_FRAMES, READY_FRAMES,
  TILE_SIZE, TOTAL_DOTS, type Direction,
} from '../config/constants';
import { GHOST_HOUSE_LIMITS, getLevelConfig, type FruitKind } from '../config/levelTables';
import { PacSan } from '../entities/PacSan';
import { createGhosts, type Ghost } from '../entities/Ghost';
import { GhostHouse } from '../ai/GhostHouse';
import { ModeScheduler } from '../ai/ModeScheduler';
import { getGhostTarget } from '../ai/Targeting';
import { chooseNightmareDirection, planNightmareTargets } from '../ai/NightmareAI';
import { chooseAutoDirection, type AutoPlayLevel } from '../ai/AutoPlayer';
import { Maze } from '../map/maze';
import { moveGhost, movePlayer } from '../systems/MovementSystem';
import { pointsForDot } from '../systems/ScoreSystem';
import { FruitSystem } from '../systems/FruitSystem';
import { isAtTileCenter } from './CollisionSystem';
import type { GameState } from './GameState';
import { DEFAULT_DEBUG_DISPLAY, type DebugDisplayKey, type DebugDisplayOptions } from './DebugDisplay';
import { GameRandom } from './Random';
import { GameHistory } from './GameHistory';
import { DEFAULT_FREE_PLAY_SETTINGS, normalizeFreePlaySettings,
  type FreePlaySettings, type FreePlaySettingsInput, type GameMode,
  type GhostBehavior } from './GameModes';
import type { SoundCue } from './SoundCue';

export interface GhostScorePopup {
  readonly x: number;
  readonly y: number;
  readonly points: number;
  framesRemaining: number;
}

export interface FruitScorePopup {
  readonly points: number;
  framesRemaining: number;
}

export class GameEngine {
  state: GameState = 'TITLE';
  selectedMode: GameMode = 'arcade';
  gameMode: GameMode = 'arcade';
  freePlaySettings: FreePlaySettings = { ...DEFAULT_FREE_PLAY_SETTINGS };
  maze = new Maze();
  player = new PacSan();
  ghosts: Ghost[] = createGhosts();
  modeScheduler = new ModeScheduler();
  ghostHouse = new GhostHouse();
  fruit = new FruitSystem();
  collectedFruits: FruitKind[] = [];
  fruitPickupCount = 0;
  fruitScorePopup: FruitScorePopup | null = null;
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
  ghostEatFreezeFrames = 0;
  ghostScorePopups: GhostScorePopup[] = [];
  debug = false;
  debugDisplay: DebugDisplayOptions = { ...DEFAULT_DEBUG_DISPLAY };
  autoPlayLevel: AutoPlayLevel | null = null;
  autoPlayTarget: { x: number; y: number } | null = null;
  onSound: ((cue: SoundCue) => void) | null = null;
  readonly history = new GameHistory();
  private autoDecisionCenter: string | null = null;
  private autoRecentCenters: { x: number; y: number }[] = [];
  private pausedFrom: 'READY' | 'PLAYING' = 'PLAYING';

  constructor(highScore = 0) {
    this.highScore = highScore;
    this.fruit.reset(this.level);
  }

  configureStart(mode: GameMode, settings: FreePlaySettingsInput = this.freePlaySettings): void {
    if (this.state !== 'TITLE' && this.state !== 'GAME_OVER') return;
    this.selectedMode = mode;
    this.freePlaySettings = normalizeFreePlaySettings(settings);
  }

  returnToTitle(): void {
    if (this.state === 'TITLE' || this.state === 'GAME_OVER') return;
    this.history.recordEvent(this, 'return_to_title');
    this.state = 'TITLE';
    this.selectedMode = this.gameMode;
    this.ghostEatFreezeFrames = 0;
  }

  showStartPrompt(): void {
    if (this.state !== 'TITLE' && this.state !== 'GAME_OVER') return;
    this.resetForNewGame();
    this.state = 'TITLE';
  }

  start(): void {
    if (this.state !== 'TITLE' && this.state !== 'GAME_OVER') return;
    this.resetForNewGame();
    this.history.recordEvent(this, 'game_start', {
      mode: this.gameMode, startLevel: this.level, ghostCount: this.ghosts.length,
      ghostAI: this.ghostAI, ghostBehavior: this.ghostBehavior,
      ghostTargeting: JSON.stringify(this.freePlaySettings.ghostTargeting),
    });
    this.history.recordEvent(this, 'round_start', { reason: 'new_game' });
    this.history.recordFrame(this);
    this.onSound?.('start');
  }

  private resetForNewGame(): void {
    this.gameMode = this.selectedMode;
    this.level = this.gameMode === 'freeplay' ? this.freePlaySettings.startLevel : 1;
    this.lives = this.gameMode === 'freeplay' ? 0 : INITIAL_LIVES;
    this.extraLifeAwarded = false;
    this.score = 0;
    this.collectedFruits = [];
    this.fruitPickupCount = 0;
    this.frame = 0;
    this.playFrame = 0;
    this.beginRound(true, false);
  }

  get ghostAI(): 'arcade' | 'nightmare' {
    return this.gameMode === 'nightmare'
      || (this.gameMode === 'freeplay' && this.freePlaySettings.ghostAI === 'nightmare')
      ? 'nightmare' : 'arcade';
  }

  get ghostBehavior(): GhostBehavior {
    return this.gameMode === 'freeplay' ? this.freePlaySettings.ghostBehavior : 'standard';
  }

  private beginRound(newMaze: boolean, afterDeath: boolean): void {
    if (newMaze) this.maze = new Maze();
    this.player = new PacSan();
    this.ghosts = createGhosts().slice(0,
      this.gameMode === 'freeplay' ? this.freePlaySettings.ghostCount : 4);
    this.modeScheduler.setSchedule(this.ghostBehavior === 'standard'
      ? getLevelConfig(this.level).modeSchedule
      : [{ mode: this.ghostBehavior === 'chase' ? 'CHASE' : 'SCATTER', durationFrames: null }]);
    for (const ghost of this.ghosts) ghost.mode = this.modeScheduler.mode;
    this.ghostHouse.reset(this.level);
    if (afterDeath) this.ghostHouse.onLifeLost();
    if (newMaze) this.fruit.reset(this.level);
    else this.fruit.hide();
    this.random.reset();
    this.readyFrames = READY_FRAMES;
    this.stateFramesRemaining = 0;
    this.frightenedFramesRemaining = 0;
    this.ghostCombo = 0;
    this.ghostEatFreezeFrames = 0;
    this.ghostScorePopups = [];
    this.fruitScorePopup = null;
    this.autoPlayTarget = null;
    this.autoDecisionCenter = null;
    this.autoRecentCenters = [];
    this.state = 'READY';
  }

  requestDirection(direction: Direction): void {
    if (this.state === 'READY' || this.state === 'PLAYING' || this.state === 'PAUSED') {
      this.setAutoPlayLevel(null);
      this.player.requestedDirection = direction;
      this.history.recordEvent(this, 'manual_input', { direction });
    }
  }

  setAutoPlayLevel(level: AutoPlayLevel | null): void {
    if (level && !this.debug) return;
    if (this.autoPlayLevel !== level) {
      this.history.recordEvent(this, 'auto_play_changed', { from: this.autoPlayLevel, to: level });
    }
    this.autoPlayLevel = level;
    this.autoPlayTarget = null;
    this.autoDecisionCenter = null;
    this.autoRecentCenters = [];
    if (level) this.player.requestedDirection = this.player.direction;
  }

  togglePause(): void {
    if (this.state === 'PAUSED') {
      this.state = this.pausedFrom;
      this.history.recordEvent(this, 'resume');
    }
    else if (this.state === 'READY' || this.state === 'PLAYING') {
      this.pausedFrom = this.state;
      this.state = 'PAUSED';
      this.history.recordEvent(this, 'pause');
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

  setHistoryRecording(recording: boolean): void {
    if (recording) this.history.start(this);
    else this.history.stop();
  }

  update(): void {
    const previousFrame = this.frame;
    this.advanceFrame();
    if (this.frame !== previousFrame) this.history.recordFrame(this);
  }

  private advanceFrame(): void {
    if (this.state === 'TITLE' || this.state === 'PAUSED' || this.state === 'GAME_OVER') return;
    this.frame++;
    if (this.state === 'PLAYER_DYING' || this.state === 'LEVEL_CLEAR') {
      if (--this.stateFramesRemaining <= 0) {
        if (this.state === 'PLAYER_DYING') {
          if (this.gameMode === 'freeplay' || this.lives > 0) {
            this.beginRound(false, true);
            this.history.recordEvent(this, 'round_start', { reason: 'respawn' });
          } else {
            this.state = 'GAME_OVER';
            this.history.recordEvent(this, 'game_over', { score: this.score });
          }
        } else {
          this.level++;
          this.beginRound(true, false);
          this.history.recordEvent(this, 'round_start', { reason: 'next_round' });
        }
      }
      return;
    }
    if (this.state === 'READY') {
      if (--this.readyFrames <= 0) this.state = 'PLAYING';
      return;
    }
    this.ghostScorePopups = this.ghostScorePopups.filter((popup) => --popup.framesRemaining > 0);
    if (this.fruitScorePopup && --this.fruitScorePopup.framesRemaining <= 0) {
      this.fruitScorePopup = null;
    }
    if (this.ghostEatFreezeFrames > 0) {
      this.ghostEatFreezeFrames--;
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
    } else if (this.modeScheduler.tick() && this.ghostAI !== 'nightmare') {
      for (const ghost of this.ghosts) ghost.requestReverse();
    }
    for (const ghost of this.ghosts) ghost.mode = this.modeScheduler.mode;
    this.fruit.tick();

    const decideAutoAtCenter = (): void => {
      if (!this.autoPlayLevel) return;
      if (isAtTileCenter(this.player)) {
        const center = `${this.player.x},${this.player.y}`;
        if (center !== this.autoDecisionCenter) {
          const decision = chooseAutoDirection(this.player, this.ghosts, this.maze, this.autoPlayLevel, {
            round: this.level,
            frightenedFramesRemaining: this.frightenedFramesRemaining,
            fruit: this.fruit,
            elroyStage: this.elroyStage,
            committedTarget: this.autoPlayLevel === 'tas' ? this.autoPlayTarget : null,
            recentCenters: this.autoRecentCenters,
          });
          if (decision) {
            this.player.requestedDirection = decision.direction;
            this.autoPlayTarget = decision.target;
          }
          this.history.recordEvent(this, 'auto_decision', {
            x: this.player.x, y: this.player.y,
            direction: decision?.direction ?? null,
            targetX: decision?.target.x ?? null,
            targetY: decision?.target.y ?? null,
          });
          this.autoDecisionCenter = center;
          this.autoRecentCenters.push({
            x: Math.floor(this.player.x / TILE_SIZE),
            y: Math.floor(this.player.y / TILE_SIZE),
          });
          if (this.autoRecentCenters.length > 12) this.autoRecentCenters.shift();
        }
      } else this.autoDecisionCenter = null;
    };
    decideAutoAtCenter();
    // Check each center crossed, including the first pixel of a two-pixel
    // update; a diagonal corner may also cross a dot tile off-center.
    let completedLevel = false;
    const consumeAtPlayer = (turnedThisStep = false): boolean => {
      // A pre-turn crosses the junction tile diagonally without visiting its
      // center pixel. Check the completion pixel too: turning is cleared there.
      if (!isAtTileCenter(this.player) && !this.player.turning && !turnedThisStep) return false;
      const dot = this.maze.consumeAt(this.player.x, this.player.y);
      if (dot) {
        this.addScore(pointsForDot(dot));
        this.history.recordEvent(this, 'dot_collected', {
          x: this.player.x, y: this.player.y,
          kind: dot, points: pointsForDot(dot), remainingDots: this.maze.remainingDots,
        });
        this.ghostHouse.onDotConsumed();
        this.player.freezeFrames = dot === 'power' ? POWER_DOT_FREEZE_FRAMES : NORMAL_DOT_FREEZE_FRAMES;
        const fruitWasVisible = this.fruit.visible;
        this.fruit.onDotCollected(this.maze.remainingDots, this.random);
        if (!fruitWasVisible && this.fruit.visible) {
          this.history.recordEvent(this, 'fruit_spawned', {
            kind: this.fruit.kind, points: this.fruit.points,
            framesRemaining: this.fruit.framesRemaining,
          });
        }
        if (dot === 'power') this.activateFrightened(config.frightenedFrames);
        if (this.maze.remainingDots === 0) {
          this.state = 'LEVEL_CLEAR';
          this.stateFramesRemaining = LEVEL_CLEAR_FRAMES;
          this.fruit.hide();
          completedLevel = true;
          this.history.recordEvent(this, 'round_clear', { score: this.score });
        }
        this.onSound?.(completedLevel ? 'levelClear' : dot === 'power' ? 'power' : 'dot');
        return true;
      }
      return false;
    };
    movePlayer(this.player, this.frightenedFramesRemaining > 0
      ? config.frightenedPlayerSpeedPercent : config.playerSpeedPercent, (turnedThisStep) => {
        const consumed = consumeAtPlayer(turnedThisStep);
        if (!consumed) decideAutoAtCenter();
        return consumed;
      });
    if (completedLevel) return;
    consumeAtPlayer();
    if (completedLevel) return;

    const fruitPoints = this.fruit.collectAt(this.player.x, this.player.y);
    if (fruitPoints > 0) {
      this.addScore(fruitPoints);
      this.fruitPickupCount++;
      this.collectedFruits.unshift(this.fruit.kind);
      this.collectedFruits.length = Math.min(this.collectedFruits.length, 7);
      this.fruitScorePopup = { points: fruitPoints, framesRemaining: FRUIT_SCORE_POPUP_FRAMES };
      this.history.recordEvent(this, 'fruit_collected', {
        kind: this.fruit.kind, points: fruitPoints,
        x: this.player.x, y: this.player.y,
      });
      this.onSound?.('fruit');
    }
    if (this.resolveGhostContacts()) return;
    const blinky = this.ghosts.find((ghost) => ghost.id === 'blinky')!;
    const nightmareTargets = this.ghostAI === 'nightmare' && this.ghostBehavior !== 'scatter'
      ? planNightmareTargets(this.player, this.ghosts) : null;
    for (const ghost of this.ghosts) {
      if (ghost.houseState !== 'OUTSIDE') continue;
      const chaseStyle = this.gameMode === 'freeplay'
        ? this.freePlaySettings.ghostTargeting[ghost.id] : ghost.id;
      ghost.targetTile = ghost.state === 'EATEN'
        ? { x: 13, y: 11 }
        : ghost.state === 'NORMAL' && nightmareTargets
          ? nightmareTargets.get(ghost.id) ?? getGhostTarget(ghost, this.player, blinky)
          : getGhostTarget(ghost, this.player, blinky, ghost.id === 'blinky'
            && this.elroyStage > 0 && this.ghostBehavior !== 'scatter', chaseStyle);
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
      const previousDecision = ghost.lastDecision;
      moveGhost(ghost, speed, this.random,
        this.ghostAI === 'nightmare' && this.ghostBehavior !== 'scatter'
          ? chooseNightmareDirection : undefined);
      if (ghost.lastDecision && ghost.lastDecision !== previousDecision) {
        this.history.recordEvent(this, 'ghost_decision', {
          ghost: ghost.id,
          tileX: ghost.lastDecision.tile.x,
          tileY: ghost.lastDecision.tile.y,
          candidates: ghost.lastDecision.candidates.join(','),
          chosen: ghost.lastDecision.chosen,
          targetX: ghost.targetTile.x,
          targetY: ghost.targetTile.y,
        });
      }
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
        const points = 200 * 2 ** Math.min(this.ghostCombo, 3);
        this.addScore(points);
        this.history.recordEvent(this, 'ghost_eaten', {
          ghost: ghost.id, points, x: ghost.x, y: ghost.y,
        });
        this.onSound?.('ghost');
        this.ghostScorePopups.push({
          x: ghost.x, y: ghost.y, points,
          framesRemaining: GHOST_SCORE_POPUP_FRAMES,
        });
        this.ghostEatFreezeFrames = GHOST_EAT_FREEZE_FRAMES;
        this.ghostCombo++;
      } else {
        this.ghostEatFreezeFrames = 0;
        this.ghostScorePopups = [];
        this.fruitScorePopup = null;
        if (this.gameMode !== 'freeplay') this.lives--;
        this.state = 'PLAYER_DYING';
        this.history.recordEvent(this, 'life_lost', {
          ghost: ghost.id, livesRemaining: this.lives,
          x: this.player.x, y: this.player.y,
        });
        this.stateFramesRemaining = DYING_FRAMES;
        this.fruit.hide();
        this.onSound?.('death');
        this.autoPlayTarget = null;
        return true;
      }
    }
    return false;
  }

  private addScore(points: number): void {
    if (points <= 0) return;
    this.score += points;
    if (this.gameMode !== 'freeplay') this.highScore = Math.max(this.highScore, this.score);
    if (this.gameMode !== 'freeplay' && !this.extraLifeAwarded && this.score >= EXTRA_LIFE_SCORE) {
      this.lives++;
      this.extraLifeAwarded = true;
      this.history.recordEvent(this, 'extra_life', { lives: this.lives });
      this.onSound?.('extraLife');
    }
  }

  snapshot() {
    return {
      state: this.state, score: this.score, highScore: this.highScore,
      gameMode: this.gameMode, selectedMode: this.selectedMode, ghostAI: this.ghostAI,
      freePlaySettings: { ...this.freePlaySettings,
        ghostTargeting: { ...this.freePlaySettings.ghostTargeting } },
      lives: this.lives, stateFramesRemaining: this.stateFramesRemaining,
      frightenedFramesRemaining: this.frightenedFramesRemaining,
      ghostCombo: this.ghostCombo, randomState: this.random.state,
      ghostEatFreezeFrames: this.ghostEatFreezeFrames,
      ghostScorePopups: this.ghostScorePopups.map((popup) => ({ ...popup })),
      elroyStage: this.elroyStage,
      fruit: { kind: this.fruit.kind, points: this.fruit.points,
        visible: this.fruit.visible, framesRemaining: this.fruit.framesRemaining,
        spawnedCount: this.fruit.spawnedCount },
      collectedFruits: [...this.collectedFruits],
      fruitPickupCount: this.fruitPickupCount,
      fruitScorePopup: this.fruitScorePopup ? { ...this.fruitScorePopup } : null,
      level: this.level, frame: this.frame, playFrame: this.playFrame,
      remainingDots: this.maze.remainingDots,
      collectedDots: TOTAL_DOTS - this.maze.remainingDots,
      player: {
        ...this.player,
        turning: this.player.turning ? { ...this.player.turning } : null,
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
      history: this.history.summary,
    };
  }
}
