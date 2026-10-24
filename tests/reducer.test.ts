import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../src/lib/storage';
import { reducer } from '../src/state/reducer';

const TODAY = '2026-10-18';
const TOMORROW = '2026-10-19';

describe('learning action', () => {
  it('creates progress and updates the daily counter', () => {
    const state = createDefaultState();
    const next = reducer(state, { type: 'learn', word: 'Abandon', rating: 'know', today: TODAY });

    expect(next.progress.abandon.stage).toBe(1);
    expect(next.progress.abandon.nextReview).toBe(TOMORROW);
    expect(next.daily[TODAY]).toEqual({
      newCount: 1,
      reviewCount: 0,
      correct: 1,
      wrong: 0,
    });
  });

  it('does not learn the same word twice', () => {
    const state = createDefaultState();
    const once = reducer(state, { type: 'learn', word: 'abandon', rating: 'fuzzy', today: TODAY });
    const twice = reducer(once, { type: 'learn', word: 'ABANDON', rating: 'know', today: TODAY });
    expect(twice).toBe(once);
    expect(twice.daily[TODAY].newCount).toBe(1);
  });

  it('counts unknown answers as wrong and fuzzy answers as neutral', () => {
    const state = createDefaultState();
    const fuzzy = reducer(state, { type: 'learn', word: 'a', rating: 'fuzzy', today: TODAY });
    expect(fuzzy.daily[TODAY]).toMatchObject({ correct: 0, wrong: 0 });

    const unknown = reducer(fuzzy, { type: 'learn', word: 'b', rating: 'unknown', today: TODAY });
    expect(unknown.daily[TODAY]).toMatchObject({ newCount: 2, correct: 0, wrong: 1 });
  });
});

describe('review action', () => {
  it('updates progress and the daily review counter', () => {
    const learned = reducer(createDefaultState(), {
      type: 'learn',
      word: 'abandon',
      rating: 'know',
      today: TODAY,
    });
    const reviewed = reducer(learned, {
      type: 'review',
      word: 'abandon',
      rating: 'remember',
      today: TOMORROW,
    });

    expect(reviewed.progress.abandon.stage).toBe(2);
    expect(reviewed.progress.abandon.nextReview).toBe('2026-10-21');
    expect(reviewed.daily[TOMORROW]).toEqual({
      newCount: 0,
      reviewCount: 1,
      correct: 1,
      wrong: 0,
    });
  });

  it('ignores reviews for unknown words', () => {
    const state = createDefaultState();
    expect(
      reducer(state, { type: 'review', word: 'missing', rating: 'remember', today: TODAY }),
    ).toBe(state);
  });
});

describe('settings actions', () => {
  it('changes the active list', () => {
    const state = createDefaultState();
    const next = reducer(state, { type: 'setActiveList', listId: 'ielts' });
    expect(next.settings.activeListId).toBe('ielts');
    expect(reducer(next, { type: 'setActiveList', listId: 'ielts' })).toBe(next);
  });

  it('clamps the daily goal', () => {
    const state = createDefaultState();
    expect(reducer(state, { type: 'setDailyGoal', goal: 0 }).settings.dailyGoal).toBe(1);
    expect(reducer(state, { type: 'setDailyGoal', goal: 500 }).settings.dailyGoal).toBe(200);
    expect(reducer(state, { type: 'setDailyGoal', goal: 30 }).settings.dailyGoal).toBe(30);
  });

  it('changes the study order', () => {
    const state = createDefaultState();
    const random = reducer(state, { type: 'setStudyOrder', order: 'random' });
    expect(random.settings.studyOrder).toBe('random');
    expect(reducer(random, { type: 'setStudyOrder', order: 'random' })).toBe(random);
    expect(reducer(random, { type: 'setStudyOrder', order: 'sequential' }).settings.studyOrder).toBe(
      'sequential',
    );
  });
});

describe('daily reminder', () => {
  it('sets a valid reminder time and enabled flag', () => {
    const state = createDefaultState();
    const enabled = reducer(state, { type: 'setReminder', enabled: true });
    expect(enabled.settings.reminderEnabled).toBe(true);
    expect(enabled.settings.reminderTime).toBe('20:00');

    const timed = reducer(enabled, { type: 'setReminder', time: '07:45' });
    expect(timed.settings.reminderEnabled).toBe(true);
    expect(timed.settings.reminderTime).toBe('07:45');

    const invalid = reducer(timed, { type: 'setReminder', time: '25:99' });
    expect(invalid.settings.reminderTime).toBe('07:45');
  });
});

describe('favorites', () => {
  it('toggles a favorite without touching progress', () => {
    const state = createDefaultState();
    const added = reducer(state, {
      type: 'toggleFavorite',
      word: 'Abandon',
      today: TODAY,
    });
    expect(added.favorites).toEqual({ abandon: TODAY });
    expect(added.progress).toEqual({});

    const removed = reducer(added, {
      type: 'toggleFavorite',
      word: 'ABANDON',
      today: TOMORROW,
    });
    expect(removed.favorites).toEqual({});
  });
});

describe('replaceState action', () => {
  it('replaces the entire state (used by cloud sync)', () => {
    const replacement = createDefaultState();
    replacement.settings.dailyGoal = 42;
    const next = reducer(createDefaultState(), {
      type: 'replaceState',
      state: replacement,
    });
    expect(next).toBe(replacement);
    expect(next.settings.dailyGoal).toBe(42);
  });
});

describe('reset action', () => {
  it('clears progress and daily stats but keeps settings', () => {
    let state = createDefaultState();
    state = reducer(state, { type: 'setActiveList', listId: 'toefl' });
    state = reducer(state, { type: 'setDailyGoal', goal: 30 });
    state = reducer(state, { type: 'setStudyOrder', order: 'random' });
    state = reducer(state, {
      type: 'toggleFavorite',
      word: 'abandon',
      today: TODAY,
    });
    state = reducer(state, { type: 'learn', word: 'abandon', rating: 'know', today: TODAY });

    const reset = reducer(state, { type: 'resetProgress' });
    expect(reset.progress).toEqual({});
    expect(reset.daily).toEqual({});
    expect(reset.favorites).toEqual({ abandon: TODAY });
    expect(reset.settings).toEqual({
      activeListId: 'toefl',
      dailyGoal: 30,
      studyOrder: 'random',
      reminderEnabled: false,
      reminderTime: '20:00',
    });
  });
});
