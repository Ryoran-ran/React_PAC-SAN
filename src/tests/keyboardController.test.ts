import { describe, expect, it } from 'vitest';
import { GameEngine } from '../engine/GameEngine';
import { attachKeyboard } from '../input/KeyboardController';

function press(target: EventTarget, code: string, repeat = false): Event {
  const event = new Event('keydown', { cancelable: true });
  Object.defineProperties(event, {
    code: { value: code },
    repeat: { value: repeat },
  });
  target.dispatchEvent(event);
  return event;
}

describe('keyboard controls', () => {
  it('toggles pause with Escape without repeating while the key is held', () => {
    const engine = new GameEngine();
    const target = new EventTarget();
    engine.start();
    const detach = attachKeyboard(engine, target as unknown as Window);

    const pauseEvent = press(target, 'Escape');
    expect(pauseEvent.defaultPrevented).toBe(true);
    expect(engine.state).toBe('PAUSED');

    press(target, 'Escape', true);
    expect(engine.state).toBe('PAUSED');

    press(target, 'Escape');
    expect(engine.state).toBe('READY');

    detach();
    press(target, 'Escape');
    expect(engine.state).toBe('READY');
  });
});
