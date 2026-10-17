import { describe, expect, it } from 'vitest';
import { ModeScheduler } from '../ai/ModeScheduler';

describe('Phase 2 SCATTER / CHASE schedule', () => {
  it('switches on the exact frame and ends in an infinite chase', () => {
    const scheduler = new ModeScheduler([
      { mode: 'SCATTER', durationFrames: 2 },
      { mode: 'CHASE', durationFrames: 3 },
      { mode: 'SCATTER', durationFrames: 1 },
      { mode: 'CHASE', durationFrames: null },
    ]);
    expect(scheduler.mode).toBe('SCATTER');
    expect(scheduler.tick()).toBe(false);
    expect(scheduler.tick()).toBe(true);
    expect(scheduler.mode).toBe('CHASE');
    expect(scheduler.tick()).toBe(false);
    expect(scheduler.tick()).toBe(false);
    expect(scheduler.tick()).toBe(true);
    expect(scheduler.mode).toBe('SCATTER');
    expect(scheduler.tick()).toBe(true);
    expect(scheduler.mode).toBe('CHASE');
    expect(scheduler.remainingFrames).toBeNull();
    expect(scheduler.tick()).toBe(false);
  });

  it('returns to the first phase on reset', () => {
    const scheduler = new ModeScheduler([
      { mode: 'SCATTER', durationFrames: 1 },
      { mode: 'CHASE', durationFrames: null },
    ]);
    scheduler.tick();
    scheduler.reset();
    expect(scheduler.mode).toBe('SCATTER');
    expect(scheduler.remainingFrames).toBe(1);
  });
});
