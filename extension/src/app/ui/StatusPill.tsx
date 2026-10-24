import {ExtIcon} from './ExtIcon';

/**
 * The design's `.status-pill` (#27): success, or `.fail` in danger. B1d §4.2: `badge` — a kind beside #21's status
 * (Q31, "Presale"), in the accent and without a glyph: it names what the transaction is, not how it went.
 */
export function StatusPill({text, fail = false, badge = false}: {text: string; fail?: boolean; badge?: boolean}) {
  if (badge) return <div className="status-pill app-badge">{text}</div>;
  return (
    <div className={`status-pill${fail ? ' fail' : ''}`}>
      <ExtIcon name={fail ? 'close' : 'check'} size={12} />
      {text}
    </div>
  );
}
