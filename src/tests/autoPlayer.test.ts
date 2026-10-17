import { describe, expect, it } from 'vitest';
import { chooseAutoDirection, type AutoPlayLevel } from '../ai/AutoPlayer';
import { READY_FRAMES, TILE_CENTER, TILE_SIZE } from '../config/constants';
import { GameEngine } from '../engine/GameEngine';
import { createGhosts } from '../entities/Ghost';
import { PacSan } from '../entities/PacSan';
import { Maze, tileIndex } from '../map/maze';

const at = (tile: number) => tile * TILE_SIZE + TILE_CENTER;

describe('debug auto-play', () => {
  it('chooses a different route when a stronger level anticipates a nearby ghost', () => {
    const player = new PacSan();
    player.x = at(6);
    player.y = at(5);
    const maze = new Maze();
    maze.dots.clear();
    maze.dots.set(tileIndex(5, 5), 'normal');
    maze.dots.set(tileIndex(8, 5), 'normal');
    const ghost = createGhosts()[0];
    ghost.x = at(3);
    ghost.y = at(5);
    ghost.direction = 'left';

    expect(chooseAutoDirection(player, [ghost], maze, 'beginner')?.direction).toBe('left');
    expect(chooseAutoDirection(player, [ghost], maze, 'tas')?.direction).toBe('right');
  });

  it.each(['beginner', 'standard', 'expert', 'tas'] as AutoPlayLevel[])(
    '%s collects dots in the real maze without getting stuck', (level) => {
      const engine = new GameEngine();
      engine.toggleDebug();
      engine.setAutoPlayLevel(level);
      engine.start();
      for (let frame = 0; frame < READY_FRAMES + 800; frame++) engine.update();
      expect(engine.maze.remainingDots).toBeLessThan(230);
      expect(engine.autoPlayTarget).not.toBeNull();
      expect(engine.autoPlayLevel).toBe(level);
    },
  );

  it('uses one deterministic path for identical state and inputs', () => {
    const a = new GameEngine();
    const b = new GameEngine();
    for (const engine of [a, b]) {
      engine.toggleDebug();
      engine.setAutoPlayLevel('tas');
      engine.start();
    }
    for (let frame = 0; frame < READY_FRAMES + 500; frame++) { a.update(); b.update(); }
    expect(a.snapshot()).toEqual(b.snapshot());
    expect([...a.maze.dots]).toEqual([...b.maze.dots]);
  });

  it.each(['beginner', 'standard', 'expert', 'tas'] as AutoPlayLevel[])(
    '%s can finish a full round autonomously', (level) => {
    const engine = new GameEngine();
    engine.toggleDebug();
    engine.setAutoPlayLevel(level);
    engine.start();
    for (let frame = 0; frame < 20000 && engine.state !== 'LEVEL_CLEAR'; frame++) engine.update();
    expect(engine.state, `stopped with ${engine.maze.remainingDots} dots left`).toBe('LEVEL_CLEAR');
    expect(engine.score).toBeGreaterThanOrEqual(2600);
    }, 30000,
  );

  it('returns control to the player on manual input or when debug closes', () => {
    const engine = new GameEngine();
    engine.toggleDebug();
    engine.setAutoPlayLevel('expert');
    engine.start();
    engine.requestDirection('up');
    expect(engine.autoPlayLevel).toBeNull();
    expect(engine.player.requestedDirection).toBe('up');
    engine.setAutoPlayLevel('tas');
    engine.toggleDebug();
    expect(engine.autoPlayLevel).toBeNull();
    engine.setAutoPlayLevel('tas');
    expect(engine.autoPlayLevel).toBeNull();
  });
});
