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
  it('selects a start mode with arrows, WASD or number keys, then starts with Enter', () => {
    const engine = new GameEngine();
    const target = new EventTarget();
    const detach = attachKeyboard(engine, target as unknown as Window);

    expect(press(target, 'ArrowDown').defaultPrevented).toBe(true);
    expect(engine.selectedMode).toBe('freeplay');
    press(target, 'Digit1');
    expect(engine.selectedMode).toBe('arcade');
    press(target, 'KeyS');
    expect(engine.selectedMode).toBe('freeplay');
    press(target, 'ArrowUp');
    expect(engine.selectedMode).toBe('arcade');
    press(target, 'Digit2');
    press(target, 'ArrowDown');
    expect(engine.selectedMode).toBe('nightmare');
    press(target, 'ArrowUp');
    expect(engine.selectedMode).toBe('freeplay');
    expect(press(target, 'Enter').defaultPrevented).toBe(true);
    expect(engine.state).toBe('READY');
    expect(engine.gameMode).toBe('freeplay');

    detach();
  });

  it('leaves number and select inputs to their native keyboard controls', () => {
    const engine = new GameEngine();
    const input = new EventTarget();
    Object.defineProperty(input, 'tagName', { value: 'INPUT' });
    const detach = attachKeyboard(engine, input as unknown as Window);
    expect(press(input, 'ArrowDown').defaultPrevented).toBe(false);
    expect(press(input, 'Enter').defaultPrevented).toBe(false);
    expect(engine.selectedMode).toBe('arcade');
    expect(engine.state).toBe('TITLE');
    detach();
  });

  it('delegates menu keys so Free Play can open settings before Enter starts the game', () => {
    const engine = new GameEngine();
    const target = new EventTarget();
    const menuChanges: string[] = [];
    let startRequests = 0;
    const detach = attachKeyboard(engine, target as unknown as Window, {
      onMenuModeChange: (mode) => {
        engine.configureStart(mode);
        menuChanges.push(mode);
      },
      onStart: () => { startRequests++; },
    });

    press(target, 'ArrowDown');
    press(target, 'Enter');
    expect(menuChanges).toEqual(['freeplay']);
    expect(startRequests).toBe(1);
    expect(engine.state).toBe('TITLE');
    detach();
  });

  it('selects Nightmare with 3 without starting before Enter', () => {
    const engine = new GameEngine();
    const target = new EventTarget();
    let startRequests = 0;
    const detach = attachKeyboard(engine, target as unknown as Window, {
      onMenuModeChange: (mode) => engine.configureStart(mode),
      onStart: () => { startRequests++; },
    });

    press(target, 'Digit3');
    expect(engine.selectedMode).toBe('nightmare');
    expect(engine.state).toBe('TITLE');
    expect(startRequests).toBe(0);
    press(target, 'Enter');
    expect(startRequests).toBe(1);
    detach();
  });

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
