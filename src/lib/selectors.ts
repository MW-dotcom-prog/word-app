import type { AppState, DailyStat, StudyOrder, WordProgress } from '../types';
import { addDays, todayKey } from './date';
import { isMastered } from './srs';

export const EMPTY_DAILY: DailyStat = {
  newCount: 0,
  reviewCount: 0,
  correct: 0,
  wrong: 0,
};

export function getDaily(state: AppState, date: string = todayKey()): DailyStat {
  return state.daily[date] ?? EMPTY_DAILY;
}

export function getTodayNewRemaining(state: AppState, date: string = todayKey()): number {
  return Math.max(0, state.settings.dailyGoal - getDaily(state, date).newCount);
}

/** Fisher-Yates shuffle; returns a copy and accepts an RNG for tests. */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** All words due today or earlier, oldest first (or shuffled when requested). */
export function getDueWords(
  state: AppState,
  date: string = todayKey(),
  order: StudyOrder = 'sequential',
): Array<[string, WordProgress]> {
  const due = Object.entries(state.progress)
    .filter(([, progress]) => progress.nextReview <= date)
    .sort((a, b) => {
      if (a[1].nextReview !== b[1].nextReview) {
        return a[1].nextReview < b[1].nextReview ? -1 : 1;
      }
      if (a[1].stage !== b[1].stage) return a[1].stage - b[1].stage;
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
    });
  return order === 'random' ? shuffle(due) : due;
}

export function getDueCount(state: AppState, date: string = todayKey()): number {
  return Object.values(state.progress).filter((progress) => progress.nextReview <= date)
    .length;
}

/** First `limit` words in list order that have never been studied. */
export function getNextNewKeys(
  keys: string[],
  state: AppState,
  limit: number,
): string[] {
  const safeLimit = Math.max(0, Math.floor(limit));
  if (safeLimit === 0) return [];
  const result: string[] = [];
  for (const key of keys) {
    if (!state.progress[key]) {
      result.push(key);
      if (result.length >= safeLimit) break;
    }
  }
  return result;
}

/** Unseen words in sequential or random order. */
export function getNewKeys(
  keys: string[],
  state: AppState,
  limit: number,
  order: StudyOrder = 'sequential',
): string[] {
  const safeLimit = Math.max(0, Math.floor(limit));
  if (safeLimit === 0) return [];
  if (order === 'random') {
    return shuffle(keys.filter((key) => !state.progress[key])).slice(0, safeLimit);
  }
  return getNextNewKeys(keys, state, safeLimit);
}

/** Favorite words, most recently added first. */
export function getFavoriteKeys(favorites: Record<string, string>): string[] {
  return Object.entries(favorites)
    .sort((a, b) => {
      if (a[1] !== b[1]) return b[1].localeCompare(a[1]);
      return a[0].localeCompare(b[0]);
    })
    .map(([word]) => word);
}

export function getLearnedCount(
  keys: string[],
  progress: Record<string, WordProgress>,
): number {
  let count = 0;
  for (const key of keys) if (progress[key]) count += 1;
  return count;
}

export function getTotals(state: AppState, date: string = todayKey()) {
  const entries = Object.values(state.progress);
  const learned = entries.length;
  const mastered = entries.filter(isMastered).length;
  const due = entries.filter((progress) => progress.nextReview <= date).length;
  return { learned, mastered, due };
}

/**
 * Consecutive days with any study activity. Today counts if there was activity;
 * otherwise the streak can continue from yesterday (so it doesn't look broken
 * in the morning before the first session).
 */
export function computeStreak(
  daily: Record<string, DailyStat>,
  date: string = todayKey(),
): number {
  const hasActivity = (key: string) => {
    const stat = daily[key];
    return Boolean(stat && (stat.newCount > 0 || stat.reviewCount > 0));
  };

  let cursor = date;
  if (!hasActivity(cursor)) {
    cursor = addDays(cursor, -1);
    if (!hasActivity(cursor)) return 0;
  }

  let streak = 0;
  while (hasActivity(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
