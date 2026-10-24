import { describe, expect, it } from 'vitest';
import { INTERVALS, MAX_STAGE, applyReview, initialProgress } from '../src/lib/srs';

const TODAY = '2026-10-18';
const TOMORROW = '2026-10-19';

describe('initial learning', () => {
  it('schedules every new word for the next day', () => {
    for (const rating of ['know', 'fuzzy', 'unknown'] as const) {
      const progress = initialProgress(rating, TODAY);
      expect(progress.nextReview).toBe(TOMORROW);
      expect(progress.firstLearned).toBe(TODAY);
      expect(progress.lastReview).toBeNull();
      expect(progress.seen).toBe(1);
    }
  });

  it('maps the first rating to a stage and counters', () => {
    expect(initialProgress('know', TODAY).stage).toBe(1);
    expect(initialProgress('fuzzy', TODAY).stage).toBe(0);
    expect(initialProgress('unknown', TODAY).stage).toBe(0);

    expect(initialProgress('know', TODAY).correct).toBe(1);
    expect(initialProgress('fuzzy', TODAY).correct).toBe(0);
    expect(initialProgress('fuzzy', TODAY).wrong).toBe(0);
    expect(initialProgress('unknown', TODAY).wrong).toBe(1);
  });
});

describe('review scheduling', () => {
  it('uses the Ebbinghaus interval table', () => {
    expect(INTERVALS).toEqual([1, 1, 2, 4, 7, 15, 30, 60]);
  });

  it('promotes remembered words along the interval table', () => {
    const stage0 = { ...initialProgress('unknown', TODAY), stage: 0 };
    const stage1 = applyReview(stage0, 'remember', TOMORROW);
    expect(stage1.stage).toBe(1);
    expect(stage1.nextReview).toBe('2026-10-20');

    const stage2 = applyReview(stage1, 'remember', '2026-10-20');
    expect(stage2.stage).toBe(2);
    expect(stage2.nextReview).toBe('2026-10-22'); // +2 days
  });

  it('caps the stage and uses the final interval', () => {
    const mastered = {
      ...initialProgress('know', TODAY),
      stage: MAX_STAGE,
    };
    const next = applyReview(mastered, 'remember', TODAY);
    expect(next.stage).toBe(MAX_STAGE);
    expect(next.nextReview).toBe('2026-12-17'); // +60 days
    expect(INTERVALS[MAX_STAGE]).toBe(60);
  });

  it('demotes fuzzy reviews and retries tomorrow', () => {
    const progress = { ...initialProgress('know', TODAY), stage: 3 };
    const next = applyReview(progress, 'fuzzy', TODAY);
    expect(next.stage).toBe(2);
    expect(next.nextReview).toBe(TOMORROW);
  });

  it('never demotes below stage 0', () => {
    const progress = { ...initialProgress('fuzzy', TODAY), stage: 0 };
    const next = applyReview(progress, 'fuzzy', TODAY);
    expect(next.stage).toBe(0);
    expect(next.nextReview).toBe(TOMORROW);
  });

  it('resets forgotten words to stage 0', () => {
    const progress = { ...initialProgress('know', TODAY), stage: 5, wrong: 0 };
    const next = applyReview(progress, 'forgot', TODAY);
    expect(next.stage).toBe(0);
    expect(next.nextReview).toBe(TOMORROW);
    expect(next.wrong).toBe(1);
    expect(next.correct).toBe(1);
    expect(next.lastReview).toBe(TODAY);
  });

  it('increments the seen counter on every review', () => {
    const progress = { ...initialProgress('know', TODAY), seen: 4 };
    expect(applyReview(progress, 'remember', TODAY).seen).toBe(5);
  });
});
