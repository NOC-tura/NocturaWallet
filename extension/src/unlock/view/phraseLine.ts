import {PHRASE_FAILED, phraseRead, type PhraseRead} from '../../shared/phraseRead';
import type {Send} from '../types';
import {byId, setText, shown} from './dom';

/**
 * B1e §1.4: the anti-phishing phrase for #9 and #10, from vault.status's `phrase` (answered locked or unlocked). A send
 * that throws, a refusal or an answer without a readable field is `failed` (R9).
 */
export async function readPhraseLine(send: Send): Promise<PhraseRead> {
  try {
    const r = await send({type: 'vault.status'});
    return r.ok && typeof r.data === 'object' && r.data !== null ? phraseRead((r.data as {phrase?: unknown}).phrase) : PHRASE_FAILED;
  } catch {
    return PHRASE_FAILED;
  }
}

/**
 * B1e §1.2: one screen's line (`unl` #9, `ra` #10) — the phrase as textContent beside the shield, R9's fixed line
 * (unlock.html) when the read failed, neither when no phrase is set.
 */
export function showPhraseLine(screen: 'unl' | 'ra', read: PhraseRead): void {
  setText(byId(`${screen}-phrase-text`), read.state === 'set' ? read.phrase : '');
  shown(byId(`${screen}-phrase`), read.state === 'set');
  shown(byId(`${screen}-phrase-failed`), read.state === 'failed');
}
