import type {PhraseRead} from '../../shared/phraseRead';
import {ExtIcon} from './ExtIcon';

/** B1e §1.2: the line's copy. `failed` is R9's line, word for word; `label` names the line for a screen reader. */
export const PHRASE_TEXT = {
  label: 'Anti-phishing phrase',
  failed: "Anti-phishing phrase could not be read — don't type your password until it shows",
} as const;

/**
 * B1e §1.2 (undrawn, §9): the anti-phishing phrase under a screen's header — the design's `.banner.shield` with its
 * shield icon and the phrase as a React text child (never markup); nothing when none is set; R9's warning line when the
 * read failed. Used by the popup's locked screen and every approval window (#46, #47, #48, the locked window, #48's
 * origin mismatch).
 */
export function PhraseLine({phrase}: {phrase: PhraseRead}) {
  if (phrase.state === 'none') return null;
  if (phrase.state === 'failed') {
    return (
      <div className="banner warning app-phrase-line" role="status">
        <ExtIcon name="alert-triangle" size={16} />
        <p className="noc-body-sm">{PHRASE_TEXT.failed}</p>
      </div>
    );
  }
  return (
    <div className="banner shield app-phrase-line">
      <ExtIcon name="shield-lock" size={16} />
      <p className="noc-body-sm">
        <span className="app-sr">{PHRASE_TEXT.label}: </span>
        <span className="copy">{phrase.phrase}</span>
      </p>
    </div>
  );
}
