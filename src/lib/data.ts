import type { DataMeta, DictEntry, WordListMeta } from '../types';

const DATA_BASE = `${import.meta.env.BASE_URL}data/`;

const promiseCache = new Map<string, Promise<unknown>>();

function fetchJson<T>(relativePath: string): Promise<T> {
  const cached = promiseCache.get(relativePath) as Promise<T> | undefined;
  if (cached) return cached;

  const promise = fetch(`${DATA_BASE}${relativePath}`, {
    headers: { Accept: 'application/json' },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`词典数据加载失败（HTTP ${response.status}）`);
      }
      return (await response.json()) as T;
    })
    .catch((error: unknown) => {
      // Allow a retry after a transient network failure.
      promiseCache.delete(relativePath);
      throw error;
    });

  promiseCache.set(relativePath, promise);
  return promise;
}

let metaPromise: Promise<DataMeta> | null = null;
let dictionaryPromise: Promise<DictEntry[]> | null = null;
const listPromises = new Map<string, Promise<string[]>>();

export function loadMeta(): Promise<DataMeta> {
  metaPromise ??= fetchJson<DataMeta>('meta.json').catch((error) => {
    metaPromise = null;
    throw error;
  });
  return metaPromise;
}

export function loadDictionary(): Promise<DictEntry[]> {
  dictionaryPromise ??= fetchJson<DictEntry[]>('dictionary.json').catch((error) => {
    dictionaryPromise = null;
    throw error;
  });
  return dictionaryPromise;
}

export function loadListKeys(listId: string): Promise<string[]> {
  const existing = listPromises.get(listId);
  if (existing) return existing;
  const promise = fetchJson<string[]>(`lists/${listId}.json`).catch((error) => {
    listPromises.delete(listId);
    throw error;
  });
  listPromises.set(listId, promise);
  return promise;
}

export function indexDictionary(dictionary: DictEntry[]): Map<string, DictEntry> {
  const index = new Map<string, DictEntry>();
  for (const entry of dictionary) {
    index.set(entry.w.toLowerCase(), entry);
  }
  return index;
}

export function findActiveList(
  meta: DataMeta | null,
  activeListId: string,
): WordListMeta | null {
  if (!meta) return null;
  return meta.lists.find((list) => list.id === activeListId) ?? meta.lists[0] ?? null;
}

export function listName(meta: DataMeta | null, listId: string): string {
  return meta?.lists.find((list) => list.id === listId)?.short ?? listId;
}
