import { describe, expect, it } from 'vitest';
import type { Direction } from '../config/constants';
import { GameEngine } from '../engine/GameEngine';
import { attachSwipe } from '../input/SwipeController';

function pointer(target: EventTarget, type: string, x: number, y: number,
  pointerType = 'touch', pointerId = 1, isPrimary = true): void {
  const event = new Event(type);
  Object.defineProperties(event, {
    clientX: { value: x }, clientY: { value: y },
    pointerType: { value: pointerType }, pointerId: { value: pointerId },
    isPrimary: { value: isPrimary },
  });
  target.dispatchEvent(event);
}

describe('swipe controls', () => {
  it('queues a turn during the swipe and takes control from auto-play', () => {
    const engine = new GameEngine();
    engine.start();
    engine.toggleDebug();
    engine.setAutoPlayLevel('tas');
    const target = new EventTarget();
    const detach = attachSwipe(target as unknown as HTMLElement,
      (direction) => engine.requestDirection(direction));

    pointer(target, 'pointerdown', 30, 30);
    pointer(target, 'pointermove', 42, 32);
    expect(engine.autoPlayLevel).toBe('tas');
    pointer(target, 'pointermove', 50, 32);
    expect(engine.player.requestedDirection).toBe('right');
    expect(engine.autoPlayLevel).toBeNull();
    pointer(target, 'pointermove', 52, 52);
    expect(engine.player.requestedDirection).toBe('down');

    pointer(target, 'pointerup', 52, 52);
    detach();
  });

  it('recognizes quick flicks while ignoring mouse, secondary touches and canceled gestures', () => {
    const target = new EventTarget();
    const directions: Direction[] = [];
    const detach = attachSwipe(target as unknown as HTMLElement,
      (direction) => directions.push(direction));

    pointer(target, 'pointerdown', 50, 50, 'mouse');
    pointer(target, 'pointerup', 20, 50, 'mouse');
    pointer(target, 'pointerdown', 50, 50, 'touch', 2, false);
    pointer(target, 'pointerup', 20, 50, 'touch', 2, false);
    expect(directions).toEqual([]);

    pointer(target, 'pointerdown', 50, 50);
    pointer(target, 'pointerup', 20, 50);
    expect(directions).toEqual(['left']);

    pointer(target, 'pointerdown', 50, 50);
    pointer(target, 'pointercancel', 50, 50);
    pointer(target, 'pointermove', 50, 20);
    expect(directions).toEqual(['left']);

    detach();
    pointer(target, 'pointerdown', 50, 50);
    pointer(target, 'pointerup', 50, 20);
    expect(directions).toEqual(['left']);
  });
});
