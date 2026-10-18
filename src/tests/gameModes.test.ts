import { describe, expect, it } from 'vitest';
import { DYING_FRAMES, READY_FRAMES, TILE_CENTER, TILE_SIZE } from '../config/constants';
import { GameEngine } from '../engine/GameEngine';
import { DEFAULT_FREE_PLAY_SETTINGS, normalizeFreePlaySettings } from '../engine/GameModes';

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

  it('uses Nightmare movement inside Free Play without changing Free Play rules', () => {
    const engine = new GameEngine(5000);
    engine.configureStart('freeplay', { startLevel: 8, ghostCount: 3, ghostAI: 'nightmare' });
    engine.showStartPrompt();
    expect(engine.snapshot()).toMatchObject({
      state: 'TITLE', gameMode: 'freeplay', ghostAI: 'nightmare', level: 8, lives: 0,
    });
    engine.setHistoryRecording(true);
    engine.start();
    expect(engine.ghosts).toHaveLength(3);
    expect(engine.highScore).toBe(5000);
    expect(engine.history.exportData().frames.at(-1)?.ghostAI).toBe('nightmare');
    expect(engine.history.exportData().events.find((event) => event.kind === 'game_start')?.detail)
      .toMatchObject({ mode: 'freeplay', ghostAI: 'nightmare', ghostCount: 3 });

    engine.configureStart('arcade');
    expect(engine.selectedMode).toBe('freeplay');
    expect(engine.ghostAI).toBe('nightmare');
  });

  it('uses the same ghost decisions as standalone Nightmare at the same round', () => {
    const standalone = new GameEngine();
    standalone.configureStart('nightmare');
    standalone.start();
    const freeplay = new GameEngine();
    freeplay.configureStart('freeplay', { startLevel: 1, ghostCount: 4, ghostAI: 'nightmare' });
    freeplay.start();
    for (let frame = 0; frame < READY_FRAMES + 30; frame++) {
      standalone.update();
      freeplay.update();
      expect(freeplay.ghosts.map(({ x, y, direction, targetTile }) =>
        ({ x, y, direction, targetTile }))).toEqual(standalone.ghosts.map(
        ({ x, y, direction, targetTile }) => ({ x, y, direction, targetTile })));
    }
    expect(freeplay.gameMode).toBe('freeplay');
    expect(freeplay.lives).toBe(0);
  });

  it('keeps Free Play ghosts in chase when pursuit-only behavior is selected', () => {
    const engine = new GameEngine();
    engine.configureStart('freeplay', {
      startLevel: 1, ghostCount: 4, ghostBehavior: 'chase',
    });
    engine.start();
    expect(engine.modeScheduler.mode).toBe('CHASE');
    expect(engine.modeScheduler.remainingFrames).toBeNull();
    expect(engine.ghosts.every((ghost) => ghost.mode === 'CHASE')).toBe(true);
    for (let frame = 0; frame < READY_FRAMES + 1; frame++) engine.update();
    expect(engine.ghosts[0].targetTile).toEqual({
      x: Math.floor(engine.player.x / TILE_SIZE),
      y: Math.floor(engine.player.y / TILE_SIZE),
    });
    expect(engine.modeScheduler.mode).toBe('CHASE');
  });

  it('keeps Free Play ghosts on their patrol targets even with Nightmare AI and Elroy', () => {
    const engine = new GameEngine();
    engine.configureStart('freeplay', {
      startLevel: 1, ghostCount: 4, ghostAI: 'nightmare', ghostBehavior: 'scatter',
    });
    engine.start();
    expect(engine.modeScheduler.mode).toBe('SCATTER');
    expect(engine.modeScheduler.remainingFrames).toBeNull();
    for (let frame = 0; frame < READY_FRAMES; frame++) engine.update();
    engine.ghosts[3].houseState = 'OUTSIDE';
    for (const index of [...engine.maze.dots.keys()].slice(20)) engine.maze.dots.delete(index);
    expect(engine.elroyStage).toBeGreaterThan(0);
    engine.update();
    expect(engine.ghosts[0].targetTile).toEqual(engine.ghosts[0].scatterTarget);
    expect(engine.ghosts[0].mode).toBe('SCATTER');
    expect(engine.ghostAI).toBe('nightmare');
  });

  it('lets Pinky use Blinky pursuit in Free Play without changing its identity', () => {
    const engine = new GameEngine();
    engine.configureStart('freeplay', {
      startLevel: 1, ghostCount: 2, ghostBehavior: 'chase',
      ghostTargeting: { pinky: 'blinky' },
    });
    engine.setHistoryRecording(true);
    engine.start();
    const pinky = engine.ghosts[1];
    expect(pinky.id).toBe('pinky');
    expect(engine.history.exportData().events.find((event) => event.kind === 'game_start')?.detail
      .ghostTargeting).toContain('"pinky":"blinky"');
    for (let frame = 0; frame < READY_FRAMES; frame++) engine.update();
    pinky.houseState = 'OUTSIDE';
    pinky.x = engine.ghosts[0].x;
    pinky.y = engine.ghosts[0].y;
    engine.update();
    expect(pinky.targetTile).toEqual({
      x: Math.floor(engine.player.x / TILE_SIZE),
      y: Math.floor(engine.player.y / TILE_SIZE),
    });
    expect(pinky.scatterTarget).toEqual({ x: 2, y: -3 });
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
      .toEqual({ ...DEFAULT_FREE_PLAY_SETTINGS, ghostCount: 0 });
    expect(normalizeFreePlaySettings({ startLevel: 300, ghostCount: 20 }))
      .toEqual({ ...DEFAULT_FREE_PLAY_SETTINGS, startLevel: 255 });
    expect(normalizeFreePlaySettings({ startLevel: 5, ghostCount: 2, ghostAI: 'nightmare' }))
      .toEqual({ ...DEFAULT_FREE_PLAY_SETTINGS,
        startLevel: 5, ghostCount: 2, ghostAI: 'nightmare' });
    expect(normalizeFreePlaySettings({ startLevel: 5, ghostCount: 2, ghostBehavior: 'chase' }))
      .toEqual({ ...DEFAULT_FREE_PLAY_SETTINGS,
        startLevel: 5, ghostCount: 2, ghostBehavior: 'chase' });
    expect(normalizeFreePlaySettings({ startLevel: 1, ghostCount: 4,
      ghostTargeting: { pinky: 'blinky' } }).ghostTargeting)
      .toEqual({ ...DEFAULT_FREE_PLAY_SETTINGS.ghostTargeting, pinky: 'blinky' });
  });
});
