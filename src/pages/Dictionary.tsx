import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../components/Common';
import { DictionaryEntryCard } from '../components/DictionaryEntryCard';
import { FavoriteButton } from '../components/FavoriteButton';
import { Icon } from '../components/Icon';
import { PronunciationControls } from '../components/PronunciationControls';
import { WordDetailsSection } from '../components/WordDetailsSection';
import { loadDictionary, loadMeta } from '../lib/data';
import {
  bestAudio,
  bestPhonetic,
  lookupOnlineCached,
  type DictionaryApiEntry,
  type OnlineLookupResult,
} from '../lib/onlineDict';
import { useAsync } from '../lib/useAsync';
import type { DictEntry } from '../types';

type OnlineStatus = 'idle' | 'loading' | 'done' | 'error';

interface OnlineState {
  status: OnlineStatus;
  result?: OnlineLookupResult;
  message?: string;
}

export default function DictionaryPage() {
  const [searchParams] = useSearchParams();
  const searchParamString = searchParams.toString();
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const deferredQuery = useDeferredValue(query);
  const normalized = deferredQuery.trim().toLowerCase();

  const dictState = useAsync(loadDictionary, []);
  const metaState = useAsync(loadMeta, []);
  const [onlineState, setOnlineState] = useState<OnlineState>({ status: 'idle' });
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const nextQuery = new URLSearchParams(searchParamString).get('q');
    if (nextQuery !== null) setQuery(nextQuery);
  }, [searchParamString]);

  const localResults = useMemo(() => {
    const dictionary = dictState.data;
    if (!dictionary || !normalized) return [];
    const exact: DictEntry[] = [];
    const prefix: DictEntry[] = [];
    const contains: DictEntry[] = [];
    for (const entry of dictionary) {
      const word = entry.w.toLowerCase();
      if (word === normalized) exact.push(entry);
      else if (word.startsWith(normalized)) prefix.push(entry);
      else if (word.includes(normalized)) contains.push(entry);
    }
    const byLength = (a: DictEntry, b: DictEntry) =>
      a.w.length - b.w.length || a.w.localeCompare(b.w);
    return [...exact, ...prefix.sort(byLength).slice(0, 12), ...contains.sort(byLength).slice(0, 12)];
  }, [dictState.data, normalized]);

  const hasExactLocal = localResults.some(
    (entry) => entry.w.toLowerCase() === normalized,
  );

  useEffect(() => {
    setOnlineState({ status: 'idle' });
    if (!normalized || !dictState.data || hasExactLocal) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setOnlineState({
          status: 'error',
          message: '当前处于离线状态。词库内的单词仍可查询，联网后可查词库外的单词。',
        });
        return;
      }
      setOnlineState({ status: 'loading' });
      try {
        const result = await lookupOnlineCached(normalized, controller.signal);
        if (controller.signal.aborted) return;
        if (result.youdao.length > 0 || result.dictApi.length > 0) {
          setOnlineState({ status: 'done', result });
        } else {
          setOnlineState({
            status: 'error',
            message: result.errors[0] ?? '没有找到这个词，检查一下拼写？',
          });
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setOnlineState({
          status: 'error',
          message: error instanceof Error ? error.message : '在线查询失败',
        });
      }
    }, 600);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [normalized, dictState.data, hasExactLocal, retryToken]);

  const listNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const list of metaState.data?.lists ?? []) map.set(list.id, list.short);
    return map;
  }, [metaState.data]);

  if (dictState.error) {
    return (
      <div className="page">
        <ErrorState message={dictState.error.message} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="page dictionary-page">
      <header className="page-header dictionary-header">
        <p className="eyebrow">DICTIONARY</p>
        <h1 className="page-title">词典</h1>
        <p className="page-subtitle">
          内置 {metaState.data?.uniqueWords?.toLocaleString('zh-CN') ?? '数千'} 个考试词汇，词库外的单词自动联网查询。
        </p>
      </header>

      <div className="search-box">
        <Icon name="search" size={20} />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="输入英文单词或短语"
          aria-label="搜索单词"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        {query ? (
          <button
            type="button"
            className="search-clear"
            aria-label="清空搜索"
            onClick={() => setQuery('')}
          >
            <Icon name="close" size={16} />
          </button>
        ) : null}
      </div>

      {dictState.loading ? (
        <LoadingState label="正在打开词典…" />
      ) : !normalized ? (
        <div className="dict-empty">
          <div className="dict-empty-icon">
            <Icon name="book" size={30} />
          </div>
          <h2>查一个词</h2>
          <p className="muted">
            支持中文释义、英美音标和发音。试试搜索下面的单词：
          </p>
          <div className="suggestion-chips">
            {['abandon', 'resilience', 'serendipity'].map((word) => (
              <button key={word} type="button" onClick={() => setQuery(word)}>
                {word}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="dict-results">
          <section className="dict-section">
            <div className="section-heading">
              <h2>本地词库</h2>
              <span className="muted small">
                {localResults.length > 0 ? `${localResults.length} 个结果` : '未收录'}
              </span>
            </div>
            {localResults.length > 0 ? (
              <div className="dict-entry-list">
                {localResults.map((entry) => (
                  <DictionaryEntryCard
                    key={entry.w}
                    entry={entry}
                    listNames={listNames}
                    autoOpenDetails={entry.w.toLowerCase() === normalized}
                  />
                ))}
              </div>
            ) : (
              <p className="dict-no-local">
                词库中没有「{deferredQuery.trim()}」，正在向在线词典查询。
              </p>
            )}
          </section>

          {!hasExactLocal ? (
            <section className="dict-section">
              <div className="section-heading">
                <h2>在线词典</h2>
                <span className="muted small">
                  {onlineState.status === 'loading' ? '查询中…' : '有道 + Free Dictionary'}
                </span>
              </div>
              <OnlineSection
                state={onlineState}
                query={deferredQuery.trim()}
                onRetry={() => setRetryToken((value) => value + 1)}
              />
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function OnlineSection({
  state,
  query,
  onRetry,
}: {
  state: OnlineState;
  query: string;
  onRetry: () => void;
}) {
  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div className="online-loading">
        <div className="spinner small" aria-hidden="true" />
        <span>正在联网查询「{query}」…</span>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="online-error">
        <p>{state.message}</p>
        <button type="button" className="ghost-button compact" onClick={onRetry}>
          重试
        </button>
      </div>
    );
  }

  const result = state.result;
  if (!result) return null;

  const normalizedQuery = query.toLowerCase();
  const exactYoudao = result.youdao.filter(
    (item) => item.entry.toLowerCase() === normalizedQuery,
  );
  const youdaoEntries = exactYoudao.length > 0 ? exactYoudao : result.youdao.slice(0, 3);

  return (
    <div className="online-results">
      {youdaoEntries.length > 0 ? (
        <div className="online-card">
          <p className="online-source">中文释义 · 有道</p>
          <div className="online-card-head">
            <h3>{youdaoEntries[0].entry}</h3>
            <div className="online-card-actions">
              <FavoriteButton word={youdaoEntries[0].entry} />
              <PronunciationControls word={youdaoEntries[0].entry} />
            </div>
          </div>
          {youdaoEntries.map((item, index) => (
            <p className="online-explain" key={`${item.entry}-${index}`}>
              {item.explain}
            </p>
          ))}
          {exactYoudao.length === 0 ? (
            <p className="muted tiny">以上为相关词条</p>
          ) : null}
          <WordDetailsSection word={youdaoEntries[0].entry} autoOpen />
        </div>
      ) : null}

      {result.dictApi.slice(0, 2).map((entry, entryIndex) => (
        <DictionaryApiCard entry={entry} key={`${entry.word}-${entryIndex}`} />
      ))}

      {result.errors.length > 0 ? (
        <p className="muted tiny">部分来源暂不可用：{result.errors.join('；')}</p>
      ) : null}
    </div>
  );
}

function DictionaryApiCard({ entry }: { entry: DictionaryApiEntry }) {
  const phonetic = bestPhonetic(entry);
  const audio = bestAudio(entry);
  const meanings = entry.meanings ?? [];

  return (
    <article className="online-card dictionary-api-card">
      <p className="online-source">英文释义 · Free Dictionary</p>
      <div className="online-card-head">
        <div>
          <h3>{entry.word}</h3>
          {phonetic ? <p className="online-phonetic">{phonetic}</p> : null}
        </div>
        <div className="online-card-actions">
          <FavoriteButton word={entry.word} />
          <PronunciationControls word={entry.word} fallbackAudioUrl={audio} />
        </div>
      </div>

      {meanings.map((meaning, meaningIndex) => (
        <div className="meaning-group" key={`${meaning.partOfSpeech}-${meaningIndex}`}>
          <span className="pos-label">{meaning.partOfSpeech}</span>
          <ol>
            {meaning.definitions.slice(0, 3).map((definition, definitionIndex) => (
              <li key={definitionIndex}>
                <span>{definition.definition}</span>
                {definition.example ? (
                  <em className="example">“{definition.example}”</em>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ))}

      {meanings.length === 0 ? <p className="muted small">暂无英文释义</p> : null}
      <WordDetailsSection word={entry.word} />
    </article>
  );
}
