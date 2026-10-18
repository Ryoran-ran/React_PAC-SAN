import { describe, expect, it } from 'vitest';
import { DYING_FRAMES, READY_FRAMES, TILE_CENTER, TILE_SIZE } from '../config/constants';
import { GameEngine } from '../engine/GameEngine';
import { normalizeFreePlaySettings } from '../engine/GameModes';

describe('game modes', () => {
  it('keeps Arcade as the default with the original starting round and lives', () => {
    const engine = new GameEngine();
    engine.start();
    expect(engine.snapshot()).toMatchObject({ gameMode: 'arcade', level: 1, lives: 3 });
    expect(engine.ghosts).toHaveLength(4);
  });

  it('starts Free Play at the chosen round with the chosen number of ghosts', () => {
    const engine = new GameEngine();
    engine.configureStart('freeplay', { startLevel: 12, ghostCount: 0 });
    engine.start();
    expect(engine.snapshot()).toMatchObject({ gameMode: 'freeplay', level: 12, lives: 0 });
    expect(engine.ghosts).toHaveLength(0);
    for (let frame = 0; frame < READY_FRAMES + 10; frame++) engine.update();
    expect(engine.state).toBe('PLAYING');
    expect(engine.ghosts).toHaveLength(0);
  });

  it('retries Free Play indefinitely without erasing the round, dots or score', () => {
    const engine = new GameEngine(5000);
    engine.configureStart('freeplay', { startLevel: 5, ghostCount: 1 });
    engine.start();
    for (let frame = 0; frame < READY_FRAMES; frame++) engine.update();
    engine.score = 990;
    const dots = engine.maze.remainingDots;
    for (let miss = 0; miss < 3; miss++) {
      const ghost = engine.ghosts[0];
      ghost.houseState = 'OUTSIDE';
      ghost.x = engine.player.x - 2;
      ghost.y = engine.player.y;
      engine.update();
      expect(engine.state).toBe('PLAYER_DYING');
      for (let frame = 0; frame < DYING_FRAMES; frame++) engine.update();
      expect(engine.state).toBe('READY');
      expect(engine.lives).toBe(0);
      expect(engine.level).toBe(5);
      expect(engine.score).toBe(990);
      expect(engine.maze.remainingDots).toBe(dots);
      for (let frame = 0; frame < READY_FRAMES; frame++) engine.update();
    }
    // Practice scores cannot overwrite the Arcade high score.
    engine.ghosts = [];
    engine.score = 9990;
    engine.player.x = 2 * TILE_SIZE + TILE_CENTER + 1;
    engine.player.y = TILE_SIZE + TILE_CENTER;
    engine.player.direction = 'left';
    engine.player.requestedDirection = 'left';
    engine.update();
    expect(engine.score).toBe(10000);
    expect(engine.lives).toBe(0);
    expect(engine.extraLifeAwarded).toBe(false);
    expect(engine.highScore).toBe(5000);
  });

  it('returns to the title to switch modes and ignores setup changes during play', () => {
    const engine = new GameEngine();
    engine.configureStart('freeplay', { startLevel: 7, ghostCount: 2 });
    engine.start();
    engine.configureStart('arcade');
    expect(engine.selectedMode).toBe('freeplay');
    engine.returnToTitle();
    expect(engine.state).toBe('TITLE');
    engine.configureStart('arcade');
    engine.start();
    expect(engine.snapshot()).toMatchObject({ gameMode: 'arcade', level: 1, lives: 3 });
    expect(engine.ghosts).toHaveLength(4);
  });

  it('restores the Enter prompt after game over without starting a new run', () => {
    const engine = new GameEngine();
    engine.state = 'GAME_OVER';
    engine.score = 1200;
    engine.configureStart('freeplay', { startLevel: 3, ghostCount: 2 });

    engine.showStartPrompt();
    expect(engine.state).toBe('TITLE');
    expect(engine.score).toBe(0);
    expect(engine.level).toBe(3);
    expect(engine.maze.remainingDots).toBe(244);
    expect(engine.ghosts).toHaveLength(2);
    expect(engine.selectedMode).toBe('freeplay');
    expect(engine.history.summary.frames).toBe(0);

    engine.start();
    expect(engine.snapshot()).toMatchObject({ state: 'READY', gameMode: 'freeplay', level: 3 });
  });

  it('clamps Free Play setup to supported values', () => {
    expect(normalizeFreePlaySettings({ startLevel: 0, ghostCount: -10 }))
      .toEqual({ startLevel: 1, ghostCount: 0 });
    expect(normalizeFreePlaySettings({ startLevel: 300, ghostCount: 20 }))
      .toEqual({ startLevel: 255, ghostCount: 4 });
  });
});
