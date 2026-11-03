import type {Ext} from '../ext';
import type {WalletDeps} from './deps';
import {REAUTH_KEY, getSession, sessionMutex} from './session';
import {settingsMutex} from './settings';
import {issueChallenge, takePhraseChallenge} from './reauthChallenges';
import {digestOf} from './digest';
import {cleanPhrase} from '../shared/envelopeRules';
import {PHRASE_KEY} from './phraseKey';
import type {Result} from './walletApi';

const MALFORMED: Result = {ok: false, error: 'malformed'};
const LOCKED: Result = {ok: false, error: 'locked'};

/**
 * B1e §1.4: the stored anti-phishing phrase, or null. A stored value is a claim: anything that is not exactly a phrase
 * cleanPhrase would store reads as none.
 */
export async function readPhrase(ext: Ext): Promise<string | null> {
  const raw = await ext.local.get(PHRASE_KEY);
  return typeof raw === 'string' && cleanPhrase(raw) === raw ? raw : null;
}

async function writePhrase(ext: Ext, phrase: string | null): Promise<void> {
  if (phrase === null) await ext.local.remove(PHRASE_KEY);
  else await ext.local.set(PHRASE_KEY, phrase);
}

/**
 * settings.phrase {phrase: string | null} (B1e §1.3, R1 = E18). The value is cleaned (§1.5); then, under settingsMutex:
 * equal to the stored one → `unchanged` (nothing written); no session → `locked`; none stored → written at once (`set`:
 * adding a protection needs only the unlocked session — a locked profile cannot plant a phrase someone knows); a change
 * or a removal → a `phrase` challenge bound to the cleaned value, answered `reauth-required {challengeId}`, applied only
 * by vault.reauthOk (applyPhraseChallenge). The session check and the first write share one sessionMutex section, so a
 * lock is ordered wholly before or after them. Every refusal is a fixed code: no answer carries the value, nothing logs
 * it. A message carrying `challengeId` is malformed (as settings.set: no re-call path).
 */
export async function setPhrase(ext: Ext, deps: Pick<WalletDeps, 'now' | 'randomBytes'>, msg: Record<string, unknown>): Promise<Result> {
  if (msg.challengeId !== undefined) return MALFORMED;
  const next = cleanPhrase(msg.phrase);
  if (next === undefined) return MALFORMED;
  return settingsMutex(async (): Promise<Result> => {
    const step = await sessionMutex(async () => {
      const stored = await readPhrase(ext);
      if (stored === next) return 'unchanged' as const;
      if ((await getSession(ext)) === null) return 'locked' as const;
      if (stored === null && next !== null) {
        await writePhrase(ext, next);
        return 'set' as const;
      }
      return 'proof' as const;
    });
    if (step === 'locked') return LOCKED;
    if (step !== 'proof') return {ok: true, data: {outcome: step}};
    const about = {kind: 'phrase' as const, phrase: next};
    // issueChallenge takes sessionMutex itself (it is not re-entrant): never called inside it here.
    const challengeId = await issueChallenge(ext, deps, digestOf('phrase', about), about);
    // A lock that raced past the challenge's write: remove just the challenges, under the mutex the lock takes (as
    // setSettings does).
    const lockedMeanwhile = await sessionMutex(async () => {
      if ((await getSession(ext)) !== null) return false;
      await ext.session.remove(REAUTH_KEY);
      return true;
    });
    return lockedMeanwhile ? LOCKED : {ok: false, error: 'reauth-required', data: {challengeId}};
  });
}

/**
 * B1e §1.3: #10's Confirm satisfied a `phrase` challenge — the background applies the value it bound at issue. Inside
 * settingsMutex: the challenge is taken (deleted in the section that reads it: applied exactly once), then its value is
 * written over whatever is stored now — the last confirmed proof wins, as for settings (review M6). Refusals:
 * `unknown-challenge` (absent, expired, applied, another kind), `locked`, `failed` (a storage error).
 */
export async function applyPhraseChallenge(ext: Ext, deps: Pick<WalletDeps, 'now'>, challengeId: string): Promise<Result> {
  try {
    return await settingsMutex(async (): Promise<Result> => {
      const taken = await takePhraseChallenge(ext, deps.now(), challengeId);
      if (taken === 'unknown-challenge' || taken === 'locked') return {ok: false, error: taken};
      await writePhrase(ext, taken.phrase);
      return {ok: true, data: {applied: 'phrase'}};
    });
  } catch {
    return {ok: false, error: 'failed'};
  }
}
