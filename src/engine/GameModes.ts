import type { GhostId } from '../entities/Ghost';

export type GameMode = 'arcade' | 'freeplay' | 'nightmare';
export type GhostAI = 'arcade' | 'nightmare';
export type GhostBehavior = 'standard' | 'chase' | 'scatter';
export type GhostTargeting = Readonly<Record<GhostId, GhostId>>;

const GHOST_IDS: readonly GhostId[] = ['blinky', 'pinky', 'inky', 'clyde'];
const isGhostId = (value: unknown): value is GhostId => GHOST_IDS.includes(value as GhostId);

export interface FreePlaySettings {
  startLevel: number;
  ghostCount: number;
  ghostAI: GhostAI;
  ghostBehavior: GhostBehavior;
  ghostTargeting: GhostTargeting;
}

export type FreePlaySettingsInput = Pick<FreePlaySettings, 'startLevel' | 'ghostCount'>
  & Partial<Pick<FreePlaySettings, 'ghostAI' | 'ghostBehavior'>>
  & { ghostTargeting?: Partial<GhostTargeting> };

export const DEFAULT_FREE_PLAY_SETTINGS: Readonly<FreePlaySettings> = {
  startLevel: 1,
  ghostCount: 4,
  ghostAI: 'arcade',
  ghostBehavior: 'standard',
  ghostTargeting: { blinky: 'blinky', pinky: 'pinky', inky: 'inky', clyde: 'clyde' },
};

export function normalizeFreePlaySettings(settings: FreePlaySettingsInput): FreePlaySettings {
  const clampInteger = (value: number, min: number, max: number, fallback: number) =>
    Number.isFinite(value) ? Math.max(min, Math.min(max, Math.trunc(value))) : fallback;
  return {
    // The original 256th-stage overflow is not implemented by this game.
    startLevel: clampInteger(settings.startLevel, 1, 255, 1),
    ghostCount: clampInteger(settings.ghostCount, 0, 4, 4),
    ghostAI: settings.ghostAI === 'nightmare' ? 'nightmare' : 'arcade',
    ghostBehavior: settings.ghostBehavior === 'chase' || settings.ghostBehavior === 'scatter'
      ? settings.ghostBehavior : 'standard',
    ghostTargeting: Object.fromEntries(GHOST_IDS.map((id) => {
      const style = settings.ghostTargeting?.[id];
      return [id, isGhostId(style) ? style : id];
    })) as Record<GhostId, GhostId>,
  };
}
