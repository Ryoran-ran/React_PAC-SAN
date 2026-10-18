import { describe, expect, it } from 'vitest';
import {
  getBlinkyTarget,
  getClydeTarget,
  getInkyTarget,
  getPinkyTarget,
} from '../ai/Targeting';

describe('Phase 2 ghost target calculations', () => {
  it('targets the player tile for Blinky', () => {
    expect(getBlinkyTarget({ x: 14, y: 23 })).toEqual({ x: 14, y: 23 });
  });

  it('targets four tiles ahead for Pinky in the facing direction', () => {
    expect(getPinkyTarget({ x: 14, y: 23 }, 'left')).toEqual({ x: 10, y: 23 });
    expect(getPinkyTarget({ x: 14, y: 23 }, 'up')).toEqual({ x: 14, y: 19 });
  });

  it('doubles Inky\'s vector from Blinky through the two-ahead pivot', () => {
    expect(getInkyTarget({ x: 14, y: 23 }, 'right', { x: 10, y: 10 }))
      .toEqual({ x: 22, y: 36 });
    expect(getInkyTarget({ x: 14, y: 23 }, 'up', { x: 10, y: 10 }))
      .toEqual({ x: 18, y: 32 });
  });

  it('makes Clyde chase at eight tiles and scatter inside that radius', () => {
    const player = { x: 10, y: 10 };
    const corner = { x: 0, y: 31 };
    expect(getClydeTarget({ x: 18, y: 10 }, player, corner)).toEqual(player);
    expect(getClydeTarget({ x: 17, y: 10 }, player, corner)).toEqual(corner);
  });
});
