import { HIGH_SCORE_KEY } from '../config/constants';

export function loadHighScore(): number {
  try {
    const value = Number(localStorage.getItem(HIGH_SCORE_KEY));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch { return 0; }
}

export function saveHighScore(score: number): void {
  try { localStorage.setItem(HIGH_SCORE_KEY, String(score)); }
  catch { /* Private browsing or storage full: the current run stays playable. */ }
}
