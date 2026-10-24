import { useState, type FormEvent } from 'react';
import { useAccount, type SyncStatus } from '../state/AccountContext';

type Mode = 'signin' | 'signup';

const STATUS_LABELS: Record<SyncStatus, string> = {
  local: '本地模式',
  syncing: '同步中…',
  synced: '已同步',
  error: '同步异常',
};

function formatSyncTime(value: string | null): string {
  if (!value) return '尚未同步';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '尚未同步';
  return `上次同步 ${date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function AccountPanel() {
  const account = useAccount();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError(null);
    setInfo(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        const result = await account.signIn(email, password);
        if (result.error) setError(result.error);
      } else {
        const result = await account.signUp(email, password);
        if (result.error) setError(result.error);
        else if (result.needsConfirmation) {
          setInfo('注册成功。请查收邮箱并点击确认链接，然后回来登录。');
        }
      }
    } finally {
      setBusy(false);
    }
  };

  if (!account.configured) {
    return (
      <section className="panel account-panel">
        <div className="section-heading">
          <h2>账号与同步</h2>
          <span className="muted small">未配置</span>
        </div>
        <p className="muted small panel-description">
          云同步尚未配置。需要在项目中填写 Supabase 的 Project URL 和 anon key 后重新构建；未配置时，学习和收藏仍会保存在本机。
        </p>
      </section>
    );
  }

  if (account.user) {
    return (
      <section className="panel account-panel">
        <div className="section-heading">
          <h2>账号与同步</h2>
          <span className={`sync-pill sync-${account.status}`}>
            {STATUS_LABELS[account.status]}
          </span>
        </div>
        <p className="account-email">{account.email}</p>
        <p className="muted small panel-description">
          {account.message ?? formatSyncTime(account.lastSyncedAt)}
        </p>
        {account.conflict ? (
          <p className="form-error">存在云端数据冲突，请在上方弹窗中选择保留哪一份。</p>
        ) : null}
        <div className="account-actions">
          <button
            type="button"
            className="ghost-button compact"
            onClick={() => void account.syncNow()}
            disabled={account.status === 'syncing' || Boolean(account.conflict)}
          >
            {account.status === 'syncing' ? '同步中…' : '立即同步'}
          </button>
          <button
            type="button"
            className="ghost-button compact"
            onClick={() => void account.signOut()}
          >
            退出登录
          </button>
        </div>
        <p className="muted tiny account-footnote">
          登录后，学习进度、收藏、设置和提醒会随账号同步到其他设备。
        </p>
      </section>
    );
  }

  return (
    <section className="panel account-panel">
      <div className="section-heading">
        <h2>账号与同步</h2>
        <span className="muted small">Supabase</span>
      </div>
      <div className="account-tabs" role="tablist" aria-label="账号方式">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signin'}
          className={mode === 'signin' ? 'is-active' : ''}
          onClick={() => switchMode('signin')}
        >
          登录
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          className={mode === 'signup' ? 'is-active' : ''}
          onClick={() => switchMode('signup')}
        >
          注册
        </button>
      </div>

      <form className="account-form" onSubmit={(event) => void handleSubmit(event)}>
        <label className="field">
          <span>邮箱</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </label>
        <label className="field">
          <span>密码</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            minLength={mode === 'signup' ? 6 : undefined}
            placeholder={mode === 'signup' ? '至少 6 位' : '输入密码'}
            required
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        {info ? <p className="form-info">{info}</p> : null}
        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? '处理中…' : mode === 'signin' ? '登录并同步' : '创建账号'}
        </button>
      </form>

      <p className="muted tiny account-footnote">
        不登录也可以继续使用本地模式。若开启了邮箱验证，注册后需要先点击确认邮件中的链接。
      </p>
    </section>
  );
}
