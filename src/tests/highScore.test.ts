import { afterEach, describe, expect, it, vi } from 'vitest';
import { HIGH_SCORE_KEY } from '../config/constants';
import { loadHighScore, saveHighScore } from '../storage/highScore';

afterEach(() => vi.unstubAllGlobals());

describe('optional local high score persistence', () => {
  it.each(['-10', 'Infinity', 'bad data', '1.5', '9007199254740992'])(
    'ignores invalid stored value %s', stored => {
      vi.stubGlobal('localStorage', { getItem: () => stored });
      expect(loadHighScore()).toBe(0);
    },
  );
  it('loads a valid high score and saves under the versioned key', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: () => '2600', setItem });
    expect(loadHighScore()).toBe(2600);
    saveHighScore(3000);
    expect(setItem).toHaveBeenCalledWith(HIGH_SCORE_KEY, '3000');
  });
  it('keeps playing when browser storage is denied or full', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('quota'); },
    });
    expect(loadHighScore()).toBe(0);
    expect(() => saveHighScore(10)).not.toThrow();
  });
});
