export interface NativeReminderStatus {
  granted: boolean;
  enabled: boolean;
  message: string;
}

interface NativeMessageHandler {
  postMessage(message: unknown): void;
}

function nativeMessageHandler(): NativeMessageHandler | null {
  if (typeof window === 'undefined') return null;
  const webkit = (
    window as unknown as {
      webkit?: { messageHandlers?: { shici?: NativeMessageHandler } };
    }
  ).webkit;
  return webkit?.messageHandlers?.shici ?? null;
}

export function isNativeApp(): boolean {
  return nativeMessageHandler() !== null;
}

export function syncReminderToNative(enabled: boolean, time: string): boolean {
  const handler = nativeMessageHandler();
  if (!handler) return false;
  try {
    handler.postMessage({ type: 'reminder', enabled, time });
    return true;
  } catch {
    return false;
  }
}

export function notificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function ensureWebNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationSupported()) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
}

export function showWebReminder(): void {
  if (!notificationSupported() || Notification.permission !== 'granted') return;
  try {
    new Notification('拾词 · 该背单词啦', {
      body: '今天的单词还在等你，花几分钟巩固一下记忆吧。',
      tag: 'shici-daily-reminder',
    });
  } catch {
    // Some browsers disallow constructing notifications from a page; ignore.
  }
}

export function currentHHmm(now: Date = new Date()): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function reminderFiredKey(dateKey: string): string {
  return `shici-reminder-fired-${dateKey}`;
}
