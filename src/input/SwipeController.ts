import type { Direction } from '../config/constants';

const MIN_SWIPE_DISTANCE = 18;

/** Sends a direction as soon as a touch crosses the threshold, then allows another turn. */
export function attachSwipe(target: HTMLElement, onDirection: (direction: Direction) => void): () => void {
  let pointerId: number | null = null;
  let anchorX = 0;
  let anchorY = 0;
  let lastDirection: Direction | null = null;

  const move = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    const dx = event.clientX - anchorX;
    const dy = event.clientY - anchorY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < MIN_SWIPE_DISTANCE) return;

    const direction: Direction = Math.abs(dx) >= Math.abs(dy)
      ? dx > 0 ? 'right' : 'left'
      : dy > 0 ? 'down' : 'up';
    if (direction !== lastDirection) onDirection(direction);
    lastDirection = direction;
    anchorX = event.clientX;
    anchorY = event.clientY;
  };

  const down = (event: PointerEvent) => {
    if (pointerId !== null || !event.isPrimary
      || (event.pointerType !== 'touch' && event.pointerType !== 'pen')) return;
    pointerId = event.pointerId;
    anchorX = event.clientX;
    anchorY = event.clientY;
    lastDirection = null;
    target.setPointerCapture?.(event.pointerId);
  };

  const clear = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    lastDirection = null;
    if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId);
  };

  const up = (event: PointerEvent) => {
    move(event); // Quick flicks may reach the threshold only on release.
    clear(event);
  };

  target.addEventListener('pointerdown', down);
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', clear);
  return () => {
    target.removeEventListener('pointerdown', down);
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', up);
    target.removeEventListener('pointercancel', clear);
  };
}
