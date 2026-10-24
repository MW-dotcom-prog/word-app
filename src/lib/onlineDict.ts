/**
 * Online dictionary fallback for words that are not in the bundled word lists.
 *
 * - dictionaryapi.dev has CORS enabled and provides English definitions,
 *   phonetics, examples and audio.
 * - Youdao's suggest endpoint has no CORS header, but supports JSONP. JSONP
 *   executes a remote script, so only the queried word is sent; no app data or
 *   credentials are ever placed in the URL. This is a deliberate trade-off to
 *   offer Chinese explanations without running a backend.
 */

export interface YoudaoEntry {
  entry: string;
  explain: string;
}

export interface DictionaryApiDefinition {
  definition: string;
  example?: string;
}

export interface DictionaryApiMeaning {
  partOfSpeech: string;
  definitions: DictionaryApiDefinition[];
}

export interface DictionaryApiPhonetic {
  text?: string;
  audio?: string;
}

export interface DictionaryApiEntry {
  word: string;
  phonetic?: string;
  phonetics?: DictionaryApiPhonetic[];
  meanings?: DictionaryApiMeaning[];
}

export interface OnlineLookupResult {
  youdao: YoudaoEntry[];
  dictApi: DictionaryApiEntry[];
  errors: string[];
}

const YOUDAO_TIMEOUT_MS = 8000;
let callbackCounter = 0;

function extractYoudaoEntries(payload: unknown): YoudaoEntry[] {
  if (typeof payload !== 'object' || payload === null) return [];
  const data = (payload as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return [];
  const entries = (data as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) return [];
  return entries
    .filter(
      (item): item is YoudaoEntry =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as YoudaoEntry).entry === 'string' &&
        typeof (item as YoudaoEntry).explain === 'string',
    )
    .map((item) => ({ entry: item.entry.trim(), explain: item.explain.trim() }))
    .filter((item) => item.entry && item.explain);
}

export function lookupYoudao(word: string, timeoutMs = YOUDAO_TIMEOUT_MS): Promise<YoudaoEntry[]> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('当前环境不支持在线查询'));
      return;
    }

    const callbackName = `__shici_youdao_${Date.now()}_${callbackCounter++}`;
    const script = document.createElement('script');
    let settled = false;
    let timer: number | undefined;

    const cleanup = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      script.remove();
      try {
        delete (window as unknown as Record<string, unknown>)[callbackName];
      } catch {
        // ignore
      }
    };

    (window as unknown as Record<string, unknown>)[callbackName] = (payload: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(extractYoudaoEntries(payload));
    };

    timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('有道词典查询超时'));
    }, timeoutMs);

    script.async = true;
    script.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('无法连接有道词典'));
    };
    script.src =
      'https://dict.youdao.com/suggest?num=5&doctype=json' +
      `&callback=${encodeURIComponent(callbackName)}&q=${encodeURIComponent(word)}`;
    document.head.appendChild(script);
  });
}

export async function lookupDictionaryApi(
  word: string,
  signal?: AbortSignal,
): Promise<DictionaryApiEntry[]> {
  const response = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
    { signal, headers: { Accept: 'application/json' } },
  );
  if (response.status === 404) return [];
  if (!response.ok) {
    throw new Error(`英文词典查询失败（HTTP ${response.status}）`);
  }
  const data: unknown = await response.json();
  if (!Array.isArray(data)) return [];
  return data.filter(
    (item): item is DictionaryApiEntry =>
      typeof item === 'object' && item !== null && typeof (item as DictionaryApiEntry).word === 'string',
  );
}

export async function lookupOnline(
  word: string,
  signal?: AbortSignal,
): Promise<OnlineLookupResult> {
  const query = word.trim();
  const [youdaoResult, dictApiResult] = await Promise.allSettled([
    lookupYoudao(query),
    lookupDictionaryApi(query, signal),
  ]);

  const errors: string[] = [];
  const youdao = youdaoResult.status === 'fulfilled' ? youdaoResult.value : [];
  if (youdaoResult.status === 'rejected') {
    errors.push(youdaoResult.reason instanceof Error ? youdaoResult.reason.message : '中文释义查询失败');
  }
  const dictApi = dictApiResult.status === 'fulfilled' ? dictApiResult.value : [];
  if (dictApiResult.status === 'rejected') {
    if (signal?.aborted) return { youdao, dictApi, errors: [] };
    errors.push(dictApiResult.reason instanceof Error ? dictApiResult.reason.message : '英文词典查询失败');
  }

  return { youdao, dictApi, errors };
}

const onlineCache = new Map<string, OnlineLookupResult>();

export async function lookupOnlineCached(
  word: string,
  signal?: AbortSignal,
): Promise<OnlineLookupResult> {
  const key = word.trim().toLowerCase();
  const cached = onlineCache.get(key);
  if (cached) return cached;
  const result = await lookupOnline(word, signal);
  if (result.youdao.length > 0 || result.dictApi.length > 0) {
    onlineCache.set(key, result);
  }
  return result;
}

export function bestPhonetic(entry: DictionaryApiEntry): string | null {
  if (entry.phonetic) return entry.phonetic;
  for (const phonetic of entry.phonetics ?? []) {
    if (phonetic.text) return phonetic.text;
  }
  return null;
}

export function bestAudio(entry: DictionaryApiEntry): string | null {
  for (const phonetic of entry.phonetics ?? []) {
    if (phonetic.audio) return phonetic.audio;
  }
  return null;
}
