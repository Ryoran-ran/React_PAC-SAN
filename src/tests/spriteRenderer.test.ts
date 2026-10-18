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
    expect(rectangles.some(({ color }) => color === '#dedeff')).toBe(true);
  });

  it('places both eyes like the four arcade direction frames, including eyes-only ghosts', () => {
    const ghost = createGhosts()[1];
    ghost.state = 'EATEN';
    const left = Math.round(ghostVisualX(ghost)) - 7;
    const top = Math.round(ghost.y + MAZE_OFFSET_Y) - 7;
    const pupils = {
      right: [[5, 5], [11, 5]],
      left: [[1, 5], [7, 5]],
      up: [[3, 1], [9, 1]],
      down: [[3, 7], [9, 7]],
    } as const;

    for (const direction of ['right', 'left', 'up', 'down'] as const) {
      ghost.direction = direction;
      const { context, rectangles } = recordingContext();
      drawGhost(context, ghost);
      const colorAt = (x: number, y: number) => rectangles.find(({ x: rx, y: ry, width }) =>
        rx <= left + x && left + x < rx + width && ry === top + y)?.color;

      for (const [x, y] of pupils[direction]) {
        expect(colorAt(x, y)).toBe('#2121ff');
        expect(colorAt(x + 1, y + 1)).toBe('#2121ff');
      }
      expect(rectangles.filter(({ color }) => color === '#dedeff').length).toBeGreaterThan(0);
      expect(rectangles.every(({ color }) => color === '#dedeff' || color === '#2121ff')).toBe(true);
    }
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
