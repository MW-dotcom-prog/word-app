import { describe, expect, it } from 'vitest';
import type { AppState, WordProgress } from '../src/types';
import { createDefaultState } from '../src/lib/storage';
import {
  computeStreak,
  getDaily,
  getDueCount,
  getDueWords,
  getFavoriteKeys,
  getLearnedCount,
  getNewKeys,
  getNextNewKeys,
  getTodayNewRemaining,
  getTotals,
  shuffle,
} from '../src/lib/selectors';

function progress(overrides: Partial<WordProgress> = {}): WordProgress {
  return {
    stage: 1,
    nextReview: '2026-10-18',
    firstLearned: '2026-10-17',
    lastReview: null,
    seen: 1,
    correct: 0,
    wrong: 0,
    correctStreak: 0,
    ...overrides,
  };
}

function stateWith(progressMap: Record<string, WordProgress>): AppState {
  const state = createDefaultState();
  return { ...state, progress: progressMap };
}

describe('daily goal helpers', () => {
  it('returns zero when there is no activity', () => {
    const state = createDefaultState();
    expect(getDaily(state, '2026-10-18').newCount).toBe(0);
    expect(getTodayNewRemaining(state, '2026-10-18')).toBe(20);
  });

  it('subtracts words learned today from the goal', () => {
    const state = createDefaultState();
    state.daily['2026-10-18'] = { newCount: 7, reviewCount: 2, correct: 5, wrong: 1 };
    expect(getTodayNewRemaining(state, '2026-10-18')).toBe(13);
    expect(getTodayNewRemaining(state, '2026-10-19')).toBe(20);
  });

  it('never returns a negative remaining count', () => {
    const state = createDefaultState();
    state.daily['2026-10-18'] = { newCount: 25, reviewCount: 0, correct: 0, wrong: 0 };
    expect(getTodayNewRemaining(state, '2026-10-18')).toBe(0);
  });
});

describe('new word selection', () => {
  it('returns unstudied words in list order up to the limit', () => {
    const state = stateWith({ ability: progress() });
    const keys = ['abandon', 'ability', 'able', 'abnormal', 'aboard'];
    expect(getNextNewKeys(keys, state, 2)).toEqual(['abandon', 'able']);
    expect(getNextNewKeys(keys, state, 0)).toEqual([]);
  });

  it('returns fewer words when the list is exhausted', () => {
    const state = stateWith({
      abandon: progress(),
      ability: progress(),
    });
    expect(getNextNewKeys(['abandon', 'ability'], state, 5)).toEqual([]);
  });

  it('counts learned words in a list', () => {
    const state = stateWith({ abandon: progress(), ability: progress() });
    expect(getLearnedCount(['abandon', 'ability', 'able'], state.progress)).toBe(2);
  });

  it('supports a random order without repeating studied words', () => {
    const state = stateWith({ b: progress() });
    const keys = ['a', 'b', 'c', 'd', 'e'];
    const random = getNewKeys(keys, state, 3, 'random');
    expect(random).toHaveLength(3);
    expect(random).not.toContain('b');
    expect(new Set(random).size).toBe(3);
    expect(getNewKeys(keys, state, 2, 'sequential')).toEqual(['a', 'c']);
  });

  it('shuffles a copy deterministically with a supplied RNG', () => {
    const input = [1, 2, 3, 4];
    expect(shuffle(input, () => 0)).toEqual([2, 3, 4, 1]);
    expect(input).toEqual([1, 2, 3, 4]);
  });
});

describe('review queue', () => {
  it('includes due and overdue words, sorted by date then stage', () => {
    const state = stateWith({
      overdue: progress({ nextReview: '2026-10-16', stage: 2 }),
      today: progress({ nextReview: '2026-10-18', stage: 0 }),
      future: progress({ nextReview: '2026-10-19', stage: 0 }),
      older: progress({ nextReview: '2026-10-16', stage: 0 }),
    });
    const due = getDueWords(state, '2026-10-18').map(([word]) => word);
    expect(due).toEqual(['older', 'overdue', 'today']);
    expect(getDueCount(state, '2026-10-18')).toBe(3);
  });

  it('handles an empty progress map', () => {
    expect(getDueWords(createDefaultState(), '2026-10-18')).toEqual([]);
    expect(getDueCount(createDefaultState(), '2026-10-18')).toBe(0);
  });
});

describe('streak', () => {
  const active = { newCount: 1, reviewCount: 0, correct: 1, wrong: 0 };

  it('counts consecutive active days ending today', () => {
    const daily = {
      '2026-10-18': active,
      '2026-10-17': active,
      '2026-10-16': active,
    };
    expect(computeStreak(daily, '2026-10-18')).toBe(3);
  });

  it('keeps yesterday\'s streak before studying today', () => {
    const daily = {
      '2026-10-17': active,
      '2026-10-16': active,
    };
    expect(computeStreak(daily, '2026-10-18')).toBe(2);
  });

  it('breaks on a missed day', () => {
    const daily = {
      '2026-10-18': active,
      '2026-10-16': active,
    };
    expect(computeStreak(daily, '2026-10-18')).toBe(1);
  });

  it('is zero without activity', () => {
    expect(computeStreak({}, '2026-10-18')).toBe(0);
  });
});

describe('totals', () => {
  it('counts learned, mastered and due words', () => {
    const state = stateWith({
      a: progress({ stage: 7, nextReview: '2026-10-17' }),
      b: progress({ stage: 3, nextReview: '2026-10-18' }),
      c: progress({ stage: 1, nextReview: '2026-10-25' }),
    });
    expect(getTotals(state, '2026-10-18')).toEqual({
      learned: 3,
      mastered: 1,
      due: 2,
    });
  });
});

describe('favorites ordering', () => {
  it('sorts by date descending, then alphabetically', () => {
    expect(
      getFavoriteKeys({
        alpha: '2026-10-18',
        beta: '2026-10-19',
        gamma: '2026-10-19',
      }),
    ).toEqual(['beta', 'gamma', 'alpha']);
  });
});
