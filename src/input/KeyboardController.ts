import type { Direction } from '../config/constants';
import type { GameEngine } from '../engine/GameEngine';
import type { GameMode } from '../engine/GameModes';

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
};

export function attachKeyboard(engine: GameEngine, target: Window, actions: {
  onStart?: () => void;
  onMenuModeChange?: (mode: GameMode) => void;
} = {}): () => void {
  const keydown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const element = event.target as HTMLElement | null;
    if (element?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element?.tagName ?? '')) return;
    if (engine.state === 'TITLE' || engine.state === 'GAME_OVER') {
      const menuMode = /^(ArrowUp|KeyW)$/.test(event.code)
        ? engine.selectedMode === 'nightmare' ? 'freeplay' : 'arcade'
        : /^(ArrowDown|KeyS)$/.test(event.code)
          ? engine.selectedMode === 'arcade' ? 'freeplay' : 'nightmare'
          : event.code === 'Digit1' ? 'arcade'
            : event.code === 'Digit2' ? 'freeplay'
              : /^(Digit3|KeyN)$/.test(event.code) ? 'nightmare' : null;
      if (menuMode) {
        event.preventDefault();
        if (!event.repeat) {
          if (actions.onMenuModeChange) actions.onMenuModeChange(menuMode);
          else engine.configureStart(menuMode);
          if (element?.tagName === 'BUTTON' || element?.tagName === 'A') element.blur();
        }
        return;
      }
    }
    const direction = KEY_DIRECTIONS[event.code];
    if (direction) {
      event.preventDefault();
      engine.requestDirection(direction);
    } else if (event.code === 'Enter') {
      // Let native focused buttons handle Enter; avoid firing two actions.
      if (element?.tagName === 'BUTTON') return;
      event.preventDefault();
      if (!event.repeat) {
        if ((engine.state === 'TITLE' || engine.state === 'GAME_OVER') && actions.onStart) {
          actions.onStart();
        } else engine.start();
      }
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
