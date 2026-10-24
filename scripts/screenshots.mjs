#!/usr/bin/env node
/**
 * End-to-end smoke test + screenshots using the locally installed Chrome.
 * Usage: npm run screenshots
 * Requires the preview server on http://127.0.0.1:4173 (npm run preview).
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
const OUT_DIR = path.resolve(import.meta.dirname, '..', 'screenshots');

function seededState({ dailyGoal = 20, progress = {}, favorites = {}, daily = {} } = {}) {
  return {
    version: 1,
    settings: { activeListId: 'gaokao', dailyGoal, studyOrder: 'sequential' },
    progress,
    daily,
    favorites,
  };
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function dueProgress() {
  return {
    stage: 1,
    nextReview: '2020-01-01',
    firstLearned: '2020-01-01',
    lastReview: null,
    seen: 1,
    correct: 0,
    wrong: 0,
  };
}

async function makePage(browser, state) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'zh-CN',
  });
  if (state) {
    await context.addInitScript((seed) => {
      localStorage.setItem('shici-state-v1', JSON.stringify(seed));
    }, state);
  }
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return { context, page, errors };
}

async function shot(page, name, fullPage = false) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage });
  console.log(`✓ screenshot ${name}.png`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const allErrors = [];

  // --- Learn flow: a 3-word goal makes the session finishes quickly ---
  {
    const { context, page, errors } = await makePage(
      browser,
      seededState({ dailyGoal: 3 }),
    );
    await page.goto(BASE_URL, { waitUntil: 'load' });
    await page.locator('.hero-card').waitFor();
    await shot(page, '01-home', true);

    await page.getByRole('link', { name: /今日新词/ }).click();
    await page.locator('.study-card').waitFor();
    await shot(page, '02-learn-front');

    await page.locator('.study-reveal').click();
    await shot(page, '03-learn-revealed');

    for (let i = 0; i < 3; i += 1) {
      if (i > 0) {
        await page.locator('.study-reveal').click();
      }
      await page.locator('.rating-button').first().click();
      await page.waitForTimeout(350);
    }

    await page.getByText('今日新词完成').waitFor({ timeout: 5000 });
    await shot(page, '04-learn-summary');

    await page.getByRole('link', { name: '回到今日' }).click();
    await page.locator('.hero-card').waitFor();
    await shot(page, '05-home-after-learn', true);

    await page.getByRole('link', { name: '词库' }).click();
    await page.locator('.list-card').first().waitFor();
    await shot(page, '06-lists', true);

    await page.getByRole('link', { name: '词典' }).click();
    const search = page.getByLabel('搜索单词');
    await search.fill('abandon');
    await page.locator('.dict-entry-card').first().waitFor();
    await page.locator('.word-details-group').first().waitFor({ timeout: 20000 }).catch(() => {});
    await shot(page, '07-dictionary-local', true);

    await search.fill('serendipity');
    await page.locator('.online-card').first().waitFor({ timeout: 20000 });
    await page.locator('.word-details-group').first().waitFor({ timeout: 20000 }).catch(() => {});
    await shot(page, '08-dictionary-online', true);

    await page.getByRole('link', { name: '我的' }).click();
    await page.locator('.profile-card').waitFor();
    await shot(page, '09-profile', true);

    await page.goto(`${BASE_URL}#/stats`, { waitUntil: 'load' });
    await page.locator('.chart-card').waitFor();
    await shot(page, '19-stats', true);

    allErrors.push(...errors);
    await context.close();
  }

  // --- Rich statistics chart with 14 days of activity ---
  {
    const daily = {};
    const today = new Date();
    for (let index = 0; index < 14; index += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - (13 - index));
      daily[localDateKey(date)] = {
        newCount: index % 4 === 0 ? 0 : ((index * 3) % 8) + 1,
        reviewCount: index % 5 === 0 ? 0 : ((index * 5) % 11) + 2,
        correct: index * 2,
        wrong: index % 3,
      };
    }
    const richProgress = {
      abandon: {
        stage: 3,
        nextReview: '2026-10-25',
        firstLearned: '2026-10-01',
        lastReview: '2026-10-18',
        seen: 4,
        correct: 3,
        wrong: 1,
      },
      ability: {
        stage: 7,
        nextReview: '2026-12-17',
        firstLearned: '2026-09-01',
        lastReview: '2026-10-18',
        seen: 8,
        correct: 8,
        wrong: 0,
      },
    };
    const { context, page, errors } = await makePage(
      browser,
      seededState({ daily, progress: richProgress }),
    );
    await page.goto(`${BASE_URL}#/stats`, { waitUntil: 'load' });
    await page.locator('.chart-card').waitFor();
    await page.locator('.chart-bar-hit').nth(10).hover();
    const readout = await page.locator('.chart-readout').innerText();
    if (!readout.includes('新学') || !readout.includes('复习')) {
      throw new Error('chart hover readout missing');
    }
    await shot(page, '20-stats-rich', true);

    allErrors.push(...errors);
    await context.close();
  }

  // --- Continue after the daily goal, favorites, and random order ---
  {
    const { context, page, errors } = await makePage(
      browser,
      seededState({ dailyGoal: 3 }),
    );
    await page.goto(`${BASE_URL}#/learn`, { waitUntil: 'load' });
    await page.locator('.study-card').waitFor();

    await page.locator('.favorite-button').click();
    for (let i = 0; i < 3; i += 1) {
      await page.locator('.study-reveal').click();
      await page.locator('.rating-button').first().click();
      await page.waitForTimeout(350);
    }

    await page.getByText('今日新词完成').waitFor({ timeout: 5000 });
    await page.getByRole('button', { name: '继续学习' }).click();
    await page.locator('.study-card').waitFor();
    await page.locator('.extra-session-banner').waitFor({ timeout: 5000 });
    await shot(page, '14-continue-after-goal');

    await page.goto(`${BASE_URL}#/favorites`, { waitUntil: 'load' });
    await page.locator('.favorites-list .dict-entry-card').first().waitFor();
    const favoriteCount = await page.locator('.favorite-button.is-active').count();
    if (favoriteCount === 0) throw new Error('favorited word not found on favorites page');
    await shot(page, '15-favorites', true);

    await page.getByRole('link', { name: '复习收藏' }).click();
    await page.locator('.study-card').waitFor();
    await shot(page, '15b-favorite-review');
    await page.locator('.study-reveal').click();
    await page.locator('.rating-button').first().click();
    await page.getByText('收藏复习完成').waitFor({ timeout: 5000 });
    await shot(page, '15c-favorite-review-summary');

    await page.goto(`${BASE_URL}#/lists`, { waitUntil: 'load' });
    await page.getByRole('button', { name: /乱序/ }).click();
    await page.goto(`${BASE_URL}#/learn`, { waitUntil: 'load' });
    await page.locator('.study-card').waitFor();
    const progressText = await page.locator('.session-progress-meta').first().innerText();
    if (!progressText.includes('乱序')) throw new Error('random order label missing');
    await shot(page, '16-random-order');

    allErrors.push(...errors);
    await context.close();
  }

  // --- Offline PWA check: wait for the service worker, go offline, reload ---
  {
    const { context, page, errors } = await makePage(browser);
    await page.goto(BASE_URL, { waitUntil: 'load' });
    await page.locator('.hero-card').waitFor();

    const swReady = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      await navigator.serviceWorker.ready;
      return true;
    });
    if (!swReady) throw new Error('Service worker did not register');
    console.log('✓ service worker ready');

    const manifest = await page.evaluate(async () => {
      const response = await fetch('./manifest.webmanifest');
      return response.json();
    });
    console.log(`✓ manifest: ${manifest.name} (${manifest.icons.length} icons)`);

    await context.setOffline(true);
    await page.reload({ waitUntil: 'load' });
    await page.locator('.hero-card').waitFor({ timeout: 10000 });
    await shot(page, '12-offline-home', true);

    await page.getByRole('link', { name: /今日新词/ }).click();
    await page.locator('.study-card').waitFor({ timeout: 10000 });
    await shot(page, '13-offline-learn');
    console.log('✓ offline reload + offline study data');

    allErrors.push(...errors);
    await context.close();
  }

  // --- Review flow: seed two overdue words, then review them ---
  {
    const { context, page, errors } = await makePage(
      browser,
      seededState({
        progress: {
          abandon: dueProgress(),
          ability: dueProgress(),
        },
      }),
    );
    await page.goto(`${BASE_URL}#/review`, { waitUntil: 'load' });
    await page.locator('.study-card').waitFor();
    await shot(page, '10-review-front');

    for (let i = 0; i < 2; i += 1) {
      await page.locator('.study-reveal').click();
      await page.locator('.rating-button').first().click();
      await page.waitForTimeout(350);
    }
    await page.getByText('复习完成').waitFor({ timeout: 5000 });
    await shot(page, '11-review-summary');

    allErrors.push(...errors);
    await context.close();
  }

  await browser.close();

  if (allErrors.length > 0) {
    console.error('\nBrowser errors:');
    for (const error of allErrors) console.error(`  - ${error}`);
    process.exitCode = 1;
  } else {
    console.log('\n✓ no browser console/page errors');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
