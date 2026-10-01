import {detectImport, finishOnboarding, indexesFor, type Candidate, type ProbeResult} from '../onboarding';
import type {PageDeps} from '../page';
import {IMPORT, PASSWORD} from '../strings';
import {existsLines, type Storing} from './createRun';
import {mountImport, type Scheme} from './importScreen';
import type {PasswordScreen} from './password';

export interface ImportRun {
  /** Shows #8 with an empty field. */
  show(): void;
  /** What the run still references beyond #8's field (plan-2 review H2): the phrase, from Continue to the run's end. */
  holds(): {phrase: boolean};
}

/**
 * A plain import (spec §3.8, no `source`): #8 → the scheme (detected from balances the background
 * reads for the public keys; the user chooses when both or neither can be told) → #5 "Import · 2 / 2"
 * → the UI tab's #40 (`wallet.html#/imported`, locked variant when the keys did not reach the
 * background). No #6 on this path (D9 puts the passkey step on create only).
 *
 * What holds the phrase, and for how long (Scope 19): #8's field while it is typed; this closure from the
 * scheme choice (or #5) until the run ends — the wallet stored (`created`, `created-locked`), `exists`,
 * Back (from the choice: dropped; from #5: back into the field, not memory), the choice ended without a
 * pick (the idle wipe) — and with the page: `pagehide` drops it (the page may sit in the back/forward
 * cache), and a store that lands afterwards does not move the run on. A hidden tab keeps it: §3.5's
 * hidden-tab rule is the password's, and dropping the phrase under an open #5 would end the run on an
 * untrue "That is not a valid 12- or 24-word recovery phrase." (review M4). A failed store keeps it for
 * another try. `storing` is the page's store tracker (createRun.ts): #1, restored while this store runs,
 * offers nothing until it lands.
 */
export function createImportRun(deps: PageDeps, o: {password: PasswordScreen; back(): void; storing?: Storing}): ImportRun {
  const pw = o.password;
  const storing: Storing = o.storing ?? (work => work());
  let phrase: string | null = null;
  /** Bumped by pagehide: work that settles after the page was left must not move the run on. */
  let generation = 0;
  deps.onLeave(why => {
    if (why !== 'pagehide') return;
    phrase = null;
    generation += 1;
  });

  const toPassword = (scheme: Scheme, candidates: Candidate[], probe: ProbeResult) => {
    screen.clear();
    pw.show({
      eyebrow: PASSWORD.onboarding,
      step: PASSWORD.stepImport,
      back: () => {
        const held = phrase;
        phrase = null;
        screen.show({phrase: held ?? ''});
      },
      finish: async password => {
        const held = phrase;
        if (held === null) return {line: PASSWORD.failed, stop: true};
        const started = generation;
        const out = await storing(() => finishOnboarding({...deps.store, send: deps.send, kdf: deps.kdf}, {mnemonic: held, password, scheme, indexes: indexesFor(scheme, candidates, probe)}));
        if (out === 'created' || out === 'created-locked' || out === 'exists') phrase = null;
        // The page was left (pagehide) while this ran: the run was dropped; a restored page shows #1.
        if (started !== generation) return null;
        if (out === 'created' || out === 'created-locked') {
          deps.go('wallet.html#/imported');
          return null;
        }
        if (out === 'exists') return existsLines(deps);
        return {line: out === 'weak-password' ? PASSWORD.weak : out === 'invalid-mnemonic' ? PASSWORD.invalid : PASSWORD.failed, stop: false};
      },
    });
  };
  /** The choice ends `next` (the gate frees for the pick); the phrase waits here, not in a closure. */
  const choose = async (why: string, started: number, candidates: Candidate[], probe: ProbeResult) => {
    const scheme = await screen.choose(why);
    if (scheme === null || started !== generation || phrase === null) {
      phrase = null;
      return;
    }
    toPassword(scheme, candidates, probe);
  };

  const screen = mountImport(deps, {
    back: () => {
      phrase = null;
      o.back();
    },
    next: async typed => {
      const started = generation;
      screen.line(IMPORT.checking);
      const detected = await detectImport(deps.send, typed);
      if (started !== generation) return;
      if (detected.outcome === 'invalid-mnemonic') {
        screen.line(IMPORT.invalid);
        return;
      }
      screen.line(null);
      const {candidates, probe, choice} = detected;
      phrase = typed;
      if ('choose' in choice) void choose(choice.choose === 'both-funded' ? IMPORT.bothFunded : IMPORT.unresolved, started, candidates, probe);
      else toPassword(choice.scheme, candidates, probe);
    },
  });

  return {show: () => screen.show(), holds: () => ({phrase: phrase !== null})};
}
