import { describe, expect, it } from 'vitest';
import { MAZE_OFFSET_Y, PLAYER_START, SCREEN_HEIGHT } from '../config/constants';
import { createGhosts } from '../entities/Ghost';
import { PacSan } from '../entities/PacSan';
import { drawDyingPlayer, drawGhost, drawLifeIcon, drawPlayer, ghostVisualX } from '../rendering/SpriteRenderer';

function recordingContext() {
  const rectangles: { x: number; y: number; width: number; height: number; color: string }[] = [];
  const context = {
    fillStyle: '#000000',
    fillRect(x: number, y: number, width: number, height: number) {
      rectangles.push({ x, y, width, height, color: String(this.fillStyle) });
    },
  } as CanvasRenderingContext2D;
  return { context, rectangles };
}

describe('arcade sprite pixels', () => {
  it('centers the ghost group in the house without changing its AI coordinates', () => {
    const ghosts = createGhosts();
    expect(ghosts.map((ghost) => ghost.x)).toEqual([108, 108, 92, 124]);
    expect(ghosts.map(ghostVisualX)).toEqual([112, 112, 96, 128]);
    ghosts[0].x = 92;
    expect(ghostVisualX(ghosts[0])).toBe(92);
  });

  it('draws the player, ghost, death frame and life icon with integer pixels only', () => {
    const { context, rectangles } = recordingContext();
    const player = new PacSan();
    player.x = PLAYER_START.x;
    player.y = PLAYER_START.y;
    drawPlayer(context, player);
    drawGhost(context, createGhosts()[0]);
    drawDyingPlayer(context, player, 70);
    drawLifeIcon(context, 12, SCREEN_HEIGHT - 7);
    expect(rectangles.length).toBeGreaterThan(40);
    expect(rectangles.every(({ x, y, width, height }) =>
      [x, y, width, height].every(Number.isInteger))).toBe(true);
    expect(rectangles.some(({ color }) => color === '#ffffff')).toBe(true);
  });

  it('leaves the ghost-house gate pixels unobscured', () => {
    const { context, rectangles } = recordingContext();
    drawGhost(context, createGhosts()[0]);
    const gateTop = MAZE_OFFSET_Y + 12 * 8 + 5;
    expect(rectangles.some(({ x, y, width, height }) =>
      x < 15 * 8 && x + width > 13 * 8
      && y < gateTop + 2 && y + height > gateTop)).toBe(false);
  });

  it('keeps every life icon pixel inside the canvas', () => {
    const { context, rectangles } = recordingContext();
    drawLifeIcon(context, 12, SCREEN_HEIGHT - 7);
    expect(rectangles.length).toBeGreaterThan(0);
    expect(rectangles.every(({ y, height }) => y >= 0 && y + height <= SCREEN_HEIGHT)).toBe(true);
  });
});
