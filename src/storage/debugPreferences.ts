import type { AutoPlayLevel } from '../ai/AutoPlayer';
import { DEFAULT_DEBUG_DISPLAY, type DebugDisplayOptions } from '../engine/DebugDisplay';

export const DEBUG_PREFERENCES_KEY = 'pac-san-debug-preferences-v1';

export interface DebugPreferences {
  debug: boolean;
  debugDisplay: DebugDisplayOptions;
  autoPlayLevel: AutoPlayLevel | null;
  historyRecording: boolean;
}

const displayKeys = Object.keys(DEFAULT_DEBUG_DISPLAY) as (keyof DebugDisplayOptions)[];
const autoPlayLevels: readonly AutoPlayLevel[] = ['beginner', 'standard', 'expert', 'tas'];

function defaults(): DebugPreferences {
  return {
    debug: false,
    debugDisplay: { ...DEFAULT_DEBUG_DISPLAY },
    autoPlayLevel: null,
    historyRecording: false,
  };
}

export function loadDebugPreferences(): DebugPreferences {
  try {
    const stored = localStorage.getItem(DEBUG_PREFERENCES_KEY);
    if (!stored) return defaults();
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults();
    const value = parsed as Record<string, unknown>;
    const preferences = defaults();
    if (typeof value.debug === 'boolean') preferences.debug = value.debug;
    if (typeof value.historyRecording === 'boolean') preferences.historyRecording = value.historyRecording;
    if (value.autoPlayLevel === null || autoPlayLevels.includes(value.autoPlayLevel as AutoPlayLevel)) {
      preferences.autoPlayLevel = value.autoPlayLevel as AutoPlayLevel | null;
    }
    if (value.debugDisplay && typeof value.debugDisplay === 'object' && !Array.isArray(value.debugDisplay)) {
      const display = value.debugDisplay as Record<string, unknown>;
      for (const key of displayKeys) {
        if (typeof display[key] === 'boolean') preferences.debugDisplay[key] = display[key];
      }
    }
    return preferences;
  } catch { return defaults(); }
}

export function saveDebugPreferences(preferences: DebugPreferences): void {
  try { localStorage.setItem(DEBUG_PREFERENCES_KEY, JSON.stringify(preferences)); }
  catch { /* Settings remain usable for the current session. */ }
}
