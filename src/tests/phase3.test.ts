import { describe, expect, it } from 'vitest';
import {
  DYING_FRAMES, EXTRA_LIFE_SCORE, FRUIT_SCORE_POPUP_FRAMES,
  GHOST_EAT_FREEZE_FRAMES, GHOST_SCORE_POPUP_FRAMES,
  LEVEL_CLEAR_FRAMES, READY_FRAMES, TILE_CENTER, TILE_SIZE,
} from '../config/constants';
import { getFruitCounter, getLevelConfig } from '../config/levelTables';
import { GameEngine } from '../engine/GameEngine';
import { GameRandom } from '../engine/Random';
import { tileIndex } from '../map/maze';
import { FRUIT_POSITION, FruitSystem } from '../systems/FruitSystem';

const at = (tile: number) => tile * TILE_SIZE + TILE_CENTER;

function playing(): GameEngine {
  const engine = new GameEngine();
  engine.start();
  for (let frame = 0; frame < READY_FRAMES; frame++) engine.update();
  return engine;
}

function enterDot(engine: GameEngine, x: number, y: number): void {
  engine.player.x = at(x) + 1;
  engine.player.y = at(y);
  engine.player.direction = 'left';
  engine.player.requestedDirection = 'left';
  engine.player.freezeFrames = 0;
}

describe('Phase 3 game systems', () => {
  it('collects a dot crossed midway through a two-pixel movement update', () => {
    const engine = playing();
    engine.level = 5; // 100% speed sometimes moves two pixels in one update.
    engine.ghosts = [];
    engine.player.movementFrame = 3;
    enterDot(engine, 2, 1);
    engine.update();
    expect(engine.maze.remainingDots).toBe(243);
    expect(engine.score).toBe(10);
    expect(engine.player.x).toBe(at(2));
    expect(engine.player.freezeFrames).toBe(1);
  });

  it('collects a junction dot while making an early diagonal turn', () => {
    const engine = playing();
    engine.ghosts = [];
    engine.maze.dots.clear();
    engine.maze.dots.set(tileIndex(6, 1), 'normal');
    engine.maze.dots.set(tileIndex(6, 2), 'normal');
    engine.player.x = at(6) - 3;
    engine.player.y = at(1);
    engine.player.direction = 'right';
    engine.player.requestedDirection = 'down';
    engine.update();
    expect(engine.player.x).toBe(at(6) - 2);
    expect(engine.player.y).toBe(at(1) + 1);
    expect(engine.maze.remainingDots).toBe(1);
    expect(engine.score).toBe(10);
    expect(engine.player.freezeFrames).toBe(1);
  });

  it.each([
    { offset: -1, kind: 'normal' as const, points: 10, freeze: 1 },
    { offset: 1, kind: 'power' as const, points: 50, freeze: 3 },
  ])('collects a $kind cookie when a one-pixel turn finishes at the junction',
    ({ offset, kind, points, freeze }) => {
      const engine = playing();
      engine.ghosts = [];
      engine.maze.dots.clear();
      engine.maze.dots.set(tileIndex(6, 1), kind);
      engine.maze.dots.set(tileIndex(6, 2), 'normal');
      engine.player.x = at(6) + offset;
      engine.player.y = at(1);
      engine.player.direction = 'right';
      engine.player.requestedDirection = 'down';

      engine.update();

      expect(engine.player.x).toBe(at(6));
      expect(engine.player.y).toBe(at(1) + 1);
      expect(engine.player.turning).toBeNull();
      expect(engine.maze.remainingDots).toBe(1);
      expect(engine.score).toBe(points);
      expect(engine.player.freezeFrames).toBe(freeze);
    });

  it('activates a power dot crossed midway through a two-pixel update', () => {
    const engine = playing();
    engine.level = 5;
    engine.player.movementFrame = 3;
    engine.maze.dots.set(tileIndex(2, 1), 'power');
    enterDot(engine, 2, 1);
    engine.update();
    expect(engine.score).toBe(50);
    expect(engine.player.x).toBe(at(2));
    expect(engine.player.freezeFrames).toBe(3);
    expect(engine.frightenedFramesRemaining).toBe(2 * 60);
    expect(engine.ghosts.every((ghost) => ghost.state === 'FRIGHTENED')).toBe(true);
  });

  it('lets auto-play turn at a cleared junction crossed midway through an update', () => {
    const engine = playing();
    engine.level = 5;
    engine.ghosts = [];
    engine.maze.dots.clear();
    engine.maze.dots.set(tileIndex(6, 4), 'normal');
    engine.toggleDebug();
    engine.setAutoPlayLevel('tas');
    engine.player.movementFrame = 3;
    enterDot(engine, 6, 5);
    engine.update();
    expect(engine.player.x).toBe(at(6));
    expect(engine.player.y).toBe(at(5) - 1);
    expect(engine.player.requestedDirection).toBe('up');
  });

  it('frightens ghosts for the level duration and pauses the mode schedule', () => {
    const engine = playing();
    enterDot(engine, 1, 3);
    engine.update();
    expect(engine.frightenedFramesRemaining).toBe(6 * 60);
    expect(engine.ghosts.every((ghost) => ghost.state === 'FRIGHTENED')).toBe(true);
    const modeFrames = engine.modeScheduler.remainingFrames;
    engine.player.x = at(13); engine.player.y = at(14);
    for (let frame = 0; frame < 6 * 60; frame++) engine.update();
    expect(engine.frightenedFramesRemaining).toBe(0);
    expect(engine.ghosts.every((ghost) => ghost.state === 'NORMAL')).toBe(true);
    expect(engine.modeScheduler.remainingFrames).toBe(modeFrames);
  });

  it('keeps ghosts lethal after a power dot on levels without frightened time', () => {
    const engine = playing();
    engine.level = 19;
    engine.ghosts = [engine.ghosts[0]];
    engine.ghosts[0].x = at(1); engine.ghosts[0].y = at(3);
    enterDot(engine, 1, 3);
    engine.update();
    expect(engine.score).toBe(50);
    expect(engine.frightenedFramesRemaining).toBe(0);
    expect(engine.ghosts[0].state).toBe('NORMAL');
    expect(engine.state).toBe('PLAYER_DYING');
  });

  it('scores a frightened ghost chain once per power dot and leaves harmless returning eyes', () => {
    const engine = playing();
    engine.ghosts = engine.ghosts.slice(0, 2);
    for (const ghost of engine.ghosts) {
      ghost.houseState = 'OUTSIDE';
      ghost.x = at(1); ghost.y = at(3);
    }
    enterDot(engine, 1, 3);
    engine.update();
    expect(engine.score).toBe(50 + 200 + 400);
    expect(engine.ghostCombo).toBe(2);
    expect(engine.ghosts.every((ghost) => ghost.state === 'EATEN')).toBe(true);
    expect(engine.lives).toBe(3);
    expect(engine.ghostEatFreezeFrames).toBe(GHOST_EAT_FREEZE_FRAMES);
    expect(engine.ghostScorePopups.map((popup) => popup.points)).toEqual([200, 400]);
    expect(engine.ghostScorePopups.map((popup) => [popup.x, popup.y]))
      .toEqual([[at(1), at(3)], [at(1), at(3)]]);

    const playerPosition = [engine.player.x, engine.player.y];
    const ghostPositions = engine.ghosts.map((ghost) => [ghost.x, ghost.y]);
    const frightenedFrames = engine.frightenedFramesRemaining;
    const modeFrames = engine.modeScheduler.remainingFrames;
    const playFrame = engine.playFrame;
    engine.pause();
    engine.update();
    expect(engine.ghostEatFreezeFrames).toBe(GHOST_EAT_FREEZE_FRAMES);
    engine.togglePause();
    for (let frame = 0; frame < GHOST_EAT_FREEZE_FRAMES; frame++) engine.update();
    expect([engine.player.x, engine.player.y]).toEqual(playerPosition);
    expect(engine.ghosts.map((ghost) => [ghost.x, ghost.y])).toEqual(ghostPositions);
    expect(engine.frightenedFramesRemaining).toBe(frightenedFrames);
    expect(engine.modeScheduler.remainingFrames).toBe(modeFrames);
    expect(engine.playFrame).toBe(playFrame);
    expect(engine.ghostScorePopups.map((popup) => popup.framesRemaining))
      .toEqual([GHOST_SCORE_POPUP_FRAMES - GHOST_EAT_FREEZE_FRAMES, GHOST_SCORE_POPUP_FRAMES - GHOST_EAT_FREEZE_FRAMES]);

    engine.update();
    expect(engine.state).toBe('PLAYING');
    expect(engine.score).toBe(650);
    expect(engine.playFrame).toBe(playFrame + 1);
    expect(engine.frightenedFramesRemaining).toBe(frightenedFrames - 1);
    for (let frame = 1; frame < GHOST_SCORE_POPUP_FRAMES - GHOST_EAT_FREEZE_FRAMES; frame++) engine.update();
    expect(engine.ghostScorePopups).toEqual([]);
  });

  it('returns eaten eyes through the house and releases a revived ghost', () => {
    const engine = playing();
    const ghost = engine.ghosts[0];
    engine.ghosts = [ghost];
    engine.player.x = at(13); engine.player.y = at(14);
    ghost.state = 'EATEN';
    ghost.x = at(13) + 1; ghost.y = at(11);
    ghost.direction = 'left';
    engine.update();
    expect(ghost.houseState).toBe('RETURNING_HOME');
    for (let frame = 0; frame < 100 && ghost.houseState !== 'OUTSIDE'; frame++) engine.update();
    expect(ghost.houseState).toBe('OUTSIDE');
    expect(ghost.state).toBe('NORMAL');
  });

  it('loses a life on contact, retains dots and score, then reaches game over on the final life', () => {
    const engine = playing();
    engine.ghosts = [engine.ghosts[0]];
    engine.score = 1230;
    const dots = engine.maze.remainingDots;
    engine.ghosts[0].x = 110; engine.ghosts[0].y = engine.player.y;
    engine.update();
    expect(engine.state).toBe('PLAYER_DYING');
    expect(engine.lives).toBe(2);
    for (let frame = 0; frame < DYING_FRAMES; frame++) engine.update();
    expect(engine.state).toBe('READY');
    expect(engine.score).toBe(1230);
    expect(engine.maze.remainingDots).toBe(dots);
    expect(engine.player.x).toBe(112);

    for (let frame = 0; frame < READY_FRAMES; frame++) engine.update();
    engine.lives = 1;
    engine.ghosts = [engine.ghosts[0]];
    engine.ghosts[0].houseState = 'OUTSIDE';
    engine.ghosts[0].x = 110; engine.ghosts[0].y = engine.player.y;
    engine.update();
    for (let frame = 0; frame < DYING_FRAMES; frame++) engine.update();
    expect(engine.state).toBe('GAME_OVER');
    const frozen = engine.snapshot(); engine.update();
    expect(engine.snapshot()).toEqual(frozen);
    engine.start();
    expect(engine.state).toBe('READY');
    expect(engine.lives).toBe(3);
    expect(engine.score).toBe(0);
  });

  it('awards a single extra life when the score reaches the threshold', () => {
    const engine = playing();
    engine.ghosts = [];
    engine.score = EXTRA_LIFE_SCORE - 10;
    enterDot(engine, 2, 1);
    engine.update();
    expect(engine.score).toBe(EXTRA_LIFE_SCORE);
    expect(engine.lives).toBe(4);
    enterDot(engine, 3, 1);
    engine.update();
    expect(engine.lives).toBe(4);
  });

  it('spawns and collects the first fruit at 70 dots, then uses the next level fruit', () => {
    const engine = playing();
    expect(getFruitCounter(engine.level)).toEqual(['cherry']);
    engine.ghosts = [];
    engine.maze.dots.clear();
    for (let index = 0; index < 174; index++) engine.maze.dots.set(1000 + index, 'normal');
    engine.maze.dots.set(tileIndex(2, 1), 'normal');
    enterDot(engine, 2, 1);
    engine.update();
    expect(engine.fruit.visible).toBe(true);
    expect(engine.fruit.spawnedCount).toBe(1);
    expect(engine.fruit.kind).toBe('cherry');
    engine.player.x = 112; engine.player.y = 140;
    engine.update();
    expect(engine.fruit.visible).toBe(false);
    expect(engine.score).toBe(110);
    expect(getFruitCounter(engine.level)).toEqual(['cherry']);
    expect(getLevelConfig(2).fruit).toBe('strawberry');
    expect(getLevelConfig(2).fruitPoints).toBe(300);
  });

  it('shows the current round rather than the number of fruits eaten', () => {
    const engine = playing();
    engine.ghosts = [];
    expect(getFruitCounter(engine.level)).toEqual(['cherry']);
    expect(engine.collectedFruits).toEqual([]);
    expect(engine.fruitPickupCount).toBe(0);

    engine.fruit.framesRemaining = 10;
    engine.player.x = FRUIT_POSITION.x;
    engine.player.y = FRUIT_POSITION.y;
    engine.player.freezeFrames = 1;
    engine.update();
    expect(engine.score).toBe(100);
    expect(getFruitCounter(engine.level)).toEqual(['cherry']);
    expect(engine.collectedFruits).toEqual(['cherry']);
    expect(engine.fruitPickupCount).toBe(1);
    expect(engine.fruitScorePopup).toEqual({ points: 100, framesRemaining: FRUIT_SCORE_POPUP_FRAMES });

    engine.fruit.reset(1);
    engine.fruit.framesRemaining = 10;
    engine.player.freezeFrames = 1;
    engine.update();
    expect(engine.score).toBe(200);
    expect(getFruitCounter(engine.level)).toEqual(['cherry']);
    expect(engine.collectedFruits).toEqual(['cherry', 'cherry']);
    expect(engine.fruitPickupCount).toBe(2);

    engine.level = 2;
    expect(getFruitCounter(engine.level)).toEqual(['strawberry', 'cherry']);
    engine.fruit.reset(2);
    engine.fruit.framesRemaining = 10;
    engine.player.freezeFrames = 1;
    engine.update();
    expect(engine.score).toBe(500);
    expect(engine.collectedFruits).toEqual(['strawberry', 'cherry', 'cherry']);
    expect(engine.fruitScorePopup?.points).toBe(300);

    engine.state = 'GAME_OVER';
    engine.start();
    expect(getFruitCounter(engine.level)).toEqual(['cherry']);
    expect(engine.collectedFruits).toEqual([]);
    expect(engine.fruitPickupCount).toBe(0);
    expect(engine.fruitScorePopup).toBeNull();
  });

  it('holds fruit score feedback during pause, then expires without pausing play', () => {
    const engine = playing();
    engine.ghosts = [];
    engine.fruit.framesRemaining = 10;
    engine.player.x = FRUIT_POSITION.x;
    engine.player.y = FRUIT_POSITION.y;
    engine.player.freezeFrames = 1;
    engine.update();
    expect(engine.state).toBe('PLAYING');
    engine.pause();
    for (let frame = 0; frame < FRUIT_SCORE_POPUP_FRAMES; frame++) engine.update();
    expect(engine.fruitScorePopup?.framesRemaining).toBe(FRUIT_SCORE_POPUP_FRAMES);
    engine.togglePause();
    engine.player.freezeFrames = FRUIT_SCORE_POPUP_FRAMES + 1;
    for (let frame = 0; frame < FRUIT_SCORE_POPUP_FRAMES; frame++) engine.update();
    expect(engine.fruitScorePopup).toBeNull();
    expect(engine.state).toBe('PLAYING');
  });

  it('keeps the latest seven acquired fruits while counting every pickup', () => {
    const engine = playing();
    engine.ghosts = [];
    engine.player.x = FRUIT_POSITION.x;
    engine.player.y = FRUIT_POSITION.y;
    for (let pickup = 0; pickup < 8; pickup++) {
      engine.fruit.reset(1);
      engine.fruit.framesRemaining = 10;
      engine.player.freezeFrames = 1;
      engine.update();
    }
    expect(engine.score).toBe(800);
    expect(engine.fruitPickupCount).toBe(8);
    expect(engine.collectedFruits).toEqual(Array(7).fill('cherry'));
    expect(getFruitCounter(engine.level)).toEqual(['cherry']);
  });

  it('shows at most seven recent round symbols, newest on the left', () => {
    expect(getFruitCounter(7)).toEqual([
      'melon', 'apple', 'apple', 'peach', 'peach', 'strawberry', 'cherry',
    ]);
    expect(getFruitCounter(8)).toEqual([
      'melon', 'melon', 'apple', 'apple', 'peach', 'peach', 'strawberry',
    ]);
    expect(getFruitCounter(13)).toEqual([
      'key', 'bell', 'bell', 'galaxian', 'galaxian', 'melon', 'melon',
    ]);
    expect(getFruitCounter(19)).toEqual(Array(7).fill('key'));
  });

  it('offers the second fruit at 170 dots and removes it after its timed window', () => {
    const fruit = new FruitSystem();
    const random = new GameRandom();
    fruit.onDotCollected(174, random);
    expect(fruit.spawnedCount).toBe(1);
    fruit.hide();
    fruit.onDotCollected(74, random);
    expect(fruit.spawnedCount).toBe(2);
    expect(fruit.framesRemaining).toBeGreaterThanOrEqual(540);
    expect(fruit.framesRemaining).toBeLessThanOrEqual(600);
    const duration = fruit.framesRemaining;
    for (let frame = 0; frame < duration; frame++) fruit.tick();
    expect(fruit.visible).toBe(false);
    expect(fruit.collectAt(112, 140)).toBe(0);
    fruit.onDotCollected(0, random);
    expect(fruit.spawnedCount).toBe(2);
    expect(fruit.visible).toBe(false);
  });

  it('advances to a fresh maze and level settings after the clear animation', () => {
    const engine = playing();
    engine.ghosts = [];
    engine.maze.dots.clear();
    engine.maze.dots.set(tileIndex(2, 1), 'normal');
    enterDot(engine, 2, 1);
    engine.update();
    expect(engine.state).toBe('LEVEL_CLEAR');
    for (let frame = 0; frame < LEVEL_CLEAR_FRAMES; frame++) engine.update();
    expect(engine.state).toBe('READY');
    expect(engine.level).toBe(2);
    expect(getFruitCounter(engine.level)).toEqual(['strawberry', 'cherry']);
    expect(engine.maze.remainingDots).toBe(244);
    expect(engine.score).toBe(10);
    expect(engine.fruit.kind).toBe('strawberry');
    expect(engine.modeScheduler.remainingFrames).toBe(7 * 60);
  });

  it('repeats frightened choices and fruit timing from the same seed', () => {
    const a = new GameRandom(); const b = new GameRandom();
    expect(Array.from({ length: 20 }, () => a.nextInt(4)))
      .toEqual(Array.from({ length: 20 }, () => b.nextInt(4)));
    a.reset(); b.reset();
    expect(a.state).toBe(b.state);
  });
});
