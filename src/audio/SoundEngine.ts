import type { SoundCue } from '../engine/SoundCue';

// Small synthesized cues keep the game self-contained and avoid shipping arcade samples.
export class SoundEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled: boolean;
  private dotHigh = false;
  private quietDotsUntil = 0;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) this.ensureContext();
    if (this.context && this.master) {
      this.master.gain.setValueAtTime(enabled ? 0.18 : 0, this.context.currentTime);
    }
  }

  play(cue: SoundCue): void {
    if (!this.enabled) return;
    const context = this.ensureContext();
    if (!context) return;
    const now = context.currentTime + 0.005;
    if (cue === 'dot') {
      if (now < this.quietDotsUntil) return;
      this.dotHigh = !this.dotHigh;
      const pitch = this.dotHigh ? 1.18 : 1;
      this.tone(now, 0.07, 310 * pitch, 180 * pitch, 0.22);
      return;
    }

    this.quietDotsUntil = now + (cue === 'death' ? 0.9 : cue === 'levelClear' ? 0.65 : 0.15);
    switch (cue) {
      case 'start':
        [523, 659, 784, 1047].forEach((hz, i) =>
          this.tone(now + i * 0.105, 0.13, hz, hz * 0.98, 0.25));
        break;
      case 'power':
        this.tone(now, 0.23, 460, 150, 0.28, 'sawtooth');
        this.tone(now + 0.06, 0.21, 300, 100, 0.16);
        break;
      case 'ghost':
        this.tone(now, 0.22, 240, 1050, 0.24);
        this.tone(now + 0.08, 0.15, 530, 1320, 0.13, 'triangle');
        break;
      case 'fruit':
        [659, 880, 1320].forEach((hz, i) =>
          this.tone(now + i * 0.075, 0.12, hz, hz * 1.04, 0.22, 'triangle'));
        break;
      case 'death':
        this.tone(now, 0.36, 620, 240, 0.3, 'sawtooth');
        this.tone(now + 0.32, 0.46, 300, 70, 0.26, 'sawtooth');
        break;
      case 'levelClear':
        [523, 659, 784, 1047, 1319].forEach((hz, i) =>
          this.tone(now + i * 0.105, i === 4 ? 0.27 : 0.13, hz, hz, 0.24));
        break;
      case 'extraLife':
        [880, 1175, 1568, 1175].forEach((hz, i) =>
          this.tone(now + i * 0.09, 0.12, hz, hz, 0.21, 'triangle'));
        break;
    }
  }

  private ensureContext(): AudioContext | null {
    if (!this.context) {
      if (typeof window === 'undefined' || !window.AudioContext) return null;
      try {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.enabled ? 0.18 : 0;
        this.master.connect(this.context.destination);
      } catch {
        this.context = null;
        this.master = null;
        return null;
      }
    }
    if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    return this.context;
  }

  private tone(
    start: number, duration: number, fromHz: number, toHz: number,
    volume: number, type: OscillatorType = 'square',
  ): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(fromHz, start);
    if (fromHz !== toHz) oscillator.frequency.exponentialRampToValueAtTime(toHz, start + duration);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(volume, start + Math.min(0.008, duration / 4));
    envelope.gain.setValueAtTime(volume, start + duration * 0.65);
    envelope.gain.linearRampToValueAtTime(0, start + duration);
    oscillator.connect(envelope).connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.005);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
  }
}
