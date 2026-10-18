import { describe, expect, it } from 'vitest';
import { EXTRA_LIFE_SCORE, READY_FRAMES, TILE_CENTER, TILE_SIZE } from '../config/constants';
import { GameEngine } from '../engine/GameEngine';
import type { SoundCue } from '../engine/SoundCue';
import { tileIndex } from '../map/maze';
import { FRUIT_POSITION } from '../systems/FruitSystem';

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

describe('game sound cues', () => {
  it('plays start once and distinguishes ordinary and power dots', () => {
    const engine = new GameEngine();
    const cues: SoundCue[] = [];
    engine.onSound = (cue) => cues.push(cue);
    engine.start();
    engine.start();
    expect(cues).toEqual(['start']);
    for (let frame = 0; frame < READY_FRAMES; frame++) engine.update();
    engine.ghosts = [];
    enterDot(engine, 2, 1);
    engine.update();
    enterDot(engine, 1, 3);
    engine.update();
    expect(cues).toEqual(['start', 'dot', 'power']);
  });

  it('signals fruit pickup, ghost capture, and death at their actual events', () => {
    const engine = playing();
    const cues: SoundCue[] = [];
    engine.onSound = (cue) => cues.push(cue);
    const ghost = engine.ghosts[0];
    engine.ghosts = [ghost];
    ghost.houseState = 'OUTSIDE';
    ghost.state = 'FRIGHTENED';
    ghost.x = at(1);
    ghost.y = at(3);
    engine.player.x = at(1);
    engine.player.y = at(3);
    engine.player.freezeFrames = 1;
    engine.update();
    expect(cues).toContain('ghost');

    engine.ghostEatFreezeFrames = 0;
    ghost.state = 'NORMAL';
    engine.frightenedFramesRemaining = 0;
    engine.player.freezeFrames = 1;
    engine.update();
    expect(cues).toContain('death');

    const next = playing();
    const fruitCues: SoundCue[] = [];
    next.onSound = (cue) => fruitCues.push(cue);
    next.ghosts = [];
    next.fruit.framesRemaining = 10;
    next.player.x = FRUIT_POSITION.x;
    next.player.y = FRUIT_POSITION.y;
    next.player.freezeFrames = 1;
    next.update();
    expect(fruitCues).toContain('fruit');
  });

  it('signals an extra life once and replaces the last dot cue with level clear', () => {
    const engine = playing();
    const cues: SoundCue[] = [];
    engine.onSound = (cue) => cues.push(cue);
    engine.ghosts = [];
    engine.score = EXTRA_LIFE_SCORE - 10;
    enterDot(engine, 2, 1);
    engine.update();
    expect(cues.filter((cue) => cue === 'extraLife')).toHaveLength(1);
    enterDot(engine, 3, 1);
    engine.update();
    expect(cues.filter((cue) => cue === 'extraLife')).toHaveLength(1);

    engine.maze.dots.clear();
    engine.maze.dots.set(tileIndex(4, 1), 'normal');
    enterDot(engine, 4, 1);
    engine.update();
    expect(engine.state).toBe('LEVEL_CLEAR');
    expect(cues.at(-1)).toBe('levelClear');
  });
});
