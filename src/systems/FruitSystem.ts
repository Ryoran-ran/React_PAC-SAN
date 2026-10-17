import { TILE_SIZE, TOTAL_DOTS } from '../config/constants';
import { getLevelConfig, type FruitKind } from '../config/levelTables';
import type { GameRandom } from '../engine/Random';

export const FRUIT_POSITION = { x: 112, y: 140 } as const;
export const FRUIT_SPAWN_DOTS = [70, 170] as const;

export class FruitSystem {
  kind: FruitKind = 'cherry';
  points = 100;
  spawnedCount = 0;
  framesRemaining = 0;

  get visible(): boolean { return this.framesRemaining > 0; }

  reset(level: number): void {
    const config = getLevelConfig(level);
    this.kind = config.fruit;
    this.points = config.fruitPoints;
    this.spawnedCount = 0;
    this.framesRemaining = 0;
  }

  onDotCollected(remainingDots: number, random: GameRandom): void {
    const collected = TOTAL_DOTS - remainingDots;
    if (this.spawnedCount >= FRUIT_SPAWN_DOTS.length
      || collected < FRUIT_SPAWN_DOTS[this.spawnedCount]) return;
    this.spawnedCount++;
    // The original display interval varies between nine and ten seconds.
    this.framesRemaining = 540 + random.nextInt(61);
  }

  tick(): void {
    if (this.framesRemaining > 0) this.framesRemaining--;
  }

  collectAt(x: number, y: number): number {
    if (!this.visible || Math.abs(x - FRUIT_POSITION.x) > TILE_SIZE / 2
      || Math.abs(y - FRUIT_POSITION.y) > TILE_SIZE / 2) return 0;
    this.framesRemaining = 0;
    return this.points;
  }

  hide(): void { this.framesRemaining = 0; }
}
