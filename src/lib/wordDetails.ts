import { DEPLOYED_ORIGIN } from '../config/appConfig';

export interface WordPhrase {
  phrase: string;
  translation: string;
}

export interface WordExample {
  en: string;
  zh: string;
}

export interface WordSynonymGroup {
  pos: string;
  words: string[];
  translation: string;
}

export interface WordForm {
  name: string;
  value: string;
}

export interface WordDerivativeGroup {
  pos: string;
  words: { word: string; translation: string }[];
}

export interface EnglishDefinition {
  definition: string;
  example: string;
}

export interface EnglishDefinitionGroup {
  pos: string;
  definitions: EnglishDefinition[];
}

export interface WordDetails {
  word: string;
  /** Detailed Chinese definitions, one string per part-of-speech group. */
  definitions: string[];
  phrases: WordPhrase[];
  examples: WordExample[];
  synonyms: WordSynonymGroup[];
  wordForms: WordForm[];
  derivatives: WordDerivativeGroup[];
  mnemonic: string;
  englishDefinitions: EnglishDefinitionGroup[];
}

const ENDPOINT = `${DEPLOYED_ORIGIN}/.netlify/functions/word-details`;
const cache = new Map<string, Promise<WordDetails>>();

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(readString).filter(Boolean) : [];
}

function readObjects<T>(
  value: unknown,
  map: (item: Record<string, unknown>) => T | null,
): T[] {
  if (!Array.isArray(value)) return [];
  const result: T[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue;
    const mapped = map(item as Record<string, unknown>);
    if (mapped !== null) result.push(mapped);
  }
  return result;
}

function normalize(data: unknown): WordDetails {
  if (typeof data !== 'object' || data === null) {
    throw new Error('词典数据格式错误');
  }
  const value = data as Record<string, unknown>;

  const phrases = readObjects<WordPhrase>(value.phrases, (item) => {
    const phrase = readString(item.phrase);
    return phrase ? { phrase, translation: readString(item.translation) } : null;
  });

  const examples = readObjects<WordExample>(value.examples, (item) => {
    const en = readString(item.en);
    return en ? { en, zh: readString(item.zh) } : null;
  });

  const synonyms = readObjects<WordSynonymGroup>(value.synonyms, (item) => {
    const words = readStrings(item.words);
    return words.length > 0
      ? { pos: readString(item.pos), words, translation: readString(item.translation) }
      : null;
  });

  const wordForms = readObjects<WordForm>(value.wordForms, (item) => {
    const name = readString(item.name);
    const form = readString(item.value);
    return name && form ? { name, value: form } : null;
  });

  const derivatives = readObjects<WordDerivativeGroup>(value.derivatives, (item) => {
    const words = readObjects<{ word: string; translation: string }>(item.words, (word) => {
      const text = readString(word.word);
      return text ? { word: text, translation: readString(word.translation) } : null;
    });
    return words.length > 0 ? { pos: readString(item.pos), words } : null;
  });

  const englishDefinitions = readObjects<EnglishDefinitionGroup>(
    value.englishDefinitions,
    (item) => {
      const definitions = readObjects<EnglishDefinition>(item.definitions, (definition) => {
        const text = readString(definition.definition);
        return text ? { definition: text, example: readString(definition.example) } : null;
      });
      return definitions.length > 0 ? { pos: readString(item.pos), definitions } : null;
    },
  );

  return {
    word: readString(value.word),
    definitions: readStrings(value.definitions),
    phrases,
    examples,
    synonyms,
    wordForms,
    derivatives,
    mnemonic: readString(value.mnemonic),
    englishDefinitions,
  };
}

/** Fetch rich notes for a word (cached in memory). */
export function lookupWordDetails(word: string): Promise<WordDetails> {
  const key = word.trim().toLowerCase();
  if (!key) return Promise.reject(new Error('缺少单词'));

  const cached = cache.get(key);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12000);

  // `v=2` busts the CDN cache from the version that only returned phrases and
  // examples; the function itself ignores unknown query parameters.
  const promise = fetch(`${ENDPOINT}?word=${encodeURIComponent(key)}&v=2`, {
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
