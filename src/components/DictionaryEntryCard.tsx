import type { DictEntry } from '../types';
import { FavoriteButton } from './FavoriteButton';
import { PronunciationControls } from './PronunciationControls';
import { WordDetailsSection } from './WordDetailsSection';

export function DictionaryEntryCard({
  entry,
  listNames,
  autoOpenDetails = false,
}: {
  entry: DictEntry;
  listNames: Map<string, string>;
  autoOpenDetails?: boolean;
}) {
  return (
    <article className="dict-entry-card">
      <div className="dict-entry-head">
        <div className="dict-word-block">
          <h3>{entry.w}</h3>
          <div className="dict-phonetics">
            {entry.us ? (
              <span>
                <em>US</em> /{entry.us}/
              </span>
            ) : null}
            {entry.uk ? (
              <span>
                <em>UK</em> /{entry.uk}/
              </span>
            ) : null}
          </div>
        </div>
        <div className="dict-entry-actions">
          <FavoriteButton word={entry.w} />
          <PronunciationControls word={entry.w} />
        </div>
      </div>
      <div className="dict-chips">
        {entry.lists.map((listId) => (
          <span className="chip" key={listId}>
            {listNames.get(listId) ?? listId}
          </span>
        ))}
      </div>
      <div className="dict-meanings">
        {entry.t.map((meaning, index) => (
          <p key={index}>{meaning}</p>
        ))}
      </div>
      <WordDetailsSection word={entry.w} autoOpen={autoOpenDetails} />
    </article>
  );
}
