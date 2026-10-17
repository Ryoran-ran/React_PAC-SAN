import type { Direction } from '../config/constants';
import type { GameEngine } from '../engine/GameEngine';

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
};

export function attachKeyboard(engine: GameEngine, target: Window): () => void {
  const keydown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const element = event.target as HTMLElement | null;
    if (element?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element?.tagName ?? '')) return;
    const direction = KEY_DIRECTIONS[event.code];
    if (direction) {
      event.preventDefault();
      engine.requestDirection(direction);
    } else if (event.code === 'Enter') {
      // Let native focused buttons handle Enter; avoid firing two actions.
      if (element?.tagName === 'BUTTON') return;
      event.preventDefault();
      if (!event.repeat) engine.start();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      event.preventDefault();
      if (!event.repeat) engine.togglePause();
    } else if (event.code === 'F3') {
      event.preventDefault();
      if (!event.repeat) engine.toggleDebug();
    }
  };
  const blur = () => engine.pause();
  target.addEventListener('keydown', keydown);
  target.addEventListener('blur', blur);
  return () => {
    target.removeEventListener('keydown', keydown);
    target.removeEventListener('blur', blur);
  };
}
