import { COLORS, MAZE_OFFSET_Y, SCREEN_WIDTH, TILE_SIZE } from '../config/constants';
import type { Ghost } from '../entities/Ghost';
import type { PacSan } from '../entities/PacSan';
import { tileType } from '../map/tileRules';

// Arcade-sized 14x14 sprites. All drawing uses whole logical pixels, like the fruit art.
const FRIGHTENED_HEAD = [
  '.....####.....',
  '...########...',
  '..##########..',
  '.############.',
  '.############.',
  '.###oo##oo###.',
  '####oo##oo####',
  '##############',
  '##############',
  '##oo##oo##oo##',
  '#o##oo##oo##o#',
  '##############',
] as const;
const GHOST_HEAD = FRIGHTENED_HEAD.map((row) => row.replaceAll('o', '#'));
const GHOST_FEET = [
  ['####.####.####', '.##...##...##.'],
  ['##.###..###.##', '#...##..##...#'],
] as const;
const EYE_WHITE = ['.##.', '####', '####', '####', '.##.'] as const;

// 13x13 visible pixels from the arcade sprite sheet. The hardware sprite box
// is larger, but the yellow art itself is 13 pixels wide and high.
// Reference: https://github.com/sgothel/pacman/blob/master/media/tiles_all.txt
const PAC_CLOSED = [
  '....#####....', '..#########..', '.###########.', '.###########.',
  '#############', '#############', '#############', '#############',
  '#############', '.###########.', '.###########.', '..#########..',
  '....#####....',
] as const;
const PAC_MOUTHS: Record<PacSan['direction'], readonly [readonly string[], readonly string[]]> = {
  left: [
    [
      '....#####....', '....#######..', '.....#######.', '......######.',
      '.......######', '........#####', '.........####', '........#####',
      '.......######', '......######.', '.....#######.', '....#######..',
      '....#####....',
    ],
    [
      '....#####....', '..#########..', '.###########.', '.###########.',
      '...##########', '......#######', '.........####', '......#######',
      '...##########', '.###########.', '.###########.', '..#########..',
      '....#####....',
    ],
  ],
  right: [
    [
      '....#####....', '..#######....', '.#######.....', '.######......',
      '######.......', '#####........', '####.........', '#####........',
      '######.......', '.######......', '.#######.....', '..#######....',
      '....#####....',
    ],
    [
      '....#####....', '..#########..', '.###########.', '.###########.',
      '##########...', '#######......', '####.........', '#######......',
      '##########...', '.###########.', '.###########.', '..#########..',
      '....#####....',
    ],
  ],
  up: [
    [
      '.............', '.............', '.............', '.............',
      '##.........##', '###.......###', '####.....####', '#####...#####',
      '######.######', '.###########.', '.###########.', '..#########..',
      '....#####....',
    ],
    [
      '.............', '..##.....##..', '.###.....###.', '.####...####.',
      '#####...#####', '#####...#####', '######.######', '######.######',
      '#############', '.###########.', '.###########.', '..#########..',
      '....#####....',
    ],
  ],
  down: [
    [
      '....#####....', '..#########..', '.###########.', '.###########.',
      '######.######', '#####...#####', '####.....####', '###.......###',
      '##.........##', '.............', '.............', '.............',
      '.............',
    ],
    [
      '....#####....', '..#########..', '.###########.', '.###########.',
      '#############', '######.######', '######.######', '#####...#####',
      '#####...#####', '.####...####.', '.###.....###.', '..##.....##..',
      '.............',
    ],
  ],
};

/** The wall outline sits four pixels inside a wall tile; keep sprites one pixel clear of it. */
function visibleSpritePixel(screenX: number, screenY: number): boolean {
  // Keep the two-pixel ghost-house gate in the maze artwork visible.
  if (screenX >= 13 * TILE_SIZE && screenX < 15 * TILE_SIZE
    && screenY >= MAZE_OFFSET_Y + 12 * TILE_SIZE + 5
    && screenY < MAZE_OFFSET_Y + 12 * TILE_SIZE + 7) return false;
  const mazeY = screenY - MAZE_OFFSET_Y;
  const column = Math.floor(screenX / TILE_SIZE);
  const row = Math.floor(mazeY / TILE_SIZE);
  const current = tileType(column, row);
  if (current === 'corridor' || current === 'house' || current === 'gate') return true;
  if (current !== 'wall') return false;
  const localX = ((screenX % TILE_SIZE) + TILE_SIZE) % TILE_SIZE;
  const localY = ((mazeY % TILE_SIZE) + TILE_SIZE) % TILE_SIZE;
  const isOpen = (x: number, y: number) => {
    const kind = tileType(x, y);
    return kind === 'corridor' || kind === 'house' || kind === 'gate';
  };
  return (localX <= 2 && isOpen(column - 1, row))
    || (localX >= 5 && isOpen(column + 1, row))
    || (localY <= 2 && isOpen(column, row - 1))
    || (localY >= 5 && isOpen(column, row + 1));
}

function paintPixels(context: CanvasRenderingContext2D, rows: readonly string[],
  left: number, top: number, palette: Record<string, string>, clipToMaze = true): void {
  for (let row = 0; row < rows.length; row++) {
    const pixels = rows[row];
    for (let column = 0; column < pixels.length;) {
      const color = palette[pixels[column]];
      if (!color || (clipToMaze && !visibleSpritePixel(left + column, top + row))) { column++; continue; }
      let end = column + 1;
      while (end < pixels.length && palette[pixels[end]] === color
        && (!clipToMaze || visibleSpritePixel(left + end, top + row))) end++;
      context.fillStyle = color;
      context.fillRect(left + column, top + row, end - column, 1);
      column = end;
    }
  }
}

export function drawPlayer(context: CanvasRenderingContext2D, player: PacSan): void {
  const phase = Math.floor(player.steps / 3) % 4;
  const rows = phase === 2 ? PAC_CLOSED : PAC_MOUTHS[player.direction][phase === 0 ? 0 : 1];
  for (const offset of [-SCREEN_WIDTH, 0, SCREEN_WIDTH]) {
    paintPixels(context, rows, Math.round(player.x + offset) - 6,
      Math.round(player.y + MAZE_OFFSET_Y) - 6, { '#': COLORS.player });
  }
}

export function drawLifeIcon(context: CanvasRenderingContext2D, x: number, y: number): void {
  paintPixels(context, PAC_MOUTHS.right[0], x - 6, y - 6,
    { '#': COLORS.player }, false);
}

export function drawDyingPlayer(context: CanvasRenderingContext2D, player: PacSan, framesRemaining: number): void {
  const progress = 1 - framesRemaining / 90;
  const radius = Math.max(0, 6.4 * (1 - Math.max(0, progress - 0.35) / 0.65));
  if (radius <= 0) return;
  const rows = PAC_CLOSED.map((line, y) => Array.from(line, (pixel, x) => {
    const dx = x - 6;
    const dy = y - 6;
    const angle = Math.atan2(dx, -dy);
    return dx * dx + dy * dy <= radius * radius && Math.abs(angle) >= progress * Math.PI
      ? pixel : '.';
  }).join(''));
  paintPixels(context, rows, Math.round(player.x) - 6,
    Math.round(player.y + MAZE_OFFSET_Y) - 6, { '#': COLORS.player });
}

function drawEyes(context: CanvasRenderingContext2D, left: number, top: number,
  direction: Ghost['direction']): void {
  const pupilX = direction === 'left' ? 0 : direction === 'right' ? 2 : 1;
  const pupilY = direction === 'up' ? 0 : direction === 'down' ? 3 : 1;
  for (const eyeX of [2, 8]) {
    paintPixels(context, EYE_WHITE, left + eyeX, top + 4, { '#': '#ffffff' });
    paintPixels(context, ['##', '##'], left + eyeX + pupilX,
      top + 4 + pupilY, { '#': '#2121b5' });
  }
}

/** The arcade house is centered between columns 13 and 14, while AI uses tile centers. */
export function ghostVisualX(ghost: Ghost): number {
  const houseX = 13 * TILE_SIZE + TILE_SIZE / 2;
  const offset = SCREEN_WIDTH / 2 - houseX;
  if (ghost.houseState !== 'OUTSIDE') return ghost.x + offset;
  // Ease the drawing back onto tile centers after leaving the gate, avoiding
  // a four-pixel jump on the first movement frame.
  const distance = Math.abs(ghost.x - houseX) + Math.abs(ghost.y - (11 * TILE_SIZE + TILE_SIZE / 2));
  return ghost.x + Math.max(0, offset - Math.floor(distance / 4));
}

export function drawGhost(context: CanvasRenderingContext2D, ghost: Ghost, flash = false): void {
  const y = Math.round(ghost.y + MAZE_OFFSET_Y) - 7;
  const footFrame = Math.floor(ghost.stepsMoved / 4) % 2;
  for (const offset of [-SCREEN_WIDTH, 0, SCREEN_WIDTH]) {
    const x = Math.round(ghostVisualX(ghost) + offset) - 7;
    if (ghost.state === 'FRIGHTENED') {
      paintPixels(context, [...FRIGHTENED_HEAD, ...GHOST_FEET[footFrame]], x, y, {
        '#': flash ? '#dedeff' : '#2121ff',
        o: flash ? '#ff0000' : '#ffb7ae',
      });
      continue;
    }
    if (ghost.state === 'NORMAL') {
      paintPixels(context, [...GHOST_HEAD, ...GHOST_FEET[footFrame]], x, y, { '#': ghost.color });
    }
    drawEyes(context, x, y, ghost.direction);
  }
}
