import type { NewRating, ReviewRating, WordProgress } from '../types';
import { addDays } from './date';

/**
 * Ebbinghaus review intervals (days): next day, then 2, 4, 7, 15, 30, 60.
 * Stage 1 is the first review (tomorrow); stage 7 is mastered but still
 * returns after 60 days.
 */
export const INTERVALS = [1, 1, 2, 4, 7, 15, 30, 60] as const;
export const MAX_STAGE = INTERVALS.length - 1;

/** Favorited words are removed once they are rated known this many times in a row. */
export const AUTO_UNFAVORITE_STREAK = 5;

/**
 * First exposure to a word. Every new word is scheduled for tomorrow so that
 * the "next-day review" requirement is always satisfied.
 */
export function initialProgress(rating: NewRating, today: string): WordProgress {
  return {
    stage: rating === 'know' ? 1 : 0,
    nextReview: addDays(today, 1),
    firstLearned: today,
    lastReview: null,
    seen: 1,
    correct: rating === 'know' ? 1 : 0,
    wrong: rating === 'unknown' ? 1 : 0,
    correctStreak: rating === 'know' ? 1 : 0,
  };
}

/**
 * A review answered today.
 * - remember: promote one stage, schedule by the interval table
 * - fuzzy:    demote one stage (minimum 0), review again tomorrow
 * - forgot:   back to stage 0, review again tomorrow
 */
export function applyReview(
  previous: WordProgress,
  rating: ReviewRating,
  today: string,
): WordProgress {
  let stage = previous.stage;
  if (rating === 'remember') {
    stage = Math.min(previous.stage + 1, MAX_STAGE);
  } else if (rating === 'fuzzy') {
    stage = Math.max(previous.stage - 1, 0);
  } else {
    stage = 0;
  }

  const nextReview =
    rating === 'remember' ? addDays(today, INTERVALS[stage]) : addDays(today, 1);

  return {
    ...previous,
    stage,
    nextReview,
    lastReview: today,
    seen: previous.seen + 1,
    correct: previous.correct + (rating === 'remember' ? 1 : 0),
    wrong: previous.wrong + (rating === 'forgot' ? 1 : 0),
    correctStreak: rating === 'remember' ? (previous.correctStreak ?? 0) + 1 : 0,
  };
}

export function isMastered(progress: WordProgress): boolean {
  return progress.stage >= MAX_STAGE;
}

export function accuracyOf(correct: number, wrong: number): number | null {
  const total = correct + wrong;
  return total === 0 ? null : correct / total;
}

/** Two decimals are unnecessary for the UI; return a rounded percentage. */
export function accuracyPercent(correct: number, wrong: number): number | null {
  const value = accuracyOf(correct, wrong);
  return value === null ? null : Math.round(value * 100);
}
