import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { DictEntry, NewRating, ReviewRating } from '../types';
import {
  findActiveList,
  indexDictionary,
  loadDictionary,
  loadListKeys,
  loadMeta,
} from '../lib/data';
import { todayKey } from '../lib/date';
import {
  getDaily,
  getDueWords,
  getFavoriteKeys,
  getNewKeys,
  getTodayNewRemaining,
  shuffle,
} from '../lib/selectors';
import { useAsync } from '../lib/useAsync';
import { useAppState } from '../state/AppState';
import { ConfirmDialog, EmptyState, ErrorState, LoadingState, ProgressBar } from './Common';
import { FavoriteButton } from './FavoriteButton';
import { Icon } from './Icon';
import { PronunciationControls } from './PronunciationControls';
import { WordDetailsSection } from './WordDetailsSection';

type StudyMode = 'learn' | 'review';
type StudyScope = 'all' | 'favorites';
type QueueReason = 'ok' | 'empty' | 'exhausted';
type Tone = 'good' | 'mid' | 'bad';

interface RatingOption {
  rating: NewRating | ReviewRating;
  label: string;
  hint: string;
  tone: Tone;
}

const LEARN_RATINGS: RatingOption[] = [
  { rating: 'know', label: '认识', hint: '记得很清楚', tone: 'good' },
  { rating: 'fuzzy', label: '模糊', hint: '有点印象', tone: 'mid' },
  { rating: 'unknown', label: '不认识', hint: '完全没印象', tone: 'bad' },
];

const REVIEW_RATINGS: RatingOption[] = [
  { rating: 'remember', label: '记得', hint: '轻松想起', tone: 'good' },
  { rating: 'fuzzy', label: '模糊', hint: '需要巩固', tone: 'mid' },
  { rating: 'forgot', label: '忘了', hint: '重新开始', tone: 'bad' },
];

export function StudySession({
  mode,
  scope = 'all',
}: {
  mode: StudyMode;
  scope?: StudyScope;
}) {
  const navigate = useNavigate();
  const { state, dispatch } = useAppState();
  const [sessionDate] = useState(() => todayKey());
  const isFavoriteScope = scope === 'favorites';
  const sessionTitle = isFavoriteScope
    ? '收藏复习'
    : mode === 'learn'
      ? '今日新词'
      : '今日复习';
  const exitTarget = isFavoriteScope ? '/favorites' : '/';

  const metaState = useAsync(loadMeta, []);
  const activeList = findActiveList(metaState.data, state.settings.activeListId);
  const keysState = useAsync<{ listId: string | null; keys: string[] }>(
    async () => {
      if (mode !== 'learn' || !activeList) return { listId: null, keys: [] };
      return { listId: activeList.id, keys: await loadListKeys(activeList.id) };
    },
    [activeList?.id, mode],
  );
  const dictState = useAsync(loadDictionary, []);

  const [queue, setQueue] = useState<DictEntry[] | null>(null);
  const [reason, setReason] = useState<QueueReason>('ok');
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [counts, setCounts] = useState({ good: 0, mid: 0, bad: 0 });
  const [exitOpen, setExitOpen] = useState(false);
  const [isExtraSession, setIsExtraSession] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);
  const ratingLock = useRef(false);

  // Snapshot the queue once. State updates caused by rating must not mutate it.
  useEffect(() => {
    if (queue !== null || !dictState.data) return;

    // Wait for the list metadata AND the exact list's keys. Without the id
    // check, the initial empty placeholder result can be mistaken for an
    // exhausted list ("已背完") before the real keys arrive.
    if (
      mode === 'learn' &&
      (!activeList || !keysState.data || keysState.data.listId !== activeList.id)
    ) {
      return;
    }

    const dictionary = indexDictionary(dictState.data);

    if (isFavoriteScope) {
      let entries = getFavoriteKeys(state.favorites)
        .map((key) => dictionary.get(key))
        .filter((entry): entry is DictEntry => Boolean(entry));
      if (state.settings.studyOrder === 'random') entries = shuffle(entries);
      setIsExtraSession(false);
      setReason(entries.length > 0 ? 'ok' : 'empty');
      setQueue(entries);
      return;
    }

    if (mode === 'learn') {
      const remaining = getTodayNewRemaining(state, sessionDate);
      const extra = remaining <= 0;
      setIsExtraSession(extra);
      const batchSize = extra ? state.settings.dailyGoal : remaining;
      const keys = getNewKeys(
        keysState.data?.keys ?? [],
        state,
        batchSize,
        state.settings.studyOrder,
      );
      const entries = keys
        .map((key) => dictionary.get(key))
        .filter((entry): entry is DictEntry => Boolean(entry));
      setReason(entries.length > 0 ? 'ok' : 'exhausted');
      setQueue(entries);
      return;
    }

    setIsExtraSession(false);
    const entries = getDueWords(state, sessionDate, state.settings.studyOrder)
      .map(([key]) => dictionary.get(key))
      .filter((entry): entry is DictEntry => Boolean(entry));
    setReason(entries.length > 0 ? 'ok' : 'empty');
    setQueue(entries);
  }, [
    queue,
    dictState.data,
    keysState.data,
    activeList,
    mode,
    isFavoriteScope,
    sessionDate,
    state,
    sessionVersion,
  ]);

  const error = dictState.error ?? (mode === 'learn' ? metaState.error ?? keysState.error : null);
  const isLoading = !error && queue === null;

  const handleExit = () => {
    if (index > 0 && !finished) setExitOpen(true);
    else navigate(exitTarget);
  };

  const handleRate = (option: RatingOption) => {
    const current = queue?.[index];
    if (!current || ratingLock.current) return;
    ratingLock.current = true;
    window.setTimeout(() => {
      ratingLock.current = false;
    }, 260);
    const word = current.w.toLowerCase();
    const hasProgress = Boolean(state.progress[word]);

    if (isFavoriteScope) {
      if (hasProgress) {
        dispatch({
          type: 'review',
          word,
          rating: option.rating as ReviewRating,
          today: sessionDate,
        });
      } else {
        dispatch({
          type: 'learn',
          word,
          rating: option.rating as NewRating,
          today: sessionDate,
        });
      }
    } else if (mode === 'learn') {
      dispatch({
        type: 'learn',
        word,
        rating: option.rating as NewRating,
        today: sessionDate,
      });
    } else {
      dispatch({
        type: 'review',
        word,
        rating: option.rating as ReviewRating,
        today: sessionDate,
      });
    }

    setCounts((previous) => ({
      ...previous,
      [option.tone]: previous[option.tone] + 1,
    }));
    setRevealed(false);

    if (index + 1 >= (queue?.length ?? 0)) setFinished(true);
    else setIndex((value) => value + 1);
  };

  const startAnotherSession = () => {
    ratingLock.current = false;
    setQueue(null);
    setReason('ok');
    setIndex(0);
    setRevealed(false);
    setFinished(false);
    setCounts({ good: 0, mid: 0, bad: 0 });
    setIsExtraSession(false);
    setSessionVersion((value) => value + 1);
  };

  if (error) {
    return (
      <SessionShell title={sessionTitle} onExit={handleExit}>
        <ErrorState message={error.message} onRetry={() => window.location.reload()} />
      </SessionShell>
    );
  }

  if (isLoading) {
    return (
      <SessionShell title={sessionTitle} onExit={handleExit}>
        <LoadingState label="正在准备单词…" />
      </SessionShell>
    );
  }

  if (finished) {
    const total = counts.good + counts.mid + counts.bad;
    const dailyCount = getDaily(state, sessionDate).newCount;
    return (
      <div className="session-page summary-page">
        <div className="summary-mark">
          <Icon name="check" size={34} />
        </div>
        <p className="eyebrow">{mode === 'learn' ? 'LEARNED' : 'REVIEWED'}</p>
        <h1>
          {isFavoriteScope
            ? '收藏复习完成'
            : mode === 'learn'
              ? isExtraSession
                ? '继续学习完成'
                : '今日新词完成'
              : '复习完成'}
        </h1>
        <p className="muted summary-lead">
          {isFavoriteScope
            ? `复习了 ${total} 个收藏单词；其中未学过的词已加入学习计划。`
            : mode === 'learn'
              ? `本组学习了 ${total} 个新词，今天累计 ${dailyCount} 个。明天会按艾宾浩斯曲线进入复习。`
              : `完成了 ${total} 个单词的复习，记得越牢，间隔越长。`}
        </p>
        <div className="summary-grid">
          <div className="summary-stat tone-good">
            <strong>{counts.good}</strong>
            <span>
              {isFavoriteScope ? '掌握' : mode === 'learn' ? '认识' : '记得'}
            </span>
          </div>
          <div className="summary-stat tone-mid">
            <strong>{counts.mid}</strong>
            <span>模糊</span>
          </div>
          <div className="summary-stat tone-bad">
            <strong>{counts.bad}</strong>
            <span>
              {isFavoriteScope ? '未记住' : mode === 'learn' ? '不认识' : '忘了'}
            </span>
          </div>
        </div>
        <div className="summary-actions">
          {!isFavoriteScope && mode === 'learn' ? (
            <button type="button" className="primary-button" onClick={startAnotherSession}>
              继续学习
            </button>
          ) : null}
          {isFavoriteScope ? (
            <>
              <Link className="primary-button" to="/favorites">
                回到收藏
              </Link>
              <Link className="ghost-button" to="/">
                回到今日
              </Link>
            </>
          ) : (
            <Link className={mode === 'learn' ? 'ghost-button' : 'primary-button'} to="/">
              回到今日
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (!queue || queue.length === 0) {
    return (
      <SessionShell title={sessionTitle} onExit={handleExit}>
        {isFavoriteScope ? (
          <EmptyState
            icon="bookmark"
            title="收藏里还没有可复习的单词"
            description={
              Object.keys(state.favorites).length > 0
                ? '收藏的词库外单词暂不支持专项复习，可以在词典中查看。'
                : '先去学习或查词典，点击书签收藏单词。'
            }
          >
            <Link className="primary-button" to="/favorites">
              去收藏页
            </Link>
            <Link className="ghost-button" to="/">
              回到今日
            </Link>
          </EmptyState>
        ) : reason === 'exhausted' ? (
          <EmptyState
            icon="cards"
            title="这个词库已经学完了"
            description="所有单词都学过一遍，可以切换词库，或者等待复习。"
          >
            <Link className="primary-button" to="/lists">
              切换词库
            </Link>
            <Link className="ghost-button" to="/">
              回到今日
            </Link>
          </EmptyState>
        ) : (
          <EmptyState
            icon="sparkle"
            title="今天没有要复习的单词"
            description="学过的单词会在次日自动进入复习队列。"
          >
            <Link className="primary-button" to="/">
              回到今日
            </Link>
            <Link className="ghost-button" to="/learn">
              学习新词
            </Link>
          </EmptyState>
        )}
      </SessionShell>
    );
  }

  const current = queue[index];
  const currentHasProgress = Boolean(state.progress[current.w.toLowerCase()]);
  const ratings = isFavoriteScope
    ? currentHasProgress
      ? REVIEW_RATINGS
      : LEARN_RATINGS
    : mode === 'learn'
      ? LEARN_RATINGS
      : REVIEW_RATINGS;
  const wordLength = current.w.length;
  const wordSizeClass =
    wordLength > 14
      ? ' is-very-long'
      : wordLength > 10
        ? ' is-long'
        : wordLength > 7
          ? ' is-medium'
          : '';

  return (
    <div className="session-page">
      <header className="session-header">
        <button type="button" className="icon-button" aria-label="退出" onClick={handleExit}>
          <Icon name="back" size={22} />
        </button>
        <div className="session-progress">
          <div className="session-progress-meta">
            <span>
              {sessionTitle}
              {state.settings.studyOrder === 'random' ? ' · 乱序' : ''}
            </span>
            <span>
              {index + 1} / {queue.length}
            </span>
          </div>
          <ProgressBar value={index} max={queue.length} label="本次进度" />
        </div>
        <div className="session-header-spacer" aria-hidden="true" />
      </header>

      <main className="study-main">
        {isExtraSession ? (
          <div className="extra-session-banner">
            <Icon name="flame" size={15} />
            今日目标已完成，继续向前
          </div>
        ) : null}

        <div className={`study-card${revealed ? ' is-revealed' : ''}`}>
          <div className="study-card-top">
            <span className="study-eyebrow">
              {isFavoriteScope
                ? currentHasProgress
                  ? '收藏 · 复习'
                  : '收藏 · 新词'
                : mode === 'learn'
                  ? isExtraSession
                    ? '加练 · 新词'
                    : '新词'
                  : `复习 · 第 ${index + 1} 个`}
            </span>
            <div className="study-card-actions">
              <FavoriteButton word={current.w} />
              <PronunciationControls word={current.w} />
            </div>
          </div>

          <button
            type="button"
            className="study-reveal"
            onClick={() => setRevealed((value) => !value)}
            aria-expanded={revealed}
          >
            <span className={`study-word${wordSizeClass}`}>{current.w}</span>
            <span className="study-phonetics">
              {current.us ? (
                <span>
                  <em>US</em> /{current.us}/
                </span>
              ) : null}
              {current.uk ? (
                <span>
                  <em>UK</em> /{current.uk}/
                </span>
              ) : null}
              {!current.us && !current.uk ? <span className="muted">点击朗读</span> : null}
            </span>

            {revealed ? (
              <span className="study-meaning">
                {current.t.map((line, lineIndex) => (
                  <span className="meaning-line" key={lineIndex}>
                    {line}
                  </span>
                ))}
              </span>
            ) : (
              <span className="study-hint">
                <span className="hint-dot" aria-hidden="true" />
                轻点卡片显示释义
              </span>
            )}
          </button>

          {revealed ? (
            <WordDetailsSection
              key={current.w}
              word={current.w}
              showPhrases={false}
              className="study-word-details"
            />
          ) : null}

          <div className="study-card-footer">
            <span className="muted small">
              {revealed ? '根据回忆程度选择' : '先在心里回想，再查看释义'}
            </span>
          </div>
        </div>

        <div className={`rating-row${revealed ? '' : ' is-locked'}`}>
          {ratings.map((option) => (
            <button
              key={option.rating}
              type="button"
              className={`rating-button tone-${option.tone}`}
              disabled={!revealed}
              onClick={() => handleRate(option)}
            >
              <span className="rating-label">{option.label}</span>
              <span className="rating-hint">{option.hint}</span>
            </button>
          ))}
        </div>

        <p className="session-tip">
          {isFavoriteScope
            ? currentHasProgress
              ? '按艾宾浩斯曲线更新这个词的复习时间。'
              : '已加入学习计划，明天开始复习。'
            : mode === 'learn'
              ? '新词会按艾宾浩斯曲线进入复习。'
              : '艾宾浩斯复习：次日 → 2天 → 4天 → 7天 → 15天 → 30天 → 60天'}
        </p>
      </main>

      <ConfirmDialog
        open={exitOpen}
        title="要退出本次学习吗？"
        description="已经评分的单词会保留进度。"
        confirmLabel="退出"
        cancelLabel="继续学习"
        onConfirm={() => navigate(exitTarget)}
        onCancel={() => setExitOpen(false)}
      />
    </div>
  );
}

function SessionShell({
  title,
  onExit,
  children,
}: {
  title: string;
  onExit: () => void;
  children: ReactNode;
}) {
  return (
    <div className="session-page">
      <header className="session-header simple">
        <button type="button" className="icon-button" aria-label="退出" onClick={onExit}>
          <Icon name="back" size={22} />
        </button>
        <span className="session-title">{title}</span>
        <div className="session-header-spacer" aria-hidden="true" />
      </header>
      <main className="session-shell-content">{children}</main>
    </div>
  );
}
