export interface DictEntry {
  /** Display form of the word. */
  w: string;
  /** US phonetic transcription. */
  us?: string;
  /** UK phonetic transcription. */
  uk?: string;
  /** Chinese meanings, one string per sense group. */
  t: string[];
  /** Word-list ids that contain this word. */
  lists: string[];
}

export interface WordListMeta {
  id: string;
  name: string;
  short: string;
  description: string;
  file: string;
  /** Number of unique words in the list. */
  count: number;
  /** Number of raw rows upstream (may include duplicates). */
  rawCount: number;
}

export interface DataMeta {
  version: string;
  generatedAt: string;
  source: {
    repo: string;
    url: string;
    license: string;
    note: string;
  };
  totalRawEntries: number;
  uniqueWords: number;
  lists: WordListMeta[];
}

export interface WordProgress {
  /** 0 = just learned / needs work, 7 = mastered. */
  stage: number;
  /** Local date key (YYYY-MM-DD) of the next review. */
  nextReview: string;
  firstLearned: string;
  lastReview: string | null;
  seen: number;
  correct: number;
  wrong: number;
}

export interface DailyStat {
  newCount: number;
  reviewCount: number;
  correct: number;
  wrong: number;
}

export type StudyOrder = 'sequential' | 'random';

export interface AppSettings {
  activeListId: string;
  dailyGoal: number;
  studyOrder: StudyOrder;
  reminderEnabled: boolean;
  /** Local HH:mm time for the daily reminder. */
  reminderTime: string;
}

export interface AppState {
  version: 1;
  settings: AppSettings;
  /** Keyed by lowercase word. Progress is shared across word lists. */
  progress: Record<string, WordProgress>;
  /** Keyed by local date (YYYY-MM-DD). */
  daily: Record<string, DailyStat>;
  /** Keyed by lowercase word; value is the date it was favorited. */
  favorites: Record<string, string>;
}

export type NewRating = 'know' | 'fuzzy' | 'unknown';
export type ReviewRating = 'remember' | 'fuzzy' | 'forgot';
