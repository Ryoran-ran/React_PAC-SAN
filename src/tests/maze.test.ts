import { describe, expect, it } from 'vitest';
import { MAZE_COLUMNS, MAZE_ROWS, TILE_CENTER, TILE_SIZE } from '../config/constants';
import { Maze, tileIndex } from '../map/maze';
import { MAZE_LAYOUT } from '../map/mazeData';
import { canPlayerEnter, tileType } from '../map/tileRules';

describe('original maze topology', () => {
  it('has 28 × 31 tiles, 240 dots, four energizers and 2600 points', () => {
    const maze = new Maze();
    expect(MAZE_LAYOUT).toHaveLength(MAZE_ROWS);
    expect(MAZE_LAYOUT.every(row => row.length === MAZE_COLUMNS)).toBe(true);
    expect([...maze.dots.values()].filter(dot => dot === 'normal')).toHaveLength(240);
    expect([...maze.dots.values()].filter(dot => dot === 'power')).toHaveLength(4);
    expect([...maze.dots.values()].reduce((sum, dot) => sum + (dot === 'power' ? 50 : 10), 0)).toBe(2600);
  });

  it('makes every dot reachable from the player start, with house and void excluded', () => {
    const maze = new Maze();
    const pending = [{ x: 13, y: 23 }];
    const seen = new Set<number>();
    while (pending.length) {
      const tile = pending.pop()!;
      const x = (tile.x + MAZE_COLUMNS) % MAZE_COLUMNS;
      const index = tileIndex(x, tile.y);
      if (seen.has(index) || !canPlayerEnter(x, tile.y)) continue;
      seen.add(index);
      pending.push({ x: x - 1, y: tile.y }, { x: x + 1, y: tile.y }, { x, y: tile.y - 1 }, { x, y: tile.y + 1 });
    }
    for (const index of maze.dots.keys()) expect(seen.has(index), `unreachable dot ${index}`).toBe(true);
    expect(canPlayerEnter(13, 12)).toBe(false);
    expect(tileType(13, 12)).toBe('gate');
    expect(tileType(13, 14)).toBe('house');
    expect(canPlayerEnter(13, 14)).toBe(false);
    expect(canPlayerEnter(0, 10)).toBe(false);
    expect(canPlayerEnter(-1, 14)).toBe(true);
    expect(canPlayerEnter(-1, 13)).toBe(false);
  });

  it('places the four energizers at the original corners', () => {
    const maze = new Maze();
    const powers = [...maze.dots].filter(([, dot]) => dot === 'power').map(([index]) => index);
    expect(powers).toEqual([tileIndex(1, 3), tileIndex(26, 3), tileIndex(1, 23), tileIndex(26, 23)]);
  });

  it('consumes each dot once and keeps each maze instance independent', () => {
    const maze = new Maze();
    expect(maze.consumeAt(TILE_SIZE + TILE_CENTER, TILE_SIZE + TILE_CENTER)).toBe('normal');
    expect(maze.consumeAt(TILE_SIZE + TILE_CENTER, TILE_SIZE + TILE_CENTER)).toBeUndefined();
    expect(maze.remainingDots).toBe(243);
    expect(new Maze().remainingDots).toBe(244);
  });
});
