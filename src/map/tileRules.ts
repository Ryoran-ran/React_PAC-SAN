import { MAZE_COLUMNS, MAZE_ROWS, TUNNEL_ROW } from '../config/constants';
import { MAZE_LAYOUT } from './mazeData';

export type TileType = 'wall' | 'void' | 'house' | 'gate' | 'corridor';

export function tileType(column: number, row: number): TileType {
  if (row < 0 || row >= MAZE_ROWS) return 'void';
  if (column < 0 || column >= MAZE_COLUMNS) {
    return row === TUNNEL_ROW ? 'corridor' : 'void';
  }
  switch (MAZE_LAYOUT[row][column]) {
    case '#': return 'wall';
    case '_': return 'void';
    case 'H': return 'house';
    case '=': return 'gate';
    default: return 'corridor';
  }
}

export const canPlayerEnter = (column: number, row: number): boolean =>
  tileType(column, row) === 'corridor';

// Stored now for Phase 2; these restrictions never affect the player.
export const GHOST_NO_UP_TILES = [
  { x: 12, y: 11 }, { x: 15, y: 11 },
  { x: 12, y: 23 }, { x: 15, y: 23 },
] as const;
