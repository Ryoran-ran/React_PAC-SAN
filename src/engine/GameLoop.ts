import { FRAME_DURATION_MS, MAX_UPDATES_PER_RENDER } from '../config/constants';

/** Retains unprocessed time if the catch-up budget is exceeded. */
export class FixedStepClock {
  private previous: number | null = null;
  private accumulator = 0;

  advance(timestamp: number, update: () => void): number {
    if (this.previous === null) { this.previous = timestamp; return 0; }
    this.accumulator += Math.max(0, timestamp - this.previous);
    this.previous = timestamp;
    let count = 0;
    while (this.accumulator + 1e-8 >= FRAME_DURATION_MS && count < MAX_UPDATES_PER_RENDER) {
      update();
      this.accumulator -= FRAME_DURATION_MS;
      count++;
    }
    return count;
  }

  reset(): void { this.previous = null; this.accumulator = 0; }
}

export class GameLoop {
  readonly clock = new FixedStepClock();
  private animationId: number | null = null;

  constructor(private update: () => void, private render: () => void) {}

  start(): void {
    if (this.animationId !== null) return;
    this.clock.reset();
    this.animationId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (this.animationId !== null) cancelAnimationFrame(this.animationId);
    this.animationId = null;
    this.clock.reset();
  }

  private tick = (timestamp: number): void => {
    this.clock.advance(timestamp, this.update);
    this.render();
    this.animationId = requestAnimationFrame(this.tick);
  };
}
