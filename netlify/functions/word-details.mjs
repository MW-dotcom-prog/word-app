/**
 * Tiny proxy for rich dictionary notes: detailed Chinese definitions, English
 * definitions, phrases, bilingual examples, synonyms, word forms, derivatives
 * and mnemonics.
 *
 * Youdao's jsonapi has no CORS header (and no JSONP), so a browser cannot call
 * it directly. This function runs on Netlify, fetches the data server-side and
 * returns only the small subset the app needs.
 *
 * GET /.netlify/functions/word-details?word=abandon
 */
const YOUDAO_ENDPOINT = 'https://dict.youdao.com/jsonapi';
const CACHE_LIMIT = 500;
const cache = new Map();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
      'Netlify-CDN-Cache-Control': 'public, max-age=86400',
    },
  });
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

/** `l.i` is either a string or an array of strings depending on the word. */
function joinText(value) {
  if (Array.isArray(value)) {
    return cleanText(value.map((item) => cleanText(item)).filter(Boolean).join('；'));
  }
  return cleanText(value);
}

function firstWord(ec) {
  return Array.isArray(ec?.word) ? ec.word[0] : ec?.word;
}

function extractDefinitions(data) {
  const groups = firstWord(data?.ec)?.trs;
  if (Array.isArray(groups)) {
    const rows = groups
      .flatMap((group) => (Array.isArray(group?.tr) ? group.tr : []))
      .map((tr) => joinText(tr?.l?.i))
      .filter(Boolean);
    if (rows.length > 0) return [...new Set(rows)].slice(0, 8);
  }

  // Fallback for words without an `ec` block: concise POS + meaning pairs.
  const simple = data?.individual?.trs;
  if (Array.isArray(simple)) {
    return [
      ...new Set(
        simple
          .map((item) =>
            [cleanText(item?.pos), cleanText(item?.tran)].filter(Boolean).join(' '),
          )
          .filter(Boolean),
      ),
    ].slice(0, 8);
  }
  return [];
}

function extractPhrases(data) {
  const rows = data?.phrs?.phrs;
  return Array.isArray(rows)
    ? rows
        .map((row) => ({
          phrase: cleanText(row?.phr?.headword?.l?.i),
          translation: cleanText(row?.phr?.trs?.[0]?.tr?.l?.i),
        }))
        .filter((row) => row.phrase)
        .slice(0, 8)
    : [];
}

function extractExamples(data) {
  const rows = data?.blng_sents_part?.['sentence-pair'];
  return Array.isArray(rows)
    ? rows
        .map((row) => ({
          en: cleanText(row?.sentence ?? row?.['sentence-eng']),
          zh: cleanText(row?.['sentence-translation']),
        }))
        .filter((row) => row.en)
        .slice(0, 5)
    : [];
}

function extractSynonyms(data) {
  const rows = data?.syno?.synos ?? data?.syno?.syno;
  return Array.isArray(rows)
    ? rows
        .map((row) => {
          const syno = row?.syno ?? row;
          return {
            pos: cleanText(syno?.pos),
            words: Array.isArray(syno?.ws)
              ? syno.ws.map((item) => cleanText(item?.w)).filter(Boolean)
              : [],
            translation: cleanText(syno?.tran),
          };
        })
        .filter((row) => row.words.length > 0)
        .slice(0, 6)
    : [];
}

function extractWordForms(data) {
  const ecWord = firstWord(data?.ec);
  const ecForms = Array.isArray(ecWord?.wfs) ? ecWord.wfs.map((item) => item?.wf) : null;
  const rows = ecForms ?? (Array.isArray(data?.individual?.anagram?.wfs)
    ? data.individual.anagram.wfs
    : []);
  return rows
    .map((row) => ({ name: cleanText(row?.name), value: cleanText(row?.value) }))
    .filter((row) => row.name && row.value)
    .slice(0, 10);
}

function extractDerivatives(data) {
  const groups = data?.individual?.derivative;
  return Array.isArray(groups)
    ? groups
        .map((group) => ({
          pos: cleanText(group?.pos),
          words: (Array.isArray(group?.trans) ? group.trans : [])
            .map((item) => ({
              word: cleanText(item?.word),
              translation: cleanText(item?.tran),
            }))
            .filter((item) => item.word),
        }))
        .filter((group) => group.words.length > 0)
        .slice(0, 5)
    : [];
}

function extractMnemonic(data) {
  return cleanText(data?.individual?.mnemonic?.method);
}

function extractEnglishDefinitions(data) {
  const ee = Array.isArray(data?.ee?.word) ? data.ee.word[0] : data?.ee?.word;
  const groups = ee?.trs;
  return Array.isArray(groups)
    ? groups
        .map((group) => ({
          pos: cleanText(group?.pos),
          definitions: (Array.isArray(group?.tr) ? group.tr : [])
            .map((tr) => {
              const sentences = tr?.exam?.i?.f?.l;
              const example = Array.isArray(sentences) ? sentences[0] : sentences;
              return {
                definition: cleanText(tr?.l?.i),
                example: cleanText(example?.i),
              };
            })
            .filter((item) => item.definition)
            .slice(0, 4),
        }))
        .filter((group) => group.definitions.length > 0)
        .slice(0, 4)
    : [];
}

export function extract(data) {
  return {
    definitions: extractDefinitions(data),
    phrases: extractPhrases(data),
    examples: extractExamples(data),
    synonyms: extractSynonyms(data),
    wordForms: extractWordForms(data),
    derivatives: extractDerivatives(data),
    mnemonic: extractMnemonic(data),
    englishDefinitions: extractEnglishDefinitions(data),
  };
}

export default async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const word = (url.searchParams.get('word') ?? '').trim();
  if (!word || word.length > 80) {
    return json({ error: 'invalid word' }, 400);
  }

  const key = word.toLowerCase();
  const cached = cache.get(key);
  if (cached) return json(cached);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);

  try {
    const upstream = await fetch(
      `${YOUDAO_ENDPOINT}?q=${encodeURIComponent(word)}`,
      {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        },
      },
    );
    if (!upstream.ok) {
      return json({ error: `upstream ${upstream.status}` }, 502);
    }
    const data = await upstream.json();
    const result = { word, ...extract(data) };

    if (cache.size >= CACHE_LIMIT) cache.clear();
    cache.set(key, result);
    return json(result);
  } catch {
    return json({ error: 'dictionary service unavailable' }, 502);
  } finally {
    clearTimeout(timer);
  }
};
