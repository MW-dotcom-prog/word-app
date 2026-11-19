import type { AppState, DailyStat, StudyOrder, WordProgress } from '../types';
import { isValidDateKey } from './date';
import { MAX_STAGE } from './srs';

export const STORAGE_KEY = 'shici-state-v1';
export const DEFAULT_DAILY_GOAL = 20;
export const DAILY_GOAL_OPTIONS = [5, 10, 15, 20, 30, 50] as const;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createDefaultState(): AppState {
  return {
    version: 1,
    settings: {
      activeListId: 'gaokao',
      dailyGoal: DEFAULT_DAILY_GOAL,
      studyOrder: 'sequential',
      reminderEnabled: false,
      reminderTime: '20:00',
    },
    progress: {},
    daily: {},
    favorites: {},
  };
}

function getStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonNegativeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

function parseProgress(value: unknown): WordProgress | null {
  if (!isRecord(value)) return null;
  const { stage, nextReview, firstLearned, lastReview, seen, correct, wrong } = value;
  // Older saves/cloud payloads predate correctStreak; treat the missing field as 0.
  const correctStreak = isNonNegativeNumber(value.correctStreak) ? value.correctStreak : 0;
  if (
    typeof stage !== 'number' ||
    !Number.isInteger(stage) ||
    stage < 0 ||
    stage > MAX_STAGE ||
    typeof nextReview !== 'string' ||
    !isValidDateKey(nextReview) ||
    typeof firstLearned !== 'string' ||
    !isValidDateKey(firstLearned) ||
    !(lastReview === null || (typeof lastReview === 'string' && isValidDateKey(lastReview))) ||
    !isNonNegativeNumber(seen) ||
    !isNonNegativeNumber(correct) ||
    !isNonNegativeNumber(wrong)
  ) {
    return null;
  }
  return {
    stage,
    nextReview,
    firstLearned,
    lastReview,
    seen,
    correct,
    wrong,
    correctStreak,
  };
}

function parseDaily(value: unknown): DailyStat | null {
  if (!isRecord(value)) return null;
  const { newCount, reviewCount, correct, wrong } = value;
  if (
    !isNonNegativeNumber(newCount) ||
    !isNonNegativeNumber(reviewCount) ||
    !isNonNegativeNumber(correct) ||
    !isNonNegativeNumber(wrong)
  ) {
    return null;
  }
  return { newCount, reviewCount, correct, wrong };
}

export const LOCAL_UPDATED_KEY = 'shici-local-updated-at';

/**
 * Validate and normalize an AppState-shaped value (local storage or a cloud
 * JSON payload). Returns null when the shape/version is incompatible.
 */
export function normalizeState(value: unknown): AppState | null {
  if (!isRecord(value) || value.version !== 1) return null;
  const fallback = createDefaultState();
  const settings = isRecord(value.settings) ? value.settings : {};
  const activeListId =
    typeof settings.activeListId === 'string' && settings.activeListId
      ? settings.activeListId
      : fallback.settings.activeListId;
  const dailyGoal =
    typeof settings.dailyGoal === 'number' && Number.isFinite(settings.dailyGoal)
      ? Math.min(200, Math.max(1, Math.round(settings.dailyGoal)))
      : fallback.settings.dailyGoal;
  const studyOrder: StudyOrder =
    settings.studyOrder === 'random' ? 'random' : 'sequential';
  const reminderEnabled = settings.reminderEnabled === true;
  const reminderTime =
    typeof settings.reminderTime === 'string' &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(settings.reminderTime)
      ? settings.reminderTime
      : fallback.settings.reminderTime;

  const progress: Record<string, WordProgress> = {};
  if (isRecord(value.progress)) {
    for (const [word, entryValue] of Object.entries(value.progress)) {
      const entry = parseProgress(entryValue);
      if (entry) progress[word.toLowerCase()] = entry;
    }
  }

  const daily: Record<string, DailyStat> = {};
  if (isRecord(value.daily)) {
    for (const [date, statValue] of Object.entries(value.daily)) {
      if (!isValidDateKey(date)) continue;
      const stat = parseDaily(statValue);
      if (stat) daily[date] = stat;
    }
  }

  const favorites: Record<string, string> = {};
  if (isRecord(value.favorites)) {
    for (const [word, date] of Object.entries(value.favorites)) {
      if (typeof date === 'string' && isValidDateKey(date) && word) {
        favorites[word.toLowerCase()] = date;
      }
    }
  }

  return {
    version: 1,
    settings: {
      activeListId,
      dailyGoal,
      studyOrder,
      reminderEnabled,
      reminderTime,
    },
    progress,
    daily,
    favorites,
  };
}

/**
 * Read persisted state. Corrupt or incompatible data falls back to a clean
 * state instead of crashing the app.
 */
export function loadState(storage: StorageLike | null = getStorage()): AppState {
  const fallback = createDefaultState();
  if (!storage) return fallback;

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return fallback;
  }
  if (!raw) return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }
  return normalizeState(parsed) ?? fallback;
}

export function saveState(
  state: AppState,
  storage: StorageLike | null = getStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    storage.setItem(LOCAL_UPDATED_KEY, new Date().toISOString());
  } catch {
    // Quota errors or private-mode restrictions: keep the app usable in memory.
  }
}
