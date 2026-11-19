import type {
  AppState,
  DailyStat,
  NewRating,
  ReviewRating,
  StudyOrder,
} from '../types';
import { AUTO_UNFAVORITE_STREAK, applyReview, initialProgress } from '../lib/srs';

export type AppAction =
  | { type: 'learn'; word: string; rating: NewRating; today: string }
  | { type: 'review'; word: string; rating: ReviewRating; today: string }
  | { type: 'toggleFavorite'; word: string; today: string }
  | { type: 'setActiveList'; listId: string }
  | { type: 'setDailyGoal'; goal: number }
  | { type: 'setStudyOrder'; order: StudyOrder }
  | { type: 'setReminder'; enabled?: boolean; time?: string }
  | { type: 'replaceState'; state: AppState }
  | { type: 'resetProgress' };

/**
 * Remove a favorited word once its consecutive-correct streak reaches the
 * threshold. Only the exact crossing triggers this, so manually re-favoriting
 * an already-known word is respected.
 */
function maybeUnfavorite(
  favorites: Record<string, string>,
  word: string,
  correctStreak: number,
): Record<string, string> {
  if (correctStreak !== AUTO_UNFAVORITE_STREAK || !favorites[word]) return favorites;
  const next = { ...favorites };
  delete next[word];
  return next;
}

/**
 * Add a word to favorites when it is marked as unknown/forgotten. An existing
 * favorite is left untouched so its original favorite date is preserved.
 */
function maybeAutoFavorite(
  favorites: Record<string, string>,
  word: string,
  missed: boolean,
  today: string,
): Record<string, string> {
  if (!missed || favorites[word]) return favorites;
  return { ...favorites, [word]: today };
}

function addDaily(
  daily: Record<string, DailyStat>,
  date: string,
  patch: Partial<DailyStat>,
): Record<string, DailyStat> {
  const previous = daily[date] ?? { newCount: 0, reviewCount: 0, correct: 0, wrong: 0 };
  return {
    ...daily,
    [date]: {
      newCount: previous.newCount + (patch.newCount ?? 0),
      reviewCount: previous.reviewCount + (patch.reviewCount ?? 0),
      correct: previous.correct + (patch.correct ?? 0),
      wrong: previous.wrong + (patch.wrong ?? 0),
    },
  };
}

export function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'learn': {
      const key = action.word.trim().toLowerCase();
      if (!key || state.progress[key]) return state;
      const progress = initialProgress(action.rating, action.today);
      const favorites = maybeAutoFavorite(
        maybeUnfavorite(state.favorites, key, progress.correctStreak),
        key,
        action.rating === 'unknown',
        action.today,
      );
      return {
        ...state,
        progress: {
          ...state.progress,
          [key]: progress,
        },
        favorites,
        daily: addDaily(state.daily, action.today, {
          newCount: 1,
          correct: action.rating === 'know' ? 1 : 0,
          wrong: action.rating === 'unknown' ? 1 : 0,
        }),
      };
    }

    case 'review': {
      const key = action.word.trim().toLowerCase();
      const previous = state.progress[key];
      if (!previous) return state;
      const progress = applyReview(previous, action.rating, action.today);
      const favorites = maybeAutoFavorite(
        maybeUnfavorite(state.favorites, key, progress.correctStreak),
        key,
        action.rating === 'forgot',
        action.today,
      );
      return {
        ...state,
        progress: {
          ...state.progress,
          [key]: progress,
        },
        favorites,
        daily: addDaily(state.daily, action.today, {
          reviewCount: 1,
          correct: action.rating === 'remember' ? 1 : 0,
          wrong: action.rating === 'forgot' ? 1 : 0,
        }),
      };
    }

    case 'toggleFavorite': {
      const key = action.word.trim().toLowerCase();
      if (!key) return state;
      const favorites = { ...state.favorites };
      if (favorites[key]) delete favorites[key];
      else favorites[key] = action.today;
      return { ...state, favorites };
    }

    case 'setActiveList': {
      if (!action.listId || action.listId === state.settings.activeListId) return state;
      return {
        ...state,
        settings: { ...state.settings, activeListId: action.listId },
      };
    }

    case 'setDailyGoal': {
      const goal = Math.min(200, Math.max(1, Math.round(action.goal)));
      if (!Number.isFinite(goal) || goal === state.settings.dailyGoal) return state;
      return {
        ...state,
        settings: { ...state.settings, dailyGoal: goal },
      };
    }

    case 'setStudyOrder': {
      if (action.order !== 'sequential' && action.order !== 'random') return state;
      if (action.order === state.settings.studyOrder) return state;
      return {
        ...state,
        settings: { ...state.settings, studyOrder: action.order },
      };
    }

    case 'setReminder': {
      const nextEnabled = action.enabled ?? state.settings.reminderEnabled;
      const nextTime =
        action.time !== undefined && /^([01]\d|2[0-3]):[0-5]\d$/.test(action.time)
          ? action.time
          : state.settings.reminderTime;
      if (
        nextEnabled === state.settings.reminderEnabled &&
        nextTime === state.settings.reminderTime
      ) {
        return state;
      }
      return {
        ...state,
        settings: {
          ...state.settings,
          reminderEnabled: nextEnabled,
          reminderTime: nextTime,
        },
      };
    }

    case 'replaceState':
      return action.state;

    case 'resetProgress':
      return {
        ...state,
        progress: {},
        daily: {},
      };

    default:
      return state;
  }
}
