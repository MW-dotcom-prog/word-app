import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/Common';
import { DictionaryEntryCard } from '../components/DictionaryEntryCard';
import { FavoriteButton } from '../components/FavoriteButton';
import { loadDictionary, loadMeta } from '../lib/data';
import { getFavoriteKeys } from '../lib/selectors';
import { AUTO_UNFAVORITE_STREAK } from '../lib/srs';
import { useAsync } from '../lib/useAsync';
import { useAppState } from '../state/AppState';
import type { DictEntry } from '../types';

export default function FavoritesPage() {
  const { state } = useAppState();
  const dictState = useAsync(loadDictionary, []);
  const metaState = useAsync(loadMeta, []);

  const favoriteKeys = getFavoriteKeys(state.favorites);
  const error = dictState.error ?? metaState.error;

  if (error) {
    return (
      <div className="page">
        <ErrorState message={error.message} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  if (dictState.loading || !dictState.data || metaState.loading || !metaState.data) {
    return (
      <div className="page">
        <LoadingState label="正在打开收藏…" />
      </div>
    );
  }

  const dictionary = dictState.data as DictEntry[];
  const entryMap = new Map<string, DictEntry>();
  for (const entry of dictionary) entryMap.set(entry.w.toLowerCase(), entry);

  const listNames = new Map<string, string>();
  for (const list of metaState.data?.lists ?? []) listNames.set(list.id, list.short);

  return (
    <div className="page favorites-page">
      <header className="page-header">
        <p className="eyebrow">FAVORITES</p>
        <h1 className="page-title">收藏</h1>
        <p className="page-subtitle">
          {favoriteKeys.length > 0
            ? `已收藏 ${favoriteKeys.length} 个单词，收藏不会改变复习计划；标记「不认识/忘了」会自动加入收藏，连续 ${AUTO_UNFAVORITE_STREAK} 次「认识/记得」后自动取消收藏。`
            : '把想反复看的单词收藏起来，随时回来复习。'}
        </p>
      </header>

      {favoriteKeys.length > 0 ? (
        <div className="favorites-toolbar">
          <span className="muted small">专项复习收藏里的单词</span>
          <Link className="primary-button compact" to="/review/favorites">
            复习收藏
          </Link>
        </div>
      ) : null}

      {favoriteKeys.length === 0 ? (
        <EmptyState
          icon="bookmark"
          title="还没有收藏"
          description="在背单词或查词典时，点击单词旁边的书签图标即可收藏。"
        >
          <Link className="primary-button" to="/learn">
            去背单词
          </Link>
          <Link className="ghost-button" to="/dictionary">
            查词典
          </Link>
        </EmptyState>
      ) : (
        <div className="dict-entry-list favorites-list">
          {favoriteKeys.map((key) => {
            const entry = entryMap.get(key);
            if (entry) {
              return (
                <DictionaryEntryCard key={key} entry={entry} listNames={listNames} />
              );
            }
            return (
              <article className="dict-entry-card favorite-missing-card" key={key}>
                <div className="dict-entry-head">
                  <div className="dict-word-block">
                    <h3>{key}</h3>
                    <p className="muted small">词库外单词</p>
                  </div>
                  <FavoriteButton word={key} />
                </div>
                <Link
                  className="ghost-button compact favorite-search-link"
                  to={`/dictionary?q=${encodeURIComponent(key)}`}
                >
                  在线查询
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
