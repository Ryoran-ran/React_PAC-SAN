/** Seeded gameplay RNG. The arcade ROM's address-based generator is a Phase 4 task. */
export class GameRandom {
  private value = 0x5a17c3e1;

  get state(): number { return this.value; }

  reset(): void { this.value = 0x5a17c3e1; }

  nextInt(limit: number): number {
    this.value ^= this.value << 13;
    this.value ^= this.value >>> 17;
    this.value ^= this.value << 5;
    this.value >>>= 0;
    return this.value % limit;
  }
}
