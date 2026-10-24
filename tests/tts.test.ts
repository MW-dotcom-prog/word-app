import { describe, expect, it } from 'vitest';
import { standardAudioUrl } from '../src/lib/tts';

describe('standard pronunciation URLs', () => {
  it('uses Youdao type=2 for US and type=1 for UK', () => {
    expect(standardAudioUrl('hello', 'us')).toBe(
      'https://dict.youdao.com/dictvoice?audio=hello&type=2',
    );
    expect(standardAudioUrl('hello', 'uk')).toBe(
      'https://dict.youdao.com/dictvoice?audio=hello&type=1',
    );
  });

  it('encodes phrases safely', () => {
    expect(standardAudioUrl('ice cream', 'us')).toContain('audio=ice%20cream');
  });
});
