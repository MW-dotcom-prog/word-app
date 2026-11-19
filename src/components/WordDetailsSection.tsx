import { useEffect, useRef, useState } from 'react';
import { lookupWordDetails, type WordDetails } from '../lib/wordDetails';
import { Icon } from './Icon';

/**
 * Collapsible rich-notes section: detailed definitions, examples, phrases,
 * synonyms, word forms and more. Requests are only made when the section is
 * opened (or when autoOpen is set for the exact search result).
 */
export function WordDetailsSection({
  word,
  autoOpen = false,
  title,
  className,
}: {
  word: string;
  autoOpen?: boolean;
  title?: string;
  className?: string;
}) {
  const label = title ?? '详细释义';
  const [open, setOpen] = useState(autoOpen);
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<WordDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const loadedRef = useRef(false);

  useEffect(() => {
    setOpen(autoOpen);
  }, [autoOpen]);

  useEffect(() => {
    loadedRef.current = false;
    setDetails(null);
    setError(null);
    setLoading(false);
  }, [word]);

  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    let active = true;
    let settled = false;
    setLoading(true);
    setError(null);
    lookupWordDetails(word)
      .then((data) => {
        settled = true;
        if (!active) return;
        setDetails(data);
      })
      .catch((reason: unknown) => {
        settled = true;
        if (!active) return;
        loadedRef.current = false;
        setError(reason instanceof Error ? reason.message : '内容加载失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      // Collapsing while the request is still in flight must allow the next
      // expand to reattach; otherwise the body would stay blank forever.
      if (!settled) loadedRef.current = false;
    };
  }, [open, word, requestVersion]);

  const retry = () => {
    loadedRef.current = false;
    setError(null);
    setRequestVersion((value) => value + 1);
  };

  const hasContent = details
    ? details.definitions.length > 0 ||
      details.phrases.length > 0 ||
      details.examples.length > 0 ||
      details.synonyms.length > 0 ||
      details.wordForms.length > 0 ||
      details.derivatives.length > 0 ||
      Boolean(details.mnemonic) ||
      details.englishDefinitions.length > 0
    : false;

  return (
    <section className={`word-details${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="word-details-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="word-details-title">
          <Icon name="sparkle" size={14} />
          {label}
        </span>
        <Icon
          name="chevron-right"
          size={16}
          className={`word-details-chevron${open ? ' is-open' : ''}`}
        />
      </button>

      {open ? (
        <div className="word-details-body">
          {loading ? (
            <div className="word-details-loading" aria-live="polite">
              <span className="spinner small" aria-hidden="true" />
              正在加载{label}…
            </div>
          ) : null}

          {error ? (
            <div className="word-details-error">
              <span>{error}</span>
              <button type="button" className="ghost-button compact" onClick={retry}>
                重试
              </button>
            </div>
          ) : null}

          {details ? (
            hasContent ? (
              <>
                {details.definitions.length > 0 ? (
                  <div className="word-details-group">
                    <h4>释义</h4>
                    <ul className="definition-list">
                      {details.definitions.map((line, index) => (
                        <li key={`${line}-${index}`}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {details.examples.length > 0 ? (
                  <div className="word-details-group">
                    <h4>例句</h4>
                    <ul className="example-list">
                      {details.examples.map((item, index) => (
                        <li key={`${item.en}-${index}`}>
                          <p className="example-en">{item.en}</p>
                          {item.zh ? <p className="example-zh">{item.zh}</p> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {details.phrases.length > 0 ? (
                  <div className="word-details-group">
                    <h4>常见词组</h4>
                    <ul className="phrase-list">
                      {details.phrases.map((item, index) => (
                        <li key={`${item.phrase}-${index}`}>
                          <strong>{item.phrase}</strong>
                          {item.translation ? <span>{item.translation}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {details.synonyms.length > 0 ? (
                  <div className="word-details-group">
                    <h4>同义词</h4>
                    <ul className="synonym-list">
                      {details.synonyms.map((group, index) => (
                        <li key={`${group.pos}-${index}`}>
                          <p className="synonym-head">
                            {group.pos ? <em>{group.pos}</em> : null}
                            <span>{group.words.join(' · ')}</span>
                          </p>
                          {group.translation ? (
                            <p className="synonym-tran">{group.translation}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {details.wordForms.length > 0 ? (
                  <div className="word-details-group">
                    <h4>词形变化</h4>
                    <div className="word-form-list">
                      {details.wordForms.map((form, index) => (
                        <span className="word-form" key={`${form.name}-${index}`}>
                          <em>{form.name}</em>
                          {form.value}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {details.derivatives.length > 0 ? (
                  <div className="word-details-group">
                    <h4>派生词</h4>
                    <ul className="derivative-list">
                      {details.derivatives.map((group, index) => (
                        <li key={`${group.pos}-${index}`}>
                          {group.pos ? <em>{group.pos}</em> : null}
                          <span>
                            {group.words
                              .map((item) =>
                                item.translation ? `${item.word} ${item.translation}` : item.word,
                              )
                              .join('；')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {details.mnemonic ? (
                  <div className="word-details-group">
                    <h4>记忆方法</h4>
                    <p className="mnemonic-note">{details.mnemonic}</p>
                  </div>
                ) : null}

                {details.englishDefinitions.length > 0 ? (
                  <div className="word-details-group">
                    <h4>英文释义</h4>
                    <div className="english-definitions">
                      {details.englishDefinitions.map((group, index) => (
                        <div className="english-def-group" key={`${group.pos}-${index}`}>
                          {group.pos ? <em className="pos-label">{group.pos}</em> : null}
                          <ol>
                            {group.definitions.map((item, definitionIndex) => (
                              <li key={`${item.definition}-${definitionIndex}`}>
                                <span>{item.definition}</span>
                                {item.example ? (
                                  <em className="example">“{item.example}”</em>
                                ) : null}
                              </li>
                            ))}
                          </ol>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="muted small">暂无更多释义。</p>
            )
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
