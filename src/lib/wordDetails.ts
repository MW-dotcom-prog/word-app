import { DEPLOYED_ORIGIN } from '../config/appConfig';

export interface WordPhrase {
  phrase: string;
  translation: string;
}

export interface WordExample {
  en: string;
  zh: string;
}

export interface WordDetails {
  word: string;
  phrases: WordPhrase[];
  examples: WordExample[];
}

const ENDPOINT = `${DEPLOYED_ORIGIN}/.netlify/functions/word-details`;
const cache = new Map<string, Promise<WordDetails>>();

function normalize(data: unknown): WordDetails {
  if (typeof data !== 'object' || data === null) {
    throw new Error('词典数据格式错误');
  }
  const value = data as Record<string, unknown>;
  const phrases = Array.isArray(value.phrases)
    ? value.phrases
        .filter(
          (item): item is WordPhrase =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as WordPhrase).phrase === 'string',
        )
        .map((item) => ({
          phrase: item.phrase,
          translation: typeof item.translation === 'string' ? item.translation : '',
        }))
    : [];
  const examples = Array.isArray(value.examples)
    ? value.examples
        .filter(
          (item): item is WordExample =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as WordExample).en === 'string',
        )
        .map((item) => ({
          en: item.en,
          zh: typeof item.zh === 'string' ? item.zh : '',
        }))
    : [];
  return {
    word: typeof value.word === 'string' ? value.word : '',
    phrases,
    examples,
  };
}

/** Fetch phrases and bilingual examples for a word (cached in memory). */
export function lookupWordDetails(word: string): Promise<WordDetails> {
  const key = word.trim().toLowerCase();
  if (!key) return Promise.reject(new Error('缺少单词'));

  const cached = cache.get(key);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12000);

  const promise = fetch(`${ENDPOINT}?word=${encodeURIComponent(key)}`, {
    signal: controller.signal,
    headers: { Accept: 'application/json' },
  })
    .then(async (response) => {
      if (!response.ok) throw new Error('词典服务暂时不可用');
      return normalize(await response.json());
    })
    .catch((error: unknown) => {
      cache.delete(key);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('词典服务加载超时');
      }
      if (error instanceof TypeError) {
        throw new Error('网络不可用，请检查连接后重试');
      }
      throw error instanceof Error ? error : new Error('词典数据加载失败');
    })
    .finally(() => window.clearTimeout(timer));

  cache.set(key, promise);
  return promise;
}
