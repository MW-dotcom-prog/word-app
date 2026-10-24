import { useState } from 'react';
import { pronounce, type Accent } from '../lib/tts';
import { Icon } from './Icon';

/**
 * Standard US/UK pronunciation buttons. Plays Youdao dictionary audio first,
 * then the supplied online-dictionary audio, then browser TTS.
 */
export function PronunciationControls({
  word,
  fallbackAudioUrl,
}: {
  word: string;
  fallbackAudioUrl?: string | null;
}) {
  const [playing, setPlaying] = useState<Accent | null>(null);

  const play = async (accent: Accent) => {
    if (playing) return;
    setPlaying(accent);
    try {
      await pronounce(word, accent, fallbackAudioUrl);
    } finally {
      setPlaying(null);
    }
  };

  const renderButton = (accent: Accent, label: string) => (
    <button
      type="button"
      className={`accent-player${playing === accent ? ' is-playing' : ''}`}
      aria-label={`播放 ${word} 的${accent === 'us' ? '美式' : '英式'}发音`}
      aria-busy={playing === accent}
      onClick={(event) => {
        event.stopPropagation();
        void play(accent);
      }}
    >
      <Icon name="speaker" size={14} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="accent-players">
      {renderButton('us', 'US')}
      {renderButton('uk', 'UK')}
    </div>
  );
}
