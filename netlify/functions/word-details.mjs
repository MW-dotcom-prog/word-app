/**
 * Tiny proxy for dictionary phrases and bilingual examples.
 *
 * Youdao's jsonapi has no CORS header (and no JSONP), so a browser cannot call
 * it directly. This function runs on Netlify, fetches the data server-side and
 * returns only the small phrase/example subset the app needs.
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
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .trim();
}

function extract(data) {
  const phraseRows = data?.phrs?.phrs;
  const phrases = Array.isArray(phraseRows)
    ? phraseRows
        .map((row) => ({
          phrase: cleanText(row?.phr?.headword?.l?.i),
          translation: cleanText(row?.phr?.trs?.[0]?.tr?.l?.i),
        }))
        .filter((row) => row.phrase)
        .slice(0, 6)
    : [];

  const sentenceRows = data?.blng_sents_part?.['sentence-pair'];
  const examples = Array.isArray(sentenceRows)
    ? sentenceRows
        .map((row) => ({
          en: cleanText(row?.sentence ?? row?.['sentence-eng']),
          zh: cleanText(row?.['sentence-translation']),
        }))
        .filter((row) => row.en)
        .slice(0, 3)
    : [];

  return { phrases, examples };
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
