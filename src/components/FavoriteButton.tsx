import { todayKey } from '../lib/date';
import { useAppState } from '../state/AppState';
import { Icon } from './Icon';

export function FavoriteButton({ word, size = 17 }: { word: string; size?: number }) {
  const { state, dispatch } = useAppState();
  const key = word.trim().toLowerCase();
  const active = Boolean(state.favorites[key]);

  return (
    <button
      type="button"
      className={`favorite-button${active ? ' is-active' : ''}`}
      aria-label={active ? `取消收藏 ${word}` : `收藏 ${word}`}
      aria-pressed={active}
      title={active ? '取消收藏' : '收藏单词'}
      onClick={(event) => {
        event.stopPropagation();
        dispatch({ type: 'toggleFavorite', word: key, today: todayKey() });
      }}
    >
      <Icon name="bookmark" size={size} filled={active} />
    </button>
  );
}
