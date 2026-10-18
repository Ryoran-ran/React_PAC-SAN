import { describe, expect, it } from 'vitest';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../config/constants';
import { GameEngine } from '../engine/GameEngine';
import { Renderer } from '../rendering/Renderer';

function targetMarkers(engine: GameEngine): number {
  let markers = 0;
  const context = {
    canvas: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
    fillStyle: '', strokeStyle: '', imageSmoothingEnabled: false,
    setTransform() {}, getTransform: () => ({ a: 1, d: 1, e: 0, f: 0 }),
    save() {}, restore() {}, translate() {}, fillRect() {},
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    strokeRect() { markers++; },
  } as unknown as CanvasRenderingContext2D;
  new Renderer(context).draw(engine);
  return markers;
}

describe('ghost debug targets', () => {
  it('follows ghost visibility and omits the unused frightened target', () => {
    const engine = new GameEngine();
    engine.start();
    engine.state = 'PLAYING';
    engine.debug = true;
    for (const key of Object.keys(engine.debugDisplay) as Array<keyof typeof engine.debugDisplay>) {
      engine.debugDisplay[key] = key === 'ghostTargets';
    }

    expect(targetMarkers(engine)).toBe(4);
    engine.ghosts[0].state = 'FRIGHTENED';
    expect(targetMarkers(engine)).toBe(3);

    engine.ghosts[0].state = 'EATEN';
    engine.ghosts[0].targetTile = { x: 13, y: 11 };
    expect(targetMarkers(engine)).toBe(4);

    engine.state = 'PLAYER_DYING';
    expect(targetMarkers(engine)).toBe(0);
    engine.state = 'LEVEL_CLEAR';
    expect(targetMarkers(engine)).toBe(0);
  });
});
