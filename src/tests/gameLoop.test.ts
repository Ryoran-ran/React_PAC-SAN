import { describe, expect, it } from 'vitest';
import { FixedStepClock } from '../engine/GameLoop';

describe('fixed 60 Hz clock', () => {
  it.each([30, 60, 120, 144])('runs exactly 600 updates in ten seconds rendered at %i Hz', refresh => {
    const clock = new FixedStepClock(); let updates = 0;
    clock.advance(0, () => updates++);
    for (let i = 1; i <= refresh * 10; i++) clock.advance(i * 1000 / refresh, () => updates++);
    expect(updates).toBe(600);
  });

  it('preserves elapsed time across irregular, dropped render frames', () => {
    const clock = new FixedStepClock(); let updates = 0;
    for (const timestamp of [0, 3, 12, 20, 90, 112, 500, 503, 1000]) clock.advance(timestamp, () => updates++);
    expect(updates).toBe(60);
  });

  it('retains catch-up work beyond the render budget instead of dropping it', () => {
    const clock = new FixedStepClock(); let updates = 0;
    clock.advance(0, () => updates++);
    expect(clock.advance(10000, () => updates++)).toBe(240);
    clock.advance(10000, () => updates++); clock.advance(10000, () => updates++);
    expect(updates).toBe(600);
  });

  it('resets elapsed time when returning from an inactive browser tab', () => {
    const clock = new FixedStepClock(); let updates = 0;
    clock.advance(0, () => updates++); clock.advance(1000, () => updates++);
    clock.reset(); clock.advance(100000, () => updates++);
    expect(updates).toBe(60);
    clock.advance(100100, () => updates++); expect(updates).toBe(66);
  });

  it.each([0.5, 1, 2, 4] as const)('advances the same fixed simulation at %s× speed', speed => {
    const clock = new FixedStepClock(); let updates = 0;
    clock.setSpeed(speed);
    clock.advance(0, () => updates++);
    for (let i = 1; i <= 120; i++) clock.advance(i * 1000 / 120, () => updates++);
    expect(updates).toBe(60 * speed);
  });

  it('changes speed without resetting partial frame progress', () => {
    const clock = new FixedStepClock(); let updates = 0;
    clock.advance(0, () => updates++);
    clock.advance(1000 / 120, () => updates++);
    expect(updates).toBe(0);
    clock.setSpeed(0.5);
    clock.advance(1000 / 40, () => updates++);
    expect(updates).toBe(1);
  });
});
