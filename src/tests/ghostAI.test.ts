import { describe, expect, it } from 'vitest';
import { chooseGhostDirection } from '../ai/GhostAI';
import { TILE_CENTER, TILE_SIZE } from '../config/constants';
import { createGhosts } from '../entities/Ghost';
import { moveGhost } from '../systems/MovementSystem';

describe('Phase 2 ghost direction choice', () => {
  it('excludes reverse direction and resolves equal distance as up, left, down, right', () => {
    const choice = chooseGhostDirection({ x: 6, y: 5 }, 'right', { x: 7, y: 4 });
    expect(choice.decision.candidates).not.toContain('left');
    expect(choice.chosen).toBe('up');
  });

  it('respects the four original no-up decision tiles', () => {
    const choice = chooseGhostDirection({ x: 12, y: 23 }, 'right', { x: 12, y: 0 });
    expect(choice.decision.candidates).not.toContain('up');
  });

  it('queues a mode reversal until the next tile center', () => {
    const ghost = createGhosts()[0];
    ghost.x = 6 * TILE_SIZE + TILE_CENTER + 1;
    ghost.y = 5 * TILE_SIZE + TILE_CENTER;
    ghost.direction = 'right';
    ghost.targetTile = { x: 20, y: 5 };
    ghost.requestReverse();

    for (let update = 0; update < 8; update++) moveGhost(ghost);
    expect(ghost.x).toBe(7 * TILE_SIZE + TILE_CENTER);
    expect(ghost.pendingReverse).toBe(true);
    moveGhost(ghost);
    expect(ghost.direction).toBe('left');
    expect(ghost.pendingReverse).toBe(false);
    expect(ghost.x).toBe(7 * TILE_SIZE + TILE_CENTER - 1);
  });
});
