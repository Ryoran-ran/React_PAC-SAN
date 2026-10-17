import { describe, expect, it } from 'vitest';
import { visibleDebugTarget } from '../rendering/DebugTarget';

describe('off-screen debug target display', () => {
  it('leaves targets inside the canvas at their actual positions', () => {
    expect(visibleDebugTarget({ x: 120, y: 160 }, { x: 180, y: 220 })).toEqual({ x: 180, y: 220 });
    expect(visibleDebugTarget({ x: 120, y: 160 }, { x: 204, y: 4 })).toEqual({ x: 204, y: 4 });
  });

  it('projects a distant AOSUKE target onto the maze edge along the same line', () => {
    const origin = { x: 200, y: 230 };
    const target = { x: 180, y: 340 };
    const visible = visibleDebugTarget(origin, target);
    expect(visible.y).toBe(269);
    expect(visible.x).toBeCloseTo(origin.x + (target.x - origin.x) * (39 / 110));
  });

  it.each([
    [{ x: 100, y: 100 }, { x: -100, y: 80 }, 'x', 3],
    [{ x: 100, y: 100 }, { x: 400, y: 80 }, 'x', 221],
    [{ x: 100, y: 100 }, { x: 80, y: -100 }, 'y', 27],
  ] as const)('keeps other off-screen markers visible', (origin, target, axis, edge) => {
    const visible = visibleDebugTarget(origin, target);
    expect(visible[axis]).toBe(edge);
    expect(visible.x).toBeGreaterThanOrEqual(3);
    expect(visible.x).toBeLessThanOrEqual(221);
    expect(visible.y).toBeGreaterThanOrEqual(27);
    expect(visible.y).toBeLessThanOrEqual(269);
  });
});
