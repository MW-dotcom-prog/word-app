import { describe, expect, it } from 'vitest';
import { extract } from '../netlify/functions/word-details.mjs';

describe('word-details extract', () => {
  it('pulls rich notes out of a Youdao payload', () => {
    const result = extract({
      ec: {
        word: [
          {
            trs: [
              { tr: [{ l: { i: ['v. 放弃；抛弃', 'v. 遗弃'] } }] },
              { tr: [{ l: { i: 'n. 放任，放纵' } }] },
            ],
            wfs: [
              { wf: { name: '第三人称单数', value: 'abandons' } },
              { wf: { name: '现在分词', value: 'abandoning' } },
            ],
          },
        ],
      },
      ee: {
        word: {
          trs: [
            {
              pos: 'v.',
              tr: [
                {
                  l: { i: 'forsake, leave behind' },
                  exam: { i: { f: { l: [{ i: 'He abandoned the car' }] } } },
                },
              ],
            },
          ],
        },
      },
      phrs: {
        phrs: [{ phr: { headword: { l: { i: 'with abandon' } }, trs: [{ tr: { l: { i: '放纵地' } } }] } }],
      },
      blng_sents_part: {
        'sentence-pair': [
          {
            sentence: 'They abandon the plan.',
            'sentence-translation': '他们放弃了计划。',
          },
        ],
      },
      syno: {
        synos: [{ syno: { pos: 'vt.', ws: [{ w: 'desert' }, { w: 'quit' }], tran: '放弃' } }],
      },
      individual: {
        mnemonic: { method: 'a + ban + don → 不再给予' },
        derivative: [
          { pos: 'adj.', trans: [{ word: 'abandoned', tran: '被抛弃的' }] },
        ],
      },
    });

    expect(result.definitions).toEqual(['v. 放弃；抛弃；v. 遗弃', 'n. 放任，放纵']);
    expect(result.phrases).toEqual([{ phrase: 'with abandon', translation: '放纵地' }]);
    expect(result.examples).toEqual([{ en: 'They abandon the plan.', zh: '他们放弃了计划。' }]);
    expect(result.synonyms).toEqual([
      { pos: 'vt.', words: ['desert', 'quit'], translation: '放弃' },
    ]);
    expect(result.wordForms).toEqual([
      { name: '第三人称单数', value: 'abandons' },
      { name: '现在分词', value: 'abandoning' },
    ]);
    expect(result.derivatives).toEqual([
      { pos: 'adj.', words: [{ word: 'abandoned', translation: '被抛弃的' }] },
    ]);
    expect(result.mnemonic).toBe('a + ban + don → 不再给予');
    expect(result.englishDefinitions).toEqual([
      {
        pos: 'v.',
        definitions: [{ definition: 'forsake, leave behind', example: 'He abandoned the car' }],
      },
    ]);
  });

  it('returns empty collections when the upstream payload has no notes', () => {
    const result = extract({});

    expect(result.definitions).toEqual([]);
    expect(result.phrases).toEqual([]);
    expect(result.examples).toEqual([]);
    expect(result.synonyms).toEqual([]);
    expect(result.wordForms).toEqual([]);
    expect(result.derivatives).toEqual([]);
    expect(result.mnemonic).toBe('');
    expect(result.englishDefinitions).toEqual([]);
  });

  it('falls back to concise POS + meaning pairs when ec is missing', () => {
    const result = extract({
      individual: {
        trs: [
          { pos: 'v.', tran: '放置，放下' },
          { pos: 'n.', tran: '一套，一副' },
        ],
      },
    });

    expect(result.definitions).toEqual(['v. 放置，放下', 'n. 一套，一副']);
  });
});
