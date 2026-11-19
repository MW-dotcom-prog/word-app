import { describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  createDefaultState,
  loadState,
  normalizeState,
  saveState,
} from '../src/lib/storage';
import type { StorageLike } from '../src/lib/storage';

class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe('state persistence', () => {
  it('returns defaults for empty storage', () => {
    expect(loadState(new MemoryStorage())).toEqual(createDefaultState());
  });

  it('round-trips a saved state', () => {
    const storage = new MemoryStorage();
    const state = createDefaultState();
    state.settings = {
      activeListId: 'ielts',
      dailyGoal: 30,
      studyOrder: 'random',
      reminderEnabled: true,
      reminderTime: '08:30',
    };
    state.favorites.abandon = '2026-10-18';
    state.progress.abandon = {
      stage: 2,
      nextReview: '2026-10-21',
      firstLearned: '2026-10-17',
      lastReview: '2026-10-18',
      seen: 2,
      correct: 1,
      wrong: 0,
      correctStreak: 1,
    };
    state.daily['2026-10-18'] = { newCount: 5, reviewCount: 3, correct: 7, wrong: 1 };

    saveState(state, storage);
    expect(loadState(storage)).toEqual(state);
  });

  it('falls back to defaults for corrupt JSON', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{not json');
    expect(loadState(storage)).toEqual(createDefaultState());
  });

  it('falls back for an unknown schema version', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, settings: {} }));
    expect(loadState(storage)).toEqual(createDefaultState());
  });

  it('drops malformed progress entries but keeps valid ones', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        settings: { activeListId: 'toefl', dailyGoal: 15 },
        progress: {
          good: {
            stage: 1,
            nextReview: '2026-10-19',
            firstLearned: '2026-10-18',
            lastReview: null,
            seen: 1,
            correct: 1,
            wrong: 0,
          },
          badStage: {
            stage: 99,
            nextReview: '2026-10-19',
            firstLearned: '2026-10-18',
            lastReview: null,
            seen: 1,
            correct: 0,
            wrong: 0,
          },
          badDate: {
            stage: 1,
            nextReview: 'tomorrow',
            firstLearned: '2026-10-18',
            lastReview: null,
            seen: 1,
            correct: 0,
            wrong: 0,
          },
        },
        daily: {},
      }),
    );

    const state = loadState(storage);
    expect(Object.keys(state.progress)).toEqual(['good']);
    // Old saves have no correctStreak; default it instead of discarding progress.
    expect(state.progress.good.correctStreak).toBe(0);
    expect(state.settings).toEqual({
      activeListId: 'toefl',
      dailyGoal: 15,
      studyOrder: 'sequential',
      reminderEnabled: false,
      reminderTime: '20:00',
    });
  });

  it('parses valid favorites and ignores invalid dates', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        settings: { activeListId: 'gaokao', dailyGoal: 20, studyOrder: 'random' },
        favorites: {
          abandon: '2026-10-18',
          Ability: '2026-10-17',
          broken: 'not-a-date',
        },
      }),
    );

    const state = loadState(storage);
    expect(state.favorites).toEqual({
      abandon: '2026-10-18',
      ability: '2026-10-17',
    });
    expect(state.settings.studyOrder).toBe('random');
  });

  it('accepts the new mastered stage 7', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        settings: { activeListId: 'gaokao', dailyGoal: 20 },
        progress: {
          mastered: {
            stage: 7,
            nextReview: '2026-12-17',
            firstLearned: '2026-01-01',
            lastReview: '2026-10-18',
            seen: 8,
            correct: 7,
            wrong: 0,
          },
        },
        daily: {},
      }),
    );

    expect(loadState(storage).progress.mastered.stage).toBe(7);
  });

  it('clamps an out-of-range daily goal', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, settings: { activeListId: 'gaokao', dailyGoal: 1000 } }),
    );
    expect(loadState(storage).settings.dailyGoal).toBe(200);
  });

  it('does nothing when storage is unavailable', () => {
    const state = createDefaultState();
    expect(() => saveState(state, null)).not.toThrow();
    expect(loadState(null)).toEqual(state);
  });

  it('normalizes a cloud payload and rejects incompatible versions', () => {
    expect(normalizeState({ version: 2 })).toBeNull();
    expect(normalizeState('nope')).toBeNull();

    const normalized = normalizeState({
      version: 1,
      settings: { activeListId: 'ielts', dailyGoal: 25 },
      favorites: { abandon: '2026-10-18' },
    });
    expect(normalized).not.toBeNull();
    expect(normalized?.settings).toMatchObject({
      activeListId: 'ielts',
      dailyGoal: 25,
      studyOrder: 'sequential',
      reminderEnabled: false,
      reminderTime: '20:00',
    });
    expect(normalized?.favorites).toEqual({ abandon: '2026-10-18' });
  });
});
