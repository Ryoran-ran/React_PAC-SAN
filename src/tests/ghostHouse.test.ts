import { describe, expect, it } from 'vitest';
import { GhostHouse } from '../ai/GhostHouse';
import { GHOST_HOUSE_IDLE_RELEASE_FRAMES } from '../config/levelTables';
import { createGhosts } from '../entities/Ghost';

describe('Phase 2 ghost house', () => {
  it('starts Blinky outside and releases Pinky first', () => {
    const ghosts = createGhosts();
    const house = new GhostHouse();
    expect(ghosts.map((ghost) => ghost.houseState)).toEqual([
      'OUTSIDE', 'PACING_HOME', 'PACING_HOME', 'PACING_HOME',
    ]);
    house.update(ghosts);
    expect(ghosts.find((ghost) => ghost.id === 'pinky')?.houseState).toBe('LEAVING_HOME');
  });

  it('releases Inky after 30 dots, then Clyde after 60', () => {
    const ghosts = createGhosts();
    const house = new GhostHouse();
    for (let i = 0; i < 60; i++) house.onDotConsumed();
    for (let frame = 0; frame < 300; frame++) house.update(ghosts);
    expect(ghosts.every((ghost) => ghost.houseState === 'OUTSIDE')).toBe(true);
  });

  it('uses the idle timer when the dot counter stalls', () => {
    const ghosts = createGhosts();
    const house = new GhostHouse();
    while (ghosts.find((ghost) => ghost.id === 'pinky')?.houseState !== 'OUTSIDE') {
      house.update(ghosts);
    }
    for (let frame = 0; frame < GHOST_HOUSE_IDLE_RELEASE_FRAMES; frame++) house.update(ghosts);
    expect(ghosts.find((ghost) => ghost.id === 'inky')?.houseState).not.toBe('PACING_HOME');
  });
});
