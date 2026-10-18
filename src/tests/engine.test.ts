import { describe, expect, it } from 'vitest';
import { LEVEL_CLEAR_FRAMES, READY_FRAMES, TILE_CENTER, TILE_SIZE, type Direction } from '../config/constants';
import { GameEngine } from '../engine/GameEngine';
import { tileIndex } from '../map/maze';
import { canPlayerEnter } from '../map/tileRules';

function playing(): GameEngine {
  const engine = new GameEngine();
  engine.start();
  for (let i = 0; i < READY_FRAMES; i++) engine.update();
  // Isolate Phase 1 movement/scoring expectations from Phase 3 contacts.
  engine.ghosts = [];
  return engine;
}

function approach(engine: GameEngine, x: number, y: number) {
  engine.player.x = x * TILE_SIZE + TILE_CENTER + 1;
  engine.player.y = y * TILE_SIZE + TILE_CENTER;
  engine.player.direction = 'left';
  engine.player.requestedDirection = 'left';
}

describe('Phase 1 game engine', () => {
  it('holds the title, enters READY and begins only after its countdown', () => {
    const engine = new GameEngine(1200);
    const initial = engine.snapshot();
    engine.update(); expect(engine.snapshot()).toEqual(initial);
    engine.start(); expect(engine.state).toBe('READY');
    const x = engine.player.x;
    for (let i = 0; i < READY_FRAMES - 1; i++) engine.update();
    expect(engine.state).toBe('READY'); expect(engine.player.x).toBe(x);
    engine.update(); expect(engine.state).toBe('PLAYING');
    engine.update(); expect(engine.player.x).toBe(x - 1);
    expect(engine.highScore).toBe(1200);
  });

  it.each([{ x: 2, y: 1, points: 10, freeze: 1 }, { x: 1, y: 3, points: 50, freeze: 3 }])(
    'scores $points and freezes exactly $freeze full updates', ({ x, y, points, freeze }) => {
      const engine = playing(); approach(engine, x, y);
      engine.update();
      expect(engine.score).toBe(points);
      expect(engine.highScore).toBe(points);
      expect(engine.maze.remainingDots).toBe(243);
      expect(engine.player.freezeFrames).toBe(freeze);
      const stoppedX = engine.player.x;
      for (let i = 0; i < freeze; i++) {
        engine.update(); expect(engine.player.x).toBe(stoppedX);
      }
      expect(engine.player.freezeFrames).toBe(0);
      // The left energizer has walls on both horizontal sides; exit downward.
      if (x === 1) engine.requestDirection('down');
      engine.update();
      if (x === 1) {
        expect(engine.player.x).toBe(stoppedX);
        expect(engine.player.y).toBe(y * TILE_SIZE + TILE_CENTER + 1);
      } else expect(engine.player.x).toBe(stoppedX - 1);
      expect(engine.score).toBe(points);
    },
  );

  it('makes pause a true freeze, and resumes the prior READY state', () => {
    const engine = new GameEngine(); engine.start(); engine.update(); engine.togglePause();
    const frozen = engine.snapshot();
    for (let i = 0; i < 100; i++) engine.update();
    expect(engine.snapshot()).toEqual(frozen);
    engine.togglePause(); expect(engine.state).toBe('READY');
    for (let i = 0; i < READY_FRAMES - 1; i++) engine.update();
    expect(engine.state).toBe('PLAYING');
    engine.pause(); expect(engine.state).toBe('PAUSED');
    engine.togglePause(); expect(engine.state).toBe('PLAYING');
  });

  it('does not allow Enter to restart a running or paused game', () => {
    const engine = playing(); engine.update();
    const running = engine.snapshot(); engine.start();
    expect(engine.snapshot()).toEqual(running);
    engine.pause(); const paused = engine.snapshot(); engine.start();
    expect(engine.snapshot()).toEqual(paused);
  });

  it('holds LEVEL_CLEAR briefly, then advances while preserving score and lives', () => {
    const engine = playing();
    engine.maze.dots.clear(); engine.maze.dots.set(tileIndex(2, 1), 'normal');
    approach(engine, 2, 1); engine.update();
    expect(engine.state).toBe('LEVEL_CLEAR');
    const completed = engine.snapshot(); engine.update();
    expect(engine.state).toBe('LEVEL_CLEAR');
    expect(engine.score).toBe(completed.score);
    expect(engine.maze.remainingDots).toBe(0);
    for (let i = 1; i < LEVEL_CLEAR_FRAMES; i++) engine.update();
    expect(engine.state).toBe('READY'); expect(engine.maze.remainingDots).toBe(244);
    expect(engine.score).toBe(10); expect(engine.highScore).toBe(10);
    expect(engine.level).toBe(2);
    expect(engine.lives).toBe(3);
  });

  it('can collect all 244 original dots through actual movement for 2600 points', () => {
    const engine = playing();
    // Move from the half-tile start onto the first corridor center.
    for (let i = 0; i < 4; i++) engine.update();
    const vectors: { dx: number; dy: number; direction: Direction }[] = [
      { dx: -1, dy: 0, direction: 'left' }, { dx: 1, dy: 0, direction: 'right' },
      { dx: 0, dy: -1, direction: 'up' }, { dx: 0, dy: 1, direction: 'down' },
    ];
    while (engine.maze.remainingDots) {
      const fromX = Math.floor(engine.player.x / TILE_SIZE);
      const fromY = Math.floor(engine.player.y / TILE_SIZE);
      const start = tileIndex(fromX, fromY);
      const goal = engine.maze.dots.keys().next().value as number;
      const routes = new Map<number, Direction[]>([[start, []]]);
      const pending = [{ x: fromX, y: fromY }];
      for (let cursor = 0; cursor < pending.length && !routes.has(goal); cursor++) {
        const { x, y } = pending[cursor];
        for (const vector of vectors) {
          const nx = (x + vector.dx + 28) % 28;
          const ny = y + vector.dy;
          const index = tileIndex(nx, ny);
          if (!canPlayerEnter(nx, ny) || routes.has(index)) continue;
          routes.set(index, [...routes.get(tileIndex(x, y))!, vector.direction]);
          pending.push({ x: nx, y: ny });
        }
      }
      const route = routes.get(goal);
      expect(route, `route to dot ${goal}`).toBeDefined();
      for (const direction of route!) {
        engine.requestDirection(direction);
        for (let pixel = 0; pixel < TILE_SIZE && engine.state === 'PLAYING';) {
          const steps = engine.player.steps;
          engine.update();
          // Keep this legacy one-pixel path check at Phase 1 speed.
          engine.frightenedFramesRemaining = 0;
          pixel += engine.player.steps - steps;
          if (engine.playFrame > 50000) throw new Error('Traversal stalled');
        }
        if (engine.state === 'LEVEL_CLEAR') break;
      }
    }
    expect(engine.state).toBe('LEVEL_CLEAR');
    expect(engine.score).toBeGreaterThanOrEqual(2600);
    expect(engine.maze.remainingDots).toBe(0);
  });

  it('reproduces identical input and keeps debug rendering state out of simulation', () => {
    const a = playing(); const b = playing();
    b.toggleDebug();
    const inputs = new Map<number, Direction>([[60, 'up'], [150, 'left'], [200, 'down'], [360, 'right'], [420, 'up'], [900, 'left']]);
    for (let frame = 0; frame < 2000; frame++) {
      const input = inputs.get(frame);
      if (input) { a.requestDirection(input); b.requestDirection(input); }
      a.update(); b.update();
    }
    const { debug: _a, ...stateA } = a.snapshot();
    const { debug: _b, ...stateB } = b.snapshot();
    expect(stateA).toEqual(stateB);
    expect([...a.maze.dots]).toEqual([...b.maze.dots]);
  });

  it('keeps individual debug display choices when the inspector is closed and reopened', () => {
    const engine = new GameEngine();
    engine.toggleDebug();
    engine.setDebugDisplayOption('mazeGrid', false);
    engine.setDebugDisplayOption('ghostTable', false);
    const snapshot = engine.snapshot();
    expect(snapshot.debugDisplay.mazeGrid).toBe(false);
    expect(snapshot.debugDisplay.ghostTable).toBe(false);
    expect(snapshot.debugDisplay.ghostTargets).toBe(true);

    snapshot.debugDisplay.mazeGrid = true;
    expect(engine.snapshot().debugDisplay.mazeGrid).toBe(false);
    engine.toggleDebug();
    engine.toggleDebug();
    engine.start();
    expect(engine.snapshot().debugDisplay).toMatchObject({ mazeGrid: false, ghostTable: false });
  });
});
