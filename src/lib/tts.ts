export type Accent = 'us' | 'uk';

let cachedVoice: SpeechSynthesisVoice | null | undefined;

const PREFERRED_VOICES = [
  'Google US English',
  'Samantha',
  'Alex',
  'Ava',
  'Karen',
  'Daniel',
  'Moira',
];

function pickEnglishVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined) return cachedVoice;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    cachedVoice = null;
    return null;
  }
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    // Voice list may still be loading; don't cache an empty result.
    return null;
  }
  for (const name of PREFERRED_VOICES) {
    const match = voices.find((voice) => voice.name === name);
    if (match) {
      cachedVoice = match;
      return cachedVoice;
    }
  }
  cachedVoice =
    voices.find((voice) => /^en[-_]US/i.test(voice.lang)) ??
    voices.find((voice) => /^en[-_]GB/i.test(voice.lang)) ??
    voices.find((voice) => /^en/i.test(voice.lang)) ??
    null;
  return cachedVoice;
}

/** Browser speech synthesis, used only as a fallback when audio is unavailable. */
export function speak(text: string): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  const synthesis = window.speechSynthesis;
  synthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  const voice = pickEnglishVoice();
  if (voice) utterance.voice = voice;
  synthesis.speak(utterance);
  return true;
}

export function playAudioUrl(url: string, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    let settled = false;
    let timer: number | undefined;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };

    timer = window.setTimeout(() => {
      audio.pause();
      finish(new Error('音频播放超时'));
    }, timeoutMs);

    audio.addEventListener('ended', () => finish(), { once: true });
    audio.addEventListener('error', () => finish(new Error('音频播放失败')), {
      once: true,
    });
    void audio.play().catch((error: unknown) => {
      finish(error instanceof Error ? error : new Error('音频播放失败'));
    });
  });
}

/**
 * Youdao dictionary pronunciation audio. `type=1` is UK, `type=2` is US.
 * This is the standard pronunciation used by the dictionary; it is much more
 * consistent than browser TTS and works without an API key.
 */
export function standardAudioUrl(word: string, accent: Accent = 'us'): string {
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${
    accent === 'uk' ? 1 : 2
  }`;
}

/**
 * Play a standard US/UK pronunciation. Falls back to a supplied audio URL and
 * finally to browser speech synthesis when offline or when the audio fails.
 */
export async function pronounce(
  word: string,
  accent: Accent = 'us',
  fallbackAudioUrl?: string | null,
): Promise<'standard' | 'fallback' | 'tts'> {
  const text = word.trim();
  if (!text) return 'tts';

  try {
    await playAudioUrl(standardAudioUrl(text, accent));
    return 'standard';
  } catch {
    // try the next source
  }

  if (fallbackAudioUrl) {
    try {
      await playAudioUrl(fallbackAudioUrl);
      return 'fallback';
    } catch {
      // try the next source
    }
  }

  speak(text);
  return 'tts';
}
