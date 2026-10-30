import { useEffect, useRef, useState } from 'react';
import { lookupWordDetails, type WordDetails } from '../lib/wordDetails';
import { Icon } from './Icon';

/**
 * Collapsible phrases/examples section. Requests are only made when the
 * section is opened (or when autoOpen is set for the exact search result).
 */
export function WordDetailsSection({
  word,
  autoOpen = false,
  title,
  showPhrases = true,
  className,
}: {
  word: string;
  autoOpen?: boolean;
  title?: string;
  showPhrases?: boolean;
  className?: string;
}) {
  const label = title ?? (showPhrases ? '词组与例句' : '例句');
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
            <>
              {showPhrases ? (
                <div className="word-details-group">
                  <h4>常见词组</h4>
                  {details.phrases.length > 0 ? (
                    <ul className="phrase-list">
                      {details.phrases.map((item, index) => (
                        <li key={`${item.phrase}-${index}`}>
                          <strong>{item.phrase}</strong>
                          {item.translation ? <span>{item.translation}</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted small">暂无常见词组。</p>
                  )}
                </div>
              ) : null}

              <div className="word-details-group">
                {showPhrases ? <h4>例句</h4> : null}
                {details.examples.length > 0 ? (
                  <ul className="example-list">
                    {details.examples.map((item, index) => (
                      <li key={`${item.en}-${index}`}>
                        <p className="example-en">{item.en}</p>
                        {item.zh ? <p className="example-zh">{item.zh}</p> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">暂无例句。</p>
                )}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
