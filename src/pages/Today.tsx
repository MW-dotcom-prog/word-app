import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState, LoadingState, ProgressBar, StatTile } from '../components/Common';
import { Icon } from '../components/Icon';
import { findActiveList, loadListKeys, loadMeta } from '../lib/data';
import { formatDateLabel, todayKey } from '../lib/date';
import {
  computeStreak,
  getDaily,
  getDueCount,
  getLearnedCount,
  getTodayNewRemaining,
} from '../lib/selectors';
import { accuracyPercent } from '../lib/srs';
import { useAsync } from '../lib/useAsync';
import { useAppState } from '../state/AppState';

function greetingForHour(hour: number): string {
  if (hour < 5) return '夜深了';
  if (hour < 12) return '早上好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

export default function TodayPage() {
  const { state } = useAppState();
  const [today] = useState(() => todayKey());
  const [greeting] = useState(() => greetingForHour(new Date().getHours()));

  const metaState = useAsync(loadMeta, []);
  const activeList = findActiveList(metaState.data, state.settings.activeListId);
  const keysState = useAsync<{ listId: string | null; keys: string[] }>(
    async () => {
      if (!activeList) return { listId: null, keys: [] };
      return { listId: activeList.id, keys: await loadListKeys(activeList.id) };
    },
    [activeList?.id],
  );

  const daily = getDaily(state, today);
  const dueCount = getDueCount(state, today);
  const remaining = getTodayNewRemaining(state, today);
  const streak = computeStreak(state.daily, today);
  const accuracy = accuracyPercent(daily.correct, daily.wrong);

  const error = metaState.error ?? keysState.error;
  if (error) {
    return (
      <div className="page">
        <ErrorState message={error.message} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  if (
    metaState.loading ||
    !activeList ||
    keysState.loading ||
    !keysState.data ||
    keysState.data.listId !== activeList.id
  ) {
    return (
      <div className="page">
        <LoadingState label="正在打开今日计划…" />
      </div>
    );
  }

  const listKeys = keysState.data.keys;
  const learned = getLearnedCount(listKeys, state.progress);
  const total = listKeys.length;

  return (
    <div className="page home-page">
      <header className="page-header home-header">
        <div>
          <p className="eyebrow">{formatDateLabel(today)}</p>
          <h1 className="page-title">{greeting}</h1>
        </div>
        <div className="streak-chip" title="连续学习天数">
          <Icon name="flame" size={18} />
          <span>{streak} 天</span>
        </div>
      </header>

      <section className="hero-card">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-top">
          <span className="hero-kicker">当前词库</span>
          <Link to="/lists" className="hero-link">
            切换
            <Icon name="chevron-right" size={15} />
          </Link>
        </div>
        <h2>{activeList.name}</h2>
        <p className="hero-sub">
          {activeList.description} · 共 {total.toLocaleString('zh-CN')} 词
        </p>
        <div className="hero-progress">
          <ProgressBar value={learned} max={total} label="词库学习进度" />
          <span>
            {learned.toLocaleString('zh-CN')} / {total.toLocaleString('zh-CN')}
          </span>
        </div>
      </section>

      <div className="action-grid">
        <Link to="/learn" className="action-card">
          <span className="action-icon">
            <Icon name={remaining === 0 ? 'arrow-right' : 'book'} size={22} />
          </span>
          <span className="action-body">
            <span className="action-label">今日新词</span>
            <strong>{remaining === 0 ? '已完成 · 继续' : `${remaining} 个待学`}</strong>
            <span className="action-hint">
              {remaining === 0
                ? `今天已学 ${daily.newCount} 个，可继续加练`
                : state.settings.studyOrder === 'random'
                  ? '乱序学习'
                  : '按词库顺序学习'}
            </span>
          </span>
          <Icon name="chevron-right" size={17} className="action-chevron" />
        </Link>

        <Link
          to="/review"
          className={`action-card review${dueCount === 0 ? ' is-complete' : ''}`}
        >
          <span className="action-icon">
            <Icon name={dueCount === 0 ? 'check' : 'cards'} size={22} />
          </span>
          <span className="action-body">
            <span className="action-label">今日复习</span>
            <strong>{dueCount === 0 ? '暂无复习' : `${dueCount} 个待复习`}</strong>
            <span className="action-hint">
              {dueCount === 0 ? '学过的词次日出现' : '趁热打铁，巩固记忆'}
            </span>
          </span>
          <Icon name="chevron-right" size={17} className="action-chevron" />
        </Link>
      </div>

      <section className="today-card">
        <div className="section-heading">
          <h2>今日小结</h2>
          <span className="muted small">{formatDateLabel(today)}</span>
        </div>
        <div className="stat-row">
          <StatTile label="新学" value={daily.newCount} />
          <StatTile label="复习" value={daily.reviewCount} />
          <StatTile label="正确率" value={accuracy === null ? '—' : `${accuracy}%`} />
        </div>
      </section>

      <p className="home-quote">每天一点，记得更牢。</p>
    </div>
  );
}
