import { describe, expect, it } from 'vitest';
import { READY_FRAMES } from '../config/constants';
import { GameEngine } from '../engine/GameEngine';
import { isAtTileCenter } from '../engine/CollisionSystem';
import { canGhostEnter } from '../map/tileRules';

describe('Phase 2 ghost integration', () => {
  it('keeps all outside ghosts on legal corridor centers during a long deterministic run', () => {
    const engine = new GameEngine();
    engine.start();
    // Hold the player inside the inaccessible house to inspect ghost routes
    // without ending the run through the new Phase 3 contact rules.
    engine.player.x = 108;
    engine.player.y = 116;
    for (let frame = 0; frame < READY_FRAMES + 5000; frame++) {
      engine.update();
      for (const ghost of engine.ghosts) {
        expect(Number.isInteger(ghost.x)).toBe(true);
        expect(Number.isInteger(ghost.y)).toBe(true);
        if (ghost.houseState === 'OUTSIDE' && isAtTileCenter(ghost)) {
          expect(
            canGhostEnter(Math.floor(ghost.x / 8), Math.floor(ghost.y / 8)),
            `${ghost.id} left the maze at frame ${engine.playFrame}: ${ghost.x},${ghost.y} ${ghost.direction}`,
          ).toBe(true);
        }
      }
    }
    expect(engine.modeScheduler.currentPhaseIndex).toBeGreaterThan(0);
    expect(engine.ghosts.every((ghost) => ghost.houseState === 'OUTSIDE')).toBe(true);
  });
});
