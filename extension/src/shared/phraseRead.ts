import {cleanPhrase} from './envelopeRules';

/**
 * B1e §1.2 (R9): what a screen shows of the anti-phishing phrase, from the `phrase` field of `wallet.state`,
 * `vault.status` or `dapp.pending`. `none`: no phrase is set — nothing shows. `set`: the phrase, shown as plain text.
 * `failed`: the read did not give an answer this side can trust (no answer, an error, a field missing or not exactly a
 * phrase the background would store) — the screen says it could not be read, never silence, which would look like a
 * phishing window and like "no phrase" at once.
 */
export type PhraseRead = {state: 'none'} | {state: 'set'; phrase: string} | {state: 'failed'};

/** For comparisons only, and frozen: a read never hands these out (Task 5 fix round 1, Minor 3 — readers return fresh objects). */
export const PHRASE_NONE: PhraseRead = Object.freeze({state: 'none'});
export const PHRASE_FAILED: PhraseRead = Object.freeze({state: 'failed'});

/** A read that failed, as a fresh object (what a screen makes of no answer, a refusal or an unreadable field). */
export function phraseFailed(): PhraseRead {
  return {state: 'failed'};
}

/**
 * The field as an answer carries it: null is none; a string that is exactly a clean phrase is the phrase; anything else
 * failed. Every call returns a fresh object.
 */
export function phraseRead(field: unknown): PhraseRead {
  if (field === null) return {state: 'none'};
  return typeof field === 'string' && cleanPhrase(field) === field ? {state: 'set', phrase: field} : phraseFailed();
}
