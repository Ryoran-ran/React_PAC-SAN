import { MAZE_COLUMNS, MAZE_ROWS, TILE_SIZE } from '../config/constants';
import { MAZE_LAYOUT } from './mazeData';

export type Dot = 'normal' | 'power';
export const tileIndex = (column: number, row: number) => row * MAZE_COLUMNS + column;

export class Maze {
  readonly dots = new Map<number, Dot>();

  constructor() {
    if (MAZE_LAYOUT.length !== MAZE_ROWS || MAZE_LAYOUT.some(row => row.length !== MAZE_COLUMNS)) {
      throw new Error('Maze must contain exactly 28 × 31 tiles.');
    }
    for (let y = 0; y < MAZE_ROWS; y++) {
      for (let x = 0; x < MAZE_COLUMNS; x++) {
        const symbol = MAZE_LAYOUT[y][x];
        if (symbol === '.' || symbol === 'o') {
          this.dots.set(tileIndex(x, y), symbol === 'o' ? 'power' : 'normal');
        }
      }
    }
  }

  get remainingDots(): number { return this.dots.size; }

  consumeAt(x: number, y: number): Dot | undefined {
    const index = tileIndex(Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE));
    const dot = this.dots.get(index);
    if (dot) this.dots.delete(index);
    return dot;
  }
}
