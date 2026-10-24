import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState, LoadingState, ProgressBar, StatTile } from '../components/Common';
import { Icon } from '../components/Icon';
import { loadListKeys, loadMeta } from '../lib/data';
import { addDays, formatDateLabel, todayKey } from '../lib/date';
import { computeStreak, getDaily, getLearnedCount, getTotals } from '../lib/selectors';
import { accuracyPercent } from '../lib/srs';
import { useAsync } from '../lib/useAsync';
import { useAppState } from '../state/AppState';

interface DayPoint {
  key: string;
  short: string;
  newCount: number;
  reviewCount: number;
  total: number;
}

function shortDate(key: string): string {
  const [, month, day] = key.split('-');
  return `${Number(month)}/${Number(day)}`;
}

function niceMax(value: number): number {
  return Math.max(4, Math.ceil(value / 4) * 4);
}

export default function StatsPage() {
  const { state } = useAppState();
  const [today] = useState(() => todayKey());
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const metaState = useAsync(loadMeta, []);
  const keysState = useAsync(async () => {
    if (!metaState.data) return {} as Record<string, string[]>;
    const pairs = await Promise.all(
      metaState.data.lists.map(async (list) => {
        const keys = await loadListKeys(list.id);
        return [list.id, keys] as const;
      }),
    );
    return Object.fromEntries(pairs) as Record<string, string[]>;
  }, [metaState.data]);

  const days = useMemo<DayPoint[]>(
    () =>
      Array.from({ length: 14 }, (_, index) => {
        const key = addDays(today, index - 13);
        const stat = getDaily(state, key);
        return {
          key,
          short: shortDate(key),
          newCount: stat.newCount,
          reviewCount: stat.reviewCount,
          total: stat.newCount + stat.reviewCount,
        };
      }),
    [state, today],
  );

  const totals = getTotals(state, today);
  const streak = computeStreak(state.daily, today);
  const activeDays = Object.values(state.daily).filter(
    (stat) => stat.newCount + stat.reviewCount > 0,
  ).length;
  const sumNew = Object.values(state.daily).reduce((sum, stat) => sum + stat.newCount, 0);
  const sumReview = Object.values(state.daily).reduce(
    (sum, stat) => sum + stat.reviewCount,
    0,
  );
  const sumCorrect = Object.values(state.daily).reduce(
    (sum, stat) => sum + stat.correct,
    0,
  );
  const sumWrong = Object.values(state.daily).reduce((sum, stat) => sum + stat.wrong, 0);
  const accuracy = accuracyPercent(sumCorrect, sumWrong);

  if (metaState.error || keysState.error) {
    const error = metaState.error ?? keysState.error;
    return (
      <div className="page">
        <ErrorState message={error?.message ?? '统计加载失败'} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  if (metaState.loading || keysState.loading || !metaState.data || !keysState.data) {
    return (
      <div className="page">
        <LoadingState label="正在整理学习数据…" />
      </div>
    );
  }

  const meta = metaState.data;
  const listKeys = keysState.data;
  const yMax = niceMax(Math.max(...days.map((day) => day.total), 1));
  const active = days.find((day) => day.key === activeKey) ?? null;
  const peak = days.reduce(
    (best, day) => (day.total > best.total ? day : best),
    days[0],
  );
  const windowTotal = days.reduce((sum, day) => sum + day.total, 0);
  const overallPercent =
    meta.uniqueWords > 0 ? Math.round((totals.learned / meta.uniqueWords) * 100) : 0;
  const axisLabelIndices = new Set([0, 3, 6, 9, 13]);

  return (
    <div className="page stats-page">
      <header className="page-header stats-header">
        <Link to="/profile" className="back-link">
          <Icon name="back" size={15} />
          我的
        </Link>
        <p className="eyebrow">INSIGHTS</p>
        <h1 className="page-title">学习统计</h1>
        <p className="page-subtitle">最近 14 天的学习节奏和词库完成度。</p>
      </header>

      <div className="stat-grid stats-kpis">
        <StatTile label="已学单词" value={totals.learned} />
        <StatTile label="已掌握" value={totals.mastered} hint="复习间隔达 60 天" />
        <StatTile label="连续打卡" value={`${streak} 天`} />
        <StatTile label="学习天数" value={`${activeDays} 天`} />
      </div>

      <section className="panel chart-card">
        <div className="section-heading">
          <h2>近 14 天学习量</h2>
          <span className="muted small">共 {windowTotal} 个</span>
        </div>

        <div className="chart-legend" aria-label="图例">
          <span>
            <i className="legend-swatch chart-swatch-new" aria-hidden="true" />
            新学
          </span>
          <span>
            <i className="legend-swatch chart-swatch-review" aria-hidden="true" />
            复习
          </span>
        </div>

        <p className="chart-readout" aria-live="polite">
          {active
            ? `${formatDateLabel(active.key)} · 新学 ${active.newCount} · 复习 ${active.reviewCount}`
            : peak.total > 0
              ? `峰值 ${formatDateLabel(peak.key)} · ${peak.total} 个`
              : '开始学习后，这里会显示每天的新学和复习量。'}
        </p>

        <div className="chart-body">
          <div className="chart-y-axis" aria-hidden="true">
            <span>{yMax}</span>
            <span>{yMax / 2}</span>
            <span>0</span>
          </div>
          <div className="chart-plot">
            <div className="chart-grid-lines" aria-hidden="true">
              <span style={{ bottom: '100%' }} />
              <span style={{ bottom: '50%' }} />
              <span style={{ bottom: '0%' }} />
            </div>
            <div className="chart-bars">
              {days.map((day) => (
                <button
                  key={day.key}
                  type="button"
                  className={`chart-bar-hit${activeKey === day.key ? ' is-active' : ''}`}
                  aria-label={`${formatDateLabel(day.key)}，新学 ${day.newCount} 个，复习 ${day.reviewCount} 个`}
                  onMouseEnter={() => setActiveKey(day.key)}
                  onMouseLeave={() => setActiveKey(null)}
                  onFocus={() => setActiveKey(day.key)}
                  onBlur={() => setActiveKey(null)}
                >
                  <span
                    className="chart-bar-stack"
                    style={{ height: `${(day.total / yMax) * 100}%` }}
                  >
                    {day.newCount > 0 ? (
                      <span
                        className="chart-bar-seg chart-seg-new"
                        style={{
                          height: `${(day.newCount / Math.max(day.total, 1)) * 100}%`,
                        }}
                      />
                    ) : null}
                    {day.reviewCount > 0 ? (
                      <span
                        className="chart-bar-seg chart-seg-review"
                        style={{
                          height: `${(day.reviewCount / Math.max(day.total, 1)) * 100}%`,
                        }}
                      />
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="chart-x-axis" aria-hidden="true">
          {days.map((day, index) => (
            <span key={day.key} className="chart-x-label">
              {axisLabelIndices.has(index) ? day.short : ''}
            </span>
          ))}
        </div>

        <details className="chart-table">
          <summary>查看数据表</summary>
          <table>
            <thead>
              <tr>
                <th scope="col">日期</th>
                <th scope="col">新学</th>
                <th scope="col">复习</th>
                <th scope="col">合计</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.key}>
                  <th scope="row">{formatDateLabel(day.key)}</th>
                  <td>{day.newCount}</td>
                  <td>{day.reviewCount}</td>
                  <td>{day.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>累计表现</h2>
          <span className="muted small">全部时间</span>
        </div>
        <div className="stat-row">
          <StatTile label="累计新学" value={sumNew} />
          <StatTile label="累计复习" value={sumReview} />
          <StatTile label="正确率" value={accuracy === null ? '—' : `${accuracy}%`} />
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>词库完成度</h2>
          <span className="muted small">
            {totals.learned} / {meta.uniqueWords}
          </span>
        </div>
        <div className="overall-completion">
          <div className="overall-completion-head">
            <span>去重词库总完成度</span>
            <strong>{overallPercent}%</strong>
          </div>
          <ProgressBar value={totals.learned} max={meta.uniqueWords} label="总词库完成度" />
        </div>

        <div className="stats-list-rows">
          {meta.lists.map((list) => {
            const keys = listKeys[list.id] ?? [];
            const learned = getLearnedCount(keys, state.progress);
            return (
              <div className={`stats-list-row list-${list.id}`} key={list.id}>
                <div className="stats-list-head">
                  <span className="list-badge">{list.short}</span>
                  <span className="stats-list-name">{list.name}</span>
                  <span className="stats-list-count">
                    {learned} / {keys.length}
                  </span>
                </div>
                <ProgressBar
                  value={learned}
                  max={keys.length}
                  label={`${list.name}完成度`}
                />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
