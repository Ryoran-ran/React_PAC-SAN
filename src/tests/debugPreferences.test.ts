import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DEBUG_DISPLAY } from '../engine/DebugDisplay';
import {
  DEBUG_PREFERENCES_KEY, loadDebugPreferences, saveDebugPreferences,
} from '../storage/debugPreferences';

afterEach(() => vi.unstubAllGlobals());

describe('debug preference persistence', () => {
  it('saves and restores debug, display, autoplay, and recording choices', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    const preferences = {
      debug: true,
      debugDisplay: { ...DEFAULT_DEBUG_DISPLAY, mazeGrid: false, ghostTargets: false },
      autoPlayLevel: 'tas' as const,
      historyRecording: true,
    };

    saveDebugPreferences(preferences);

    expect(values.has(DEBUG_PREFERENCES_KEY)).toBe(true);
    expect(loadDebugPreferences()).toEqual(preferences);
  });

  it('uses safe defaults for missing, malformed, or unknown options', () => {
    const getItem = vi.fn(() => JSON.stringify({
      debug: true,
      autoPlayLevel: 'unknown',
      historyRecording: 'yes',
      debugDisplay: { mazeGrid: false, ghostTargets: 'off', extra: false },
    }));
    vi.stubGlobal('localStorage', { getItem });
    expect(loadDebugPreferences()).toEqual({
      debug: true,
      autoPlayLevel: null,
      historyRecording: false,
      debugDisplay: { ...DEFAULT_DEBUG_DISPLAY, mazeGrid: false },
    });
    getItem.mockReturnValue('not JSON');
    expect(loadDebugPreferences()).toEqual({
      debug: false,
      autoPlayLevel: null,
      historyRecording: false,
      debugDisplay: DEFAULT_DEBUG_DISPLAY,
    });
  });

  it('keeps the game usable when browser storage is denied', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('quota'); },
    });
    const preferences = loadDebugPreferences();
    expect(preferences.debug).toBe(false);
    expect(() => saveDebugPreferences(preferences)).not.toThrow();
  });
});
