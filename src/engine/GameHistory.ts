import { FIXED_FPS, TILE_SIZE } from '../config/constants';
import type { GameEngine } from './GameEngine';

export const MAX_HISTORY_FRAMES = FIXED_FPS * 60 * 10;
const TRIM_HISTORY_FRAMES = FIXED_FPS * 10;
const MAX_HISTORY_EVENTS = MAX_HISTORY_FRAMES * 2;
const TRIM_HISTORY_EVENTS = FIXED_FPS * 10;

export type HistoryEventKind =
  | 'game_start' | 'round_start' | 'round_clear' | 'game_over'
  | 'manual_input' | 'auto_play_changed' | 'auto_decision' | 'pause' | 'resume'
  | 'dot_collected' | 'fruit_spawned' | 'fruit_collected'
  | 'ghost_decision' | 'ghost_eaten' | 'life_lost' | 'extra_life';

export interface HistoryEvent {
  readonly sequence: number;
  readonly frame: number;
  readonly playFrame: number;
  readonly level: number;
  readonly kind: HistoryEventKind;
  readonly detail: Record<string, string | number | boolean | null>;
}

function captureFrame(engine: GameEngine, sequence: number) {
  return {
    sequence,
    frame: engine.frame,
    playFrame: engine.playFrame,
    level: engine.level,
    state: engine.state,
    score: engine.score,
    lives: engine.lives,
    remainingDots: engine.maze.remainingDots,
    randomState: engine.random.state,
    ghostMode: engine.modeScheduler.mode,
    ghostModeFramesRemaining: engine.modeScheduler.remainingFrames,
    frightenedFramesRemaining: engine.frightenedFramesRemaining,
    ghostEatFreezeFrames: engine.ghostEatFreezeFrames,
    player: {
      x: engine.player.x, y: engine.player.y,
      tileX: Math.floor(engine.player.x / TILE_SIZE),
      tileY: Math.floor(engine.player.y / TILE_SIZE),
      direction: engine.player.direction,
      requestedDirection: engine.player.requestedDirection,
      freezeFrames: engine.player.freezeFrames,
      moving: engine.player.moving,
    },
    autoPlay: {
      level: engine.autoPlayLevel,
      target: engine.autoPlayTarget ? { ...engine.autoPlayTarget } : null,
    },
    fruit: {
      kind: engine.fruit.kind, visible: engine.fruit.visible,
      framesRemaining: engine.fruit.framesRemaining,
      spawnedCount: engine.fruit.spawnedCount,
    },
    ghosts: engine.ghosts.map((ghost) => ({
      id: ghost.id, x: ghost.x, y: ghost.y,
      direction: ghost.direction, state: ghost.state, mode: ghost.mode,
      houseState: ghost.houseState, targetTile: { ...ghost.targetTile },
      pendingReverse: ghost.pendingReverse,
    })),
  };
}

type HistoryFrame = ReturnType<typeof captureFrame>;

/** Opt-in, bounded frame trace for diagnosing automated play. */
export class GameHistory {
  recording = false;
  private startedAt = '';
  private stoppedAt: string | null = null;
  private frames: HistoryFrame[] = [];
  private events: HistoryEvent[] = [];
  private initialDots: { index: number; kind: string }[] = [];
  private nextSequence = 0;
  private droppedFrames = 0;
  private droppedEvents = 0;

  get summary() {
    return {
      recording: this.recording,
      frames: this.frames.length,
      events: this.events.length,
      droppedFrames: this.droppedFrames,
      droppedEvents: this.droppedEvents,
      maxFrames: MAX_HISTORY_FRAMES,
    };
  }

  start(engine: GameEngine): void {
    this.recording = true;
    this.startedAt = new Date().toISOString();
    this.stoppedAt = null;
    this.frames = [];
    this.events = [];
    this.initialDots = [...engine.maze.dots].map(([index, kind]) => ({ index, kind }));
    this.nextSequence = 0;
    this.droppedFrames = 0;
    this.droppedEvents = 0;
    this.recordFrame(engine);
  }

  stop(): void {
    if (!this.recording) return;
    this.recording = false;
    this.stoppedAt = new Date().toISOString();
  }

  recordFrame(engine: GameEngine): void {
    if (!this.recording) return;
    this.frames.push(captureFrame(engine, this.nextSequence++));
    if (this.frames.length > MAX_HISTORY_FRAMES) {
      this.frames.splice(0, TRIM_HISTORY_FRAMES);
      this.droppedFrames += TRIM_HISTORY_FRAMES;
      const firstSequence = this.frames[0].sequence;
      const retainedEvents = this.events.filter((event) => event.sequence >= firstSequence);
      this.droppedEvents += this.events.length - retainedEvents.length;
      this.events = retainedEvents;
    }
  }

  recordEvent(engine: GameEngine, kind: HistoryEventKind,
    detail: HistoryEvent['detail'] = {}): void {
    if (!this.recording) return;
    this.events.push({
      sequence: this.nextSequence,
      frame: engine.frame,
      playFrame: engine.playFrame,
      level: engine.level,
      kind,
      detail,
    });
    if (this.events.length > MAX_HISTORY_EVENTS) {
      this.events.splice(0, TRIM_HISTORY_EVENTS);
      this.droppedEvents += TRIM_HISTORY_EVENTS;
    }
  }

  exportData() {
    return {
      schemaVersion: 1,
      game: 'PAC-SAN',
      framesPerSecond: FIXED_FPS,
      startedAt: this.startedAt,
      stoppedAt: this.stoppedAt,
      recording: this.recording,
      droppedFrames: this.droppedFrames,
      droppedEvents: this.droppedEvents,
      initialDots: this.initialDots,
      frames: this.frames,
      events: this.events,
    };
  }
}
