import { describe, expect, it } from 'vitest';
import { GameEngine } from '../engine/GameEngine';

describe('Nightmare TAS', () => {
  it('clears two rounds using Nightmare-specific pursuit forecasts', () => {
    const engine = new GameEngine();
    engine.configureStart('nightmare');
    engine.toggleDebug();
    engine.setAutoPlayLevel('tas');
    engine.start();
    for (let frame = 0; frame < 12000 && engine.level < 3
      && engine.state !== 'GAME_OVER'; frame++) engine.update();
    expect(engine.level,
      `state=${engine.state} lives=${engine.lives} dots=${engine.maze.remainingDots}`)
      .toBeGreaterThanOrEqual(3);
    expect(engine.lives).toBeGreaterThanOrEqual(1);
  }, 30000);
});
