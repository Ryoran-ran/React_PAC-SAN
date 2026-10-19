/** Seeded gameplay RNG. The arcade ROM's address-based generator is a Phase 4 task. */
export class GameRandom {
  private value: number;
  private readonly initialValue: number;

  constructor(seed = 0x5a17c3e1) {
    // Xorshift32 locks at zero, so normalize that one invalid seed.
    this.initialValue = (seed >>> 0) || 0x5a17c3e1;
    this.value = this.initialValue;
  }

  get state(): number { return this.value; }

  reset(): void { this.value = this.initialValue; }

  nextInt(limit: number): number {
    this.value ^= this.value << 13;
    this.value ^= this.value >>> 17;
    this.value ^= this.value << 5;
    this.value >>>= 0;
    return this.value % limit;
  }
}
