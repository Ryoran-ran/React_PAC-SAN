import { describe, expect, it, vi } from 'vitest';
import { MAZE_ROWS, SCREEN_WIDTH, TILE_SIZE } from '../config/constants';
import { drawCookie } from '../rendering/CookieRenderer';
import { MazeRenderer } from '../rendering/MazeRenderer';
import { drawLifeIcon } from '../rendering/SpriteRenderer';

function recordingContext() {
  const pixels: Array<{ x: number; y: number; width: number; height: number }> = [];
  const context = {
    fillStyle: '',
    fillRect(x: number, y: number, width: number, height: number) {
      pixels.push({ x, y, width, height });
    },
  } as CanvasRenderingContext2D;
  return { context, pixels };
}

describe('pixel-art field', () => {
  it('places the arcade wall bitmap at its native screen coordinates', () => {
    class LoadedImage {
      src = '';
      complete = true;
      naturalWidth = SCREEN_WIDTH;
      naturalHeight = 288;
    }
    vi.stubGlobal('Image', LoadedImage);
    try {
      const calls: unknown[][] = [];
      const context = {
        fillStyle: '',
        drawImage(...args: unknown[]) { calls.push(args); },
        fillRect() { throw new Error('The loaded artwork already contains the gate'); },
      } as unknown as CanvasRenderingContext2D;
      new MazeRenderer().draw(context);
      expect(calls).toHaveLength(1);
      expect(calls[0].slice(1)).toEqual([0, -24]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('draws every maze outline segment on integer logical pixels', () => {
    const { context, pixels } = recordingContext();
    new MazeRenderer().draw(context);
    expect(pixels.length).toBeGreaterThan(100);
    expect(pixels.every(({ x, y, width, height }) =>
      [x, y, width, height].every(Number.isInteger)
      && width > 0 && height > 0
      && x >= 0 && y >= 0
      && x + width <= SCREEN_WIDTH && y + height <= MAZE_ROWS * TILE_SIZE)).toBe(true);
  });

  it('renders small dots and energizers with opaque pixel rectangles', () => {
    const { context, pixels } = recordingContext();
    drawCookie(context, 12, 12, false);
    expect(pixels).toEqual([{ x: 11, y: 11, width: 2, height: 2 }]);
    pixels.length = 0;
    drawCookie(context, 12, 12, true);
    expect(pixels).toHaveLength(8);
    expect(pixels[0]).toEqual({ x: 10, y: 8, width: 4, height: 1 });
    expect(pixels[3]).toEqual({ x: 8, y: 11, width: 8, height: 1 });
  });

  it('keeps every cookie the same pixel size at a fractional display scale', () => {
    const { context, pixels } = recordingContext();
    drawCookie(context, 20.2, 20.2, false, 1.33);
    drawCookie(context, 39.9, 39.9, false, 1.33);
    expect(pixels.map(({ width, height }) => [width, height])).toEqual([[3, 3], [3, 3]]);
    pixels.length = 0;
    drawCookie(context, 20.2, 20.2, true, 1.33);
    const firstShape = pixels.map(({ x, y, width, height }) =>
      [x - pixels[0].x, y - pixels[0].y, width, height]);
    pixels.length = 0;
    drawCookie(context, 39.9, 39.9, true, 1.33);
    expect(pixels.map(({ x, y, width, height }) =>
      [x - pixels[0].x, y - pixels[0].y, width, height])).toEqual(firstShape);
  });

  it('keeps the resting Pac-Man mouth open with a solid stepped silhouette', () => {
    const { context, pixels } = recordingContext();
    drawLifeIcon(context, 20, 20);
    const filled = (x: number, y: number) => pixels.some((rect) =>
      x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height);
    expect(filled(14, 20)).toBe(true);
    expect(filled(26, 20)).toBe(false);
    expect(filled(20, 14)).toBe(true);
    expect(filled(20, 26)).toBe(true);
  });
});
