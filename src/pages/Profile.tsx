import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AccountPanel } from '../components/AccountPanel';
import { ConfirmDialog, StatTile } from '../components/Common';
import { Icon } from '../components/Icon';
import { loadMeta } from '../lib/data';
import { todayKey } from '../lib/date';
import {
  ensureWebNotificationPermission,
  isNativeApp,
  notificationSupported,
  type NativeReminderStatus,
} from '../lib/reminder';
import { computeStreak, getDaily, getTotals } from '../lib/selectors';
import { accuracyPercent } from '../lib/srs';
import { DAILY_GOAL_OPTIONS } from '../lib/storage';
import { useAsync } from '../lib/useAsync';
import { useAppState } from '../state/AppState';

export default function ProfilePage() {
  const { state, dispatch } = useAppState();
  const metaState = useAsync(loadMeta, []);
  const today = todayKey();

  const [resetOpen, setResetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [reminderStatus, setReminderStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<NativeReminderStatus>).detail;
      if (detail?.message) setReminderStatus(detail.message);
    };
    window.addEventListener('shici-reminder-status', handler);
    return () => window.removeEventListener('shici-reminder-status', handler);
  }, []);

  const handleReminderToggle = async () => {
    if (state.settings.reminderEnabled) {
      dispatch({ type: 'setReminder', enabled: false });
      setReminderStatus('每日提醒已关闭');
      return;
    }
    if (isNativeApp()) {
      dispatch({ type: 'setReminder', enabled: true });
      setReminderStatus('已开启，由 macOS 系统通知提醒');
      return;
    }
    if (!notificationSupported()) {
      setReminderStatus('当前环境不支持系统通知');
      return;
    }
    const permission = await ensureWebNotificationPermission();
    if (permission !== 'granted') {
      setReminderStatus('通知权限未开启，请在浏览器设置中允许通知');
      return;
    }
    dispatch({ type: 'setReminder', enabled: true });
    setReminderStatus('已开启；浏览器版仅在拾词打开时提醒');
  };

  const daily = getDaily(state, today);
  const totals = getTotals(state, today);
  const streak = computeStreak(state.daily, today);
  const accuracy = accuracyPercent(daily.correct, daily.wrong);
  const goalOptions = Array.from(
    new Set<number>([...DAILY_GOAL_OPTIONS, state.settings.dailyGoal]),
  ).sort((a, b) => a - b);

  const handleReset = () => {
    dispatch({ type: 'resetProgress' });
    setResetOpen(false);
    setToast('学习进度已重置');
  };

  return (
    <div className="page profile-page">
      <header className="page-header">
        <p className="eyebrow">PROFILE</p>
        <h1 className="page-title">我的</h1>
        <p className="page-subtitle">未登录时数据只保存在本机，登录账号后会同步到云端。</p>
      </header>

      <section className="profile-card">
        <div className="profile-mark">
          <span>拾</span>
        </div>
        <div className="profile-copy">
          <h2>拾词</h2>
          <p className="muted small">每天一点，记得更牢。</p>
        </div>
        <div className="streak-chip">
          <Icon name="flame" size={17} />
          <span>{streak} 天</span>
        </div>
      </section>

      <AccountPanel />

      <section className="panel">
        <div className="section-heading">
          <h2>学习概览</h2>
          <span className="muted small">截至今天</span>
        </div>
        <div className="stat-grid">
          <StatTile label="已学单词" value={totals.learned} />
          <StatTile label="已掌握" value={totals.mastered} hint="复习间隔达 60 天" />
          <StatTile label="待复习" value={totals.due} />
          <StatTile
            label="今日正确率"
            value={accuracy === null ? '—' : `${accuracy}%`}
            hint={`新学 ${daily.newCount} · 复习 ${daily.reviewCount}`}
          />
        </div>
        <Link to="/favorites" className="profile-link-row">
          <span className="profile-link-label">
            <Icon name="bookmark" size={17} />
            我的收藏
          </span>
          <span className="profile-link-value">
            {Object.keys(state.favorites).length} 个
            <Icon name="chevron-right" size={16} />
          </span>
        </Link>
        <Link to="/stats" className="profile-link-row">
          <span className="profile-link-label">
            <Icon name="chart" size={17} />
            学习统计
          </span>
          <span className="profile-link-value">
            查看
            <Icon name="chevron-right" size={16} />
          </span>
        </Link>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>每日新词目标</h2>
          <span className="muted small">{state.settings.dailyGoal} 个 / 天</span>
        </div>
        <p className="muted small panel-description">
          每天学习的新词数量。复习不计入这个目标，坚持比速度更重要。
        </p>
        <div className="goal-options">
          {goalOptions.map((goal) => (
            <button
              key={goal}
              type="button"
              className={goal === state.settings.dailyGoal ? 'is-active' : ''}
              onClick={() => dispatch({ type: 'setDailyGoal', goal })}
            >
              {goal}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>每日提醒</h2>
          <span className="muted small">
            {state.settings.reminderEnabled ? state.settings.reminderTime : '未开启'}
          </span>
        </div>
        <p className="muted small panel-description">
          {isNativeApp()
            ? '到点由 macOS 发送系统通知，App 关闭时也能提醒。'
            : '浏览器版仅在拾词打开时提醒；桌面 App 支持后台系统通知。'}
        </p>
        <div className="reminder-row">
          <button
            type="button"
            role="switch"
            aria-checked={state.settings.reminderEnabled}
            aria-label="每日提醒"
            className={`switch${state.settings.reminderEnabled ? ' is-on' : ''}`}
            onClick={() => void handleReminderToggle()}
          >
            <span className="switch-knob" />
          </button>
          <input
            type="time"
            value={state.settings.reminderTime}
            aria-label="提醒时间"
            onChange={(event) =>
              dispatch({ type: 'setReminder', time: event.target.value })
            }
          />
          <span className="muted small">
            {state.settings.reminderEnabled ? '开启' : '关闭'}
          </span>
        </div>
        {reminderStatus ? (
          <p className="muted tiny reminder-status">{reminderStatus}</p>
        ) : null}
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>数据</h2>
        </div>
        <p className="muted small panel-description">
          学习进度默认保存在本机；登录账号后会同步到云端，换设备时登录同一账号即可恢复。清理浏览器/应用数据或使用无痕模式可能丢失尚未同步的进度。
        </p>
        <button
          type="button"
          className="danger-outline-button"
          onClick={() => setResetOpen(true)}
        >
          <Icon name="trash" size={18} />
          重置学习进度
        </button>
      </section>

      <section className="panel about-panel">
        <div className="section-heading">
          <h2>关于</h2>
          <span className="muted small">v1.4.0</span>
        </div>
        <p className="muted small">
          词库数据来自{' '}
          <a
            href="https://github.com/RealKai42/qwerty-learner"
            target="_blank"
            rel="noreferrer"
          >
            qwerty-learner
          </a>
          （GPL-3.0），仅供个人学习使用。在线词典由有道词典和 Free Dictionary API 提供。
        </p>
        <p className="muted tiny">
          词库数据版本：{metaState.data?.version ?? '加载中…'}
        </p>
        <button
          type="button"
          className="ghost-button compact reload-button"
          onClick={() => window.location.reload()}
        >
          <Icon name="refresh" size={16} />
          重新加载应用
        </button>
      </section>

      {toast ? <div className="toast">{toast}</div> : null}

      <ConfirmDialog
        open={resetOpen}
        title="重置全部学习进度？"
        description="已学单词、复习计划和统计都会被清空，收藏的单词会保留。此操作无法恢复。"
        confirmLabel="确认重置"
        cancelLabel="取消"
        danger
        onConfirm={handleReset}
        onCancel={() => setResetOpen(false)}
      />
    </div>
  );
}
