import { useEffect, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export function ProgressBar({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label?: string;
}) {
  const safeMax = Math.max(0, max);
  const percent = safeMax > 0 ? Math.min(100, Math.max(0, (value / safeMax) * 100)) : 0;
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={Math.min(value, safeMax)}
    >
      <div className="progress-fill" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="stat-tile">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {hint ? <span className="stat-hint">{hint}</span> : null}
    </div>
  );
}

export function LoadingState({ label = '正在加载…' }: { label?: string }) {
  return (
    <div className="state-panel" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state-panel">
      <div className="state-icon state-icon-error">
        <Icon name="refresh" size={26} />
      </div>
      <h2>加载失败</h2>
      <p className="muted">{message}</p>
      {onRetry ? (
        <button type="button" className="primary-button compact" onClick={onRetry}>
          重新加载
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon = 'book',
  title,
  description,
  children,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="state-panel">
      <div className="state-icon">
        <Icon name={icon} size={28} />
      </div>
      <h2>{title}</h2>
      {description ? <p className="muted">{description}</p> : null}
      {children ? <div className="state-actions">{children}</div> : null}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '确定',
  cancelLabel = '取消',
  danger = false,
  onConfirm,
  onCancel,
  onDismiss,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Backdrop click / Escape. Defaults to onCancel. */
  onDismiss?: () => void;
}) {
  const dismiss = onDismiss ?? onCancel;
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation" onClick={dismiss}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{title}</h2>
        {description ? <p className="muted">{description}</p> : null}
        <div className="dialog-actions">
          <button type="button" className="ghost-button" onClick={onCancel} autoFocus>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'danger-button' : 'primary-button'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
