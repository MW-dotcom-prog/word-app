import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  formatDateLabel,
  isValidDateKey,
  toDateKey,
} from '../src/lib/date';

describe('date helpers', () => {
  it('formats local dates without UTC shifting', () => {
    expect(toDateKey(new Date(2026, 9, 18, 23, 30))).toBe('2026-10-18');
    expect(toDateKey(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('adds negative and positive intervals from stage schedules', () => {
    expect(addDays('2026-10-18', 3)).toBe('2026-10-21');
    expect(addDays('2026-10-18', 60)).toBe('2026-12-17');
  });

  it('validates date keys', () => {
    expect(isValidDateKey('2026-10-18')).toBe(true);
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidDateKey('2026-13-01')).toBe(false);
    expect(isValidDateKey('')).toBe(false);
  });

  it('computes whole-day differences', () => {
    expect(daysBetween('2026-10-18', '2026-10-19')).toBe(1);
    expect(daysBetween('2026-10-18', '2026-10-18')).toBe(0);
    expect(daysBetween('2026-10-19', '2026-10-18')).toBe(-1);
  });

  it('formats a Chinese date label', () => {
    expect(formatDateLabel('2026-10-18')).toBe('10月18日 周日');
    expect(formatDateLabel('2026-01-01')).toBe('1月1日 周四');
  });
});
