import { describe, expect, it } from 'vitest';
import { MAX_HISTORY_FRAMES } from '../engine/GameHistory';
import { GameEngine } from '../engine/GameEngine';
import { FRUIT_POSITION } from '../systems/FruitSystem';
import { READY_FRAMES } from '../config/constants';

describe('game history export', () => {
  it('records TAS decisions and pickup events with frame state only when enabled', () => {
    const engine = new GameEngine();
    engine.toggleDebug();
    engine.setAutoPlayLevel('tas');
    engine.start();
    for (let frame = 0; frame < READY_FRAMES; frame++) engine.update();
    expect(engine.history.summary.frames).toBe(0);

    engine.setHistoryRecording(true);
    engine.ghosts = [];
    for (let frame = 0; frame < 12; frame++) engine.update();
    const trace = engine.history.exportData();
    expect(trace.schemaVersion).toBe(1);
    expect(trace.framesPerSecond).toBe(60);
    expect(trace.initialDots).toHaveLength(244);
    expect(trace.frames).toHaveLength(13);
    expect(trace.frames.at(-1)?.frame).toBe(engine.frame);
    expect(trace.frames.at(-1)?.player.x).toBe(engine.player.x);
    expect(trace.events.some((event) => event.kind === 'auto_decision'
      && event.detail.direction !== null)).toBe(true);

    engine.setAutoPlayLevel(null);
    engine.fruit.framesRemaining = 10;
    engine.player.x = FRUIT_POSITION.x;
    engine.player.y = FRUIT_POSITION.y;
    engine.player.freezeFrames = 1;
    engine.update();
    expect(engine.history.exportData().events).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'fruit_collected', detail: expect.objectContaining({ points: 100 }) }),
    ]));
    expect(engine.history.exportData().frames.at(-1)?.score).toBe(engine.score);
  });

  it('holds a paused or stopped trace and resets cleanly for a new recording', () => {
    const engine = new GameEngine();
    engine.start();
    engine.setHistoryRecording(true);
    engine.update();
    engine.togglePause();
    const beforePause = engine.history.summary.frames;
    for (let frame = 0; frame < 20; frame++) engine.update();
    expect(engine.history.summary.frames).toBe(beforePause);
    expect(engine.history.exportData().events.at(-1)?.kind).toBe('pause');

    engine.setHistoryRecording(false);
    engine.togglePause();
    engine.update();
    expect(engine.history.summary.frames).toBe(beforePause);
    expect(engine.history.exportData().stoppedAt).not.toBeNull();
    engine.setHistoryRecording(true);
    expect(engine.history.summary.frames).toBe(1);
    expect(engine.history.summary.events).toBe(0);
    expect(engine.history.summary.droppedFrames).toBe(0);
  });

  it('includes ghost route choices in a serializable trace', () => {
    const engine = new GameEngine();
    engine.setHistoryRecording(true);
    engine.start();
    for (let frame = 0; frame < READY_FRAMES + 20; frame++) engine.update();
    const data = JSON.parse(JSON.stringify(engine.history.exportData()));
    expect(data.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'ghost_decision',
        detail: expect.objectContaining({ ghost: 'blinky', chosen: expect.any(String) }),
      }),
    ]));
    expect(data.frames.at(-1).ghosts).toHaveLength(4);
  });

  it('retains a bounded recent window and reports omitted frames', () => {
    const engine = new GameEngine();
    engine.ghosts = [];
    engine.setHistoryRecording(true);
    engine.history.recordEvent(engine, 'manual_input', { direction: 'left' });
    for (let frame = 0; frame < MAX_HISTORY_FRAMES; frame++) engine.history.recordFrame(engine);
    const trace = engine.history.exportData();
    expect(trace.frames.length).toBeLessThanOrEqual(MAX_HISTORY_FRAMES);
    expect(trace.droppedFrames).toBeGreaterThan(0);
    expect(trace.frames[0].sequence).toBe(trace.droppedFrames);
    expect(trace.events).toHaveLength(0);
    expect(trace.droppedEvents).toBe(1);
  });
});
