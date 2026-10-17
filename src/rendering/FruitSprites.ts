import { MAZE_OFFSET_Y } from '../config/constants';
import type { FruitKind } from '../config/levelTables';

interface FruitSprite {
  readonly palette: readonly string[];
  readonly pixels: readonly string[];
}

// Visible 14x14 arcade bonus sprites. A dot is transparent; 1-3 index the palette.
// Reference: https://github.com/sgothel/pacman/blob/master/media/tiles_all.png
const FRUIT_SPRITES: Record<FruitKind, FruitSprite> = {
  cherry: {
    palette: ['#ffb751', '#ff0000', '#dedeff'],
    pixels: [
      '..............', '...........11.', '.........1111.', '.......11.1...',
      '......1...1...', '..2221...1....', '.222122.1.....', '.22222.2122...',
      '.2322.221222..', '.2232.222222..', '..222.232222..', '......223222..',
      '.......2222...', '..............',
    ],
  },
  strawberry: {
    palette: ['#dedeff', '#00ff00', '#ff0000'],
    pixels: [
      '..............', '......1.......', '...2221222....', '..332222233...',
      '.33333233313..', '.31333331333..', '.33313133333..', '.33333333133..',
      '..313313333...', '..333333333...', '...331331.....', '....33333.....',
      '......3.......', '..............',
    ],
  },
  peach: {
    palette: ['#00ff00', '#ffb751'],
    pixels: [
      '..............', '........11....', '......211111..', '......2.111...',
      '...22222222...', '..2222222222..', '.222222222222.', '.222222222222.',
      '.222222222222.', '.222222222222.', '..2222222222..', '..2222222222..',
      '....222222....', '..............',
    ],
  },
  apple: {
    palette: ['#ffb751', '#ff0000', '#dedeff'],
    pixels: [
      '..............', '.......1......', '..222.1.222...', '.22222122222..',
      '.222222222222.', '.222222222222.', '.222222222222.', '.222222222322.',
      '.222222222322.', '..2222222322..', '..2222222222..', '...22222222...',
      '....22.222....', '..............',
    ],
  },
  melon: {
    palette: ['#47b7ff', '#00ff00', '#dedeff'],
    pixels: [
      '....1.........', '.....11111....', '.......1......', '......232.....',
      '....2221222...', '...213122212..', '...221223122..', '..23122212122.',
      '..21223122312.', '..23122212222.', '...221313122..', '...222122212..',
      '....2122212...', '......221.....',
    ],
  },
  galaxian: {
    palette: ['#ff0000', '#2121ff', '#ffff00'],
    pixels: [
      '..............', '..............', '......1.......', '.2...111...2..',
      '.2..11111..2..', '.23113131132..', '.23333133332..', '.22333333322..',
      '..223.3.322...', '...22.3.22....', '....2.3.2.....', '......3.......',
      '......3.......', '..............',
    ],
  },
  bell: {
    palette: ['#ffff00', '#47b7ff', '#dedeff'],
    pixels: [
      '..............', '......11......', '....11..11....', '...11111111...',
      '...11.11111...', '...1.111111...', '..11.1111111..', '..11.1111111..',
      '..1111111111..', '.11.111111111.', '.11.111111111.', '.111111111111.',
      '.122222332221.', '..2222233222..',
    ],
  },
  key: {
    palette: ['#47b7ff', '#dedeff'],
    pixels: [
      '..............', '.....111......', '...11...11....', '...1111111....',
      '...1111111....', '...1111111....', '.....2.2......', '.....2.22.....',
      '.....2.2......', '.....2........', '.....2.2......', '.....2.22.....',
      '.....2.2......', '......2.......',
    ],
  },
};

export function drawFruit(context: CanvasRenderingContext2D, kind: FruitKind, x: number, y: number): void {
  const sprite = FRUIT_SPRITES[kind];
  const left = Math.round(x) - 7;
  const top = Math.round(y + MAZE_OFFSET_Y) - 7;
  context.save();
  for (let row = 0; row < sprite.pixels.length; row++) {
    const pixels = sprite.pixels[row];
    for (let column = 0; column < pixels.length;) {
      const pixel = pixels[column];
      if (pixel === '.') { column++; continue; }
      let end = column + 1;
      while (end < pixels.length && pixels[end] === pixel) end++;
      context.fillStyle = sprite.palette[pixel.charCodeAt(0) - 49];
      context.fillRect(left + column, top + row, end - column, 1);
      column = end;
    }
  }
  context.restore();
}
