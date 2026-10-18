export type GameMode = 'arcade' | 'freeplay';

export interface FreePlaySettings {
  startLevel: number;
  ghostCount: number;
}

export const DEFAULT_FREE_PLAY_SETTINGS: Readonly<FreePlaySettings> = {
  startLevel: 1,
  ghostCount: 4,
};

export function normalizeFreePlaySettings(settings: FreePlaySettings): FreePlaySettings {
  const clampInteger = (value: number, min: number, max: number, fallback: number) =>
    Number.isFinite(value) ? Math.max(min, Math.min(max, Math.trunc(value))) : fallback;
  return {
    // The original 256th-stage overflow is not implemented by this game.
    startLevel: clampInteger(settings.startLevel, 1, 255, 1),
    ghostCount: clampInteger(settings.ghostCount, 0, 4, 4),
  };
}
