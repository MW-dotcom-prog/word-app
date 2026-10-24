const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const;

const pad = (value: number) => String(value).padStart(2, '0');

/** Local-time date key, e.g. 2026-10-18 (never use toISOString here: it is UTC). */
export function toDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey(now: Date = new Date()): string {
  return toDateKey(now);
}

export function parseDateKey(key: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return new Date(NaN);
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

export function isValidDateKey(key: string): boolean {
  const date = parseDateKey(key);
  return !Number.isNaN(date.getTime()) && toDateKey(date) === key;
}

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function isDue(nextReview: string, today: string = todayKey()): boolean {
  return nextReview <= today;
}

/** e.g. 10月18日 周日 */
export function formatDateLabel(key: string): string {
  const date = parseDateKey(key);
  if (Number.isNaN(date.getTime())) return key;
  return `${date.getMonth() + 1}月${date.getDate()}日 周${WEEKDAYS[date.getDay()]}`;
}

/** Whole-day difference (b - a), using local midnights. */
export function daysBetween(a: string, b: string): number {
  const start = parseDateKey(a);
  const end = parseDateKey(b);
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}
