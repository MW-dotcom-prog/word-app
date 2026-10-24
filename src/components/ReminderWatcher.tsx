import { useEffect } from 'react';
import { todayKey } from '../lib/date';
import {
  currentHHmm,
  isNativeApp,
  notificationSupported,
  reminderFiredKey,
  showWebReminder,
  syncReminderToNative,
  type NativeReminderStatus,
} from '../lib/reminder';
import { useAppState } from '../state/AppState';

/**
 * Keeps the native notification schedule in sync and provides a best-effort
 * browser notification while the PWA is open. The macOS wrapper schedules a
 * real repeating notification that also fires when the app is closed.
 */
export function ReminderWatcher() {
  const { state, dispatch } = useAppState();
  const { reminderEnabled, reminderTime } = state.settings;

  useEffect(() => {
    if (!isNativeApp()) return;
    syncReminderToNative(reminderEnabled, reminderTime);
  }, [reminderEnabled, reminderTime]);

  useEffect(() => {
    if (!isNativeApp()) return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<NativeReminderStatus>).detail;
      if (detail && !detail.granted && !detail.enabled && reminderEnabled) {
        dispatch({ type: 'setReminder', enabled: false });
      }
    };
    window.addEventListener('shici-reminder-status', handler);
    return () => window.removeEventListener('shici-reminder-status', handler);
  }, [dispatch, reminderEnabled]);

  useEffect(() => {
    if (isNativeApp() || !reminderEnabled || !notificationSupported()) return;

    const check = () => {
      if (currentHHmm() !== reminderTime) return;
      const key = reminderFiredKey(todayKey());
      try {
        if (localStorage.getItem(key)) return;
        showWebReminder();
        localStorage.setItem(key, '1');
      } catch {
        // Storage may be unavailable; allow the notification anyway.
        showWebReminder();
      }
    };

    check();
    const timer = window.setInterval(check, 20000);
    return () => window.clearInterval(timer);
  }, [reminderEnabled, reminderTime]);

  return null;
}
