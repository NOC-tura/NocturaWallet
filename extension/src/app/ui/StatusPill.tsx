import {ExtIcon} from './ExtIcon';

/** The design's `.status-pill` (#27): success, or `.fail` in danger. */
export function StatusPill({text, fail = false}: {text: string; fail?: boolean}) {
  return (
    <div className={`status-pill${fail ? ' fail' : ''}`}>
      <ExtIcon name={fail ? 'close' : 'check'} size={12} />
      {text}
    </div>
  );
}
