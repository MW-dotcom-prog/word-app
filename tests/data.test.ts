import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DataMeta, DictEntry } from '../src/types';

const DATA_DIR = path.resolve(process.cwd(), 'public/data');

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(DATA_DIR, relativePath), 'utf8')) as T;
}

describe('generated dictionary data', () => {
  it('has the expected list metadata', async () => {
    const meta = await readJson<DataMeta>('meta.json');
    expect(meta.source.license).toBe('GPL-3.0');
    expect(meta.totalRawEntries).toBe(16684);
    expect(meta.uniqueWords).toBe(8983);
    expect(meta.lists.map((list) => list.id)).toEqual([
      'gaokao',
      'ielts',
      'toefl',
      'cet4',
      'cet6',
    ]);
    expect(meta.lists.map((list) => list.count)).toEqual([
      3875, 3575, 4264, 2607, 2345,
    ]);
  });

  it('contains unique, well-formed entries', async () => {
    const meta = await readJson<DataMeta>('meta.json');
    const dictionary = await readJson<DictEntry[]>('dictionary.json');
    expect(dictionary).toHaveLength(meta.uniqueWords);

    const seen = new Set<string>();
    for (const entry of dictionary) {
      expect(entry.w.length).toBeGreaterThan(0);
      expect(Array.isArray(entry.t)).toBe(true);
      expect(entry.t.length).toBeGreaterThan(0);
      expect(entry.t.every((line) => line.trim().length > 0)).toBe(true);
      const normalizedLines = entry.t.map((line) =>
        line.replace(/\s+/g, '').replace(/\[[^\]]*\]/g, ''),
      );
      expect(new Set(normalizedLines).size).toBe(normalizedLines.length);
      const key = entry.w.toLowerCase();
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('keeps list files in sync with the dictionary', async () => {
    const meta = await readJson<DataMeta>('meta.json');
    const dictionary = await readJson<DictEntry[]>('dictionary.json');
    const words = new Set(dictionary.map((entry) => entry.w.toLowerCase()));

    for (const list of meta.lists) {
      const keys = await readJson<string[]>(list.file.replace(/^data\//, ''));
      expect(keys).toHaveLength(list.count);
      expect(new Set(keys).size).toBe(keys.length);
      for (const key of keys) {
        expect(words.has(key)).toBe(true);
      }
      // Every word records the list it came from.
      for (const key of keys.slice(0, 50)) {
        const entry = dictionary.find((item) => item.w.toLowerCase() === key);
        expect(entry?.lists).toContain(list.id);
      }
    }
  });
});
