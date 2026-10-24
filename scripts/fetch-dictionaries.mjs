#!/usr/bin/env node
/**
 * Download the five exam word lists from qwerty-learner and turn them into
 * compact app data:
 *
 *   public/data/dictionary.json  unique entries (word / phonetics / Chinese meanings / source lists)
 *   public/data/lists/<id>.json  ordered lowercase word keys for each word list
 *   public/data/meta.json        list metadata + dataset version
 *
 * The source project is GPL-3.0. This app is for personal use; see README.
 * GitHub's raw.githubusercontent.com can be blocked, so the Contents API with
 * the raw media type is used. Downloads are cached in scripts/.cache.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE_DIR = path.join(ROOT, 'scripts', '.cache');
const OUT_DIR = path.join(ROOT, 'public', 'data');
const LISTS_DIR = path.join(OUT_DIR, 'lists');

const REPO = 'RealKai42/qwerty-learner';
const BRANCH = 'master';
const REMOTE_DIR = 'public/dicts';

/** @typedef {{id:string,name:string,short:string,description:string,file:string,rawCount:number}} Source */
/** @type {Source[]} */
const SOURCES = [
  { id: 'gaokao', name: '高考英语', short: '高考', description: '高考核心词汇', file: 'GaoKao_3500.json', rawCount: 3893 },
  { id: 'ielts', name: '雅思词汇', short: '雅思', description: '雅思考试高频词汇', file: 'IELTS_3_T.json', rawCount: 3575 },
  { id: 'toefl', name: '托福词汇', short: '托福', description: '托福考试核心词汇', file: 'TOEFL_3_T.json', rawCount: 4264 },
  { id: 'cet4', name: '四级词汇', short: '四级', description: '大学英语四级词汇', file: 'CET4_T.json', rawCount: 2607 },
  { id: 'cet6', name: '六级词汇', short: '六级', description: '大学英语六级词汇', file: 'CET6_T.json', rawCount: 2345 },
];

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

function normalizeWord(value) {
  return clean(value).replace(/\s+/g, ' ');
}

async function download(source) {
  await mkdir(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, source.file);
  try {
    return JSON.parse(await readFile(cachePath, 'utf8'));
  } catch {
    // not cached yet
  }

  const url =
    `https://api.github.com/repos/${REPO}/contents/${REMOTE_DIR}/${encodeURIComponent(source.file)}` +
    `?ref=${BRANCH}`;
  console.log(`↓ ${source.id}: ${source.file}`);
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github.raw',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'shici-vocab-app-data-fetcher',
    },
  });
  if (!response.ok) {
    throw new Error(`${source.id}: GitHub returned ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${source.id}: response is not JSON (got: ${text.slice(0, 120)})`);
  }
  await writeFile(cachePath, JSON.stringify(data), 'utf8');
  return data;
}

async function main() {
  await mkdir(LISTS_DIR, { recursive: true });

  /** @type {Map<string, {w:string,us?:string,uk?:string,t:string[],lists:string[]}>} */
  const dictionaryByKey = new Map();
  /** @type {{id:string,name:string,short:string,description:string,file:string,count:number,rawCount:number}[]} */
  const listsMeta = [];
  let rawTotal = 0;

  for (const source of SOURCES) {
    const rows = await download(source);
    if (!Array.isArray(rows)) throw new Error(`${source.id}: expected a JSON array`);

    if (rows.length !== source.rawCount) {
      console.warn(
        `⚠ ${source.id}: expected ${source.rawCount} raw entries, got ${rows.length}. ` +
          'Upstream may have changed; continuing with actual data.',
      );
    }
    rawTotal += rows.length;

    const keys = [];
    const seenInList = new Set();
    let invalid = 0;

    for (const row of rows) {
      const word = normalizeWord(row?.name);
      const rawTranslations = (Array.isArray(row?.trans) ? row.trans : [])
        .map(clean)
        .filter(Boolean);

      // Some sources repeat the same line with an added phonetic or slightly
      // different spacing. Keep the first clean copy.
      const seenTranslations = new Set();
      const translations = [];
      for (const line of rawTranslations) {
        const normalized = line.replace(/\s+/g, '').replace(/\[[^\]]*\]/g, '');
        if (!normalized || seenTranslations.has(normalized)) continue;
        seenTranslations.add(normalized);
        translations.push(line);
      }

      if (!word || translations.length === 0) {
        invalid += 1;
        continue;
      }

      const key = word.toLowerCase();
      if (!seenInList.has(key)) {
        seenInList.add(key);
        keys.push(key);
      }

      const existing = dictionaryByKey.get(key);
      if (existing) {
        // Concatenating every list's wording produced many near-duplicate
        // Chinese glosses. Instead keep the single-source translation set with
        // the most characters (usually the richest one, e.g. cet6 adds senses
        // that gaokao omits). Ties keep the earlier, simpler list.
        const existingScore = existing.t.join('').length;
        const candidateScore = translations.join('').length;
        if (candidateScore > existingScore) existing.t = translations;

        if (!existing.us) existing.us = clean(row?.usphone) || undefined;
        if (!existing.uk) existing.uk = clean(row?.ukphone) || undefined;
        if (!existing.lists.includes(source.id)) existing.lists.push(source.id);
      } else {
        dictionaryByKey.set(key, {
          w: word,
          us: clean(row?.usphone) || undefined,
          uk: clean(row?.ukphone) || undefined,
          t: [...new Set(translations)],
          lists: [source.id],
        });
      }
    }

    if (invalid > 0) console.warn(`⚠ ${source.id}: skipped ${invalid} malformed entries`);
    if (keys.length !== rows.length) {
      console.log(`  ${source.id}: deduped ${rows.length - keys.length} repeated word(s) within the list`);
    }

    await writeFile(
      path.join(LISTS_DIR, `${source.id}.json`),
      JSON.stringify(keys),
      'utf8',
    );

    listsMeta.push({
      id: source.id,
      name: source.name,
      short: source.short,
      description: source.description,
      file: `lists/${source.id}.json`,
      count: keys.length,
      rawCount: rows.length,
    });
  }

  const dictionary = [...dictionaryByKey.values()];
  const dictionaryJson = JSON.stringify(dictionary);
  await writeFile(path.join(OUT_DIR, 'dictionary.json'), dictionaryJson, 'utf8');

  const hash = createHash('sha256').update(dictionaryJson).digest('hex').slice(0, 12);
  const version = `${new Date().toISOString().slice(0, 10)}-${hash}`;
  const meta = {
    version,
    generatedAt: new Date().toISOString(),
    source: {
      repo: REPO,
      url: `https://github.com/${REPO}`,
      license: 'GPL-3.0',
      note: '词库数据来自 qwerty-learner，仅用于个人学习；公开分发前请重新评估授权。',
    },
    totalRawEntries: rawTotal,
    uniqueWords: dictionary.length,
    lists: listsMeta,
  };
  await writeFile(path.join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');

  const sizeMb = (dictionaryJson.length / 1024 / 1024).toFixed(2);
  console.log('');
  console.log(`✓ dictionary: ${dictionary.length} unique words (${sizeMb} MB)`);
  for (const list of listsMeta) {
    console.log(`  ${list.short.padEnd(3)} ${String(list.count).padStart(4)} words  → lists/${list.id}.json`);
  }
  console.log(`✓ meta version: ${version}`);
}

main().catch((error) => {
  console.error('\n✗ Failed to build dictionary data:', error.message);
  process.exitCode = 1;
});
