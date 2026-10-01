import {proveSeed, restoreWallet, type SeedProof} from '../forgetFlow';
import type {PageDeps} from '../page';
import {storedVault} from '../stored';
import {COMMON, IMPORT, PASSWORD, RESTORE} from '../strings';
import {mountImport} from './importScreen';
import type {PasswordRefusal, PasswordScreen} from './password';

export interface RestoreRun {
  /** Reads the stored vault, then shows #8 on the restore path (or what the vault reads as). */
  show(): Promise<void>;
  /** What the run still references beyond #8's field and #5 (plan-2 review H2): the seed proof, which holds the phrase. */
  holds(): {proof: boolean};
}

type Action = {label: string; run(): void};

/**
 * #39 → #8 → #5 — the restore (spec §3.8 "Restore path from #39", E5 with `replacement`, D35, D40).
 * The phrase typed on #8 is proven against the stored wallet in this page (the seed proof: every stored
 * account's key, under the stored scheme) — a phrase that does not match changes nothing and sends
 * nothing. On a match there is no scheme choice: #5 "Restore · 2 / 2" takes the new password, and the
 * same wallet, re-encrypted with every stored account and name, replaces the stored one in one
 * message; then the keys. restoreWallet re-derives the keys immediately before encrypting: a
 * `not-this-wallet` there is answered as the proof's (Task 2 carry). A pending send refuses it
 * (`send-open`): the password stays in #5's memory behind [Try again] until the tab is hidden (§3.5's
 * rule; then "Enter a new password to try again."). `busy` and `unlocked` (nothing was deleted) go back
 * to #8 with their line and [Start again] → #39.
 *
 * What holds the phrase, and for how long (Scope 19): #8's field while it is typed; the seed proof — the
 * phrase inside it — from the match until the run ends: restored, every notice, Back from #5 (the phrase
 * goes back into the field, as the plain import does: plan review L3) — and with the page: `pagehide` drops
 * it (the page may sit in the back/forward cache), work that settles afterwards does not move the run on,
 * and a page restored from that cache starts again on an empty #8. A hidden tab keeps it: the hidden-tab
 * rule is the password's (review M4).
 */
export function createRestoreRun(deps: PageDeps, o: {password: PasswordScreen}): RestoreRun {
  const startAgain: Action = {label: RESTORE.startAgain, run: () => deps.go('unlock.html?mode=forgot')};
  const setUp: Action = {label: RESTORE.setUp, run: () => deps.go('unlock.html?mode=welcome')};
  const tryAnother: Action = {label: RESTORE.tryAnother, run: () => screen.show()};
  let proof: SeedProof | null = null;
  /** Bumped by pagehide: work that settles after the page was left must not move the run on. */
  let generation = 0;
  deps.onLeave(why => {
    if (why !== 'pagehide') return;
    proof = null;
    generation += 1;
  });
  deps.onReturn(why => {
    if (why === 'restored') void read();
  });

  /** Ends the attempt on #8: the proof dropped, the line (and help) in place of the field. */
  const notice = (line: string, help: string, action: Action | null) => {
    proof = null;
    screen.show();
    screen.notice(line, help, action);
  };

  const restore = async (password: string): Promise<PasswordRefusal | null> => {
    const held = proof;
    if (held === null) return {line: COMMON.failedTryAgain, then: 'stop'};
    const started = generation;
    const out = await restoreWallet({send: deps.send, kdf: deps.kdf}, held, password);
    // The page was left (pagehide) while this ran: the run was dropped; a restored page starts again.
    if (started !== generation) return null;
    switch (out) {
      case 'restored':
      case 'restored-locked':
        proof = null;
        deps.go('wallet.html#/imported');
        return null;
      case 'weak-password':
        return {line: PASSWORD.weak, then: 'retype'};
      case 'send-open':
        return {line: RESTORE.sendOpen, then: 'retry'};
      // Nothing was deleted: back to #8, which says so.
      case 'busy':
        notice(RESTORE.busy, '', startAgain);
        return null;
      case 'unlocked':
        notice(RESTORE.unlocked, '', startAgain);
        return null;
      case 'not-this-wallet':
        notice(RESTORE.notThisWallet, RESTORE.notThisWalletHelp, tryAnother);
        return null;
      case 'no-wallet':
        notice(COMMON.noWallet, '', setUp);
        return null;
      case 'damaged':
        notice(COMMON.damaged, COMMON.damagedHelp, null);
        return null;
      default:
        return {line: COMMON.failedTryAgain, then: 'retry'};
    }
  };

  const toPhrase = () => {
    const words = proof?.mnemonic ?? '';
    proof = null;
    screen.show({phrase: words});
  };

  const screen = mountImport(deps, {
    back: () => {
      proof = null;
      deps.go('unlock.html?mode=forgot');
    },
    next: async typed => {
      const started = generation;
      screen.line(RESTORE.checking);
      const r = await proveSeed(deps.store.readEnvelope, typed);
      if (started !== generation) return;
      if (r.outcome === 'match') {
        proof = r.proof;
        screen.clear();
        o.password.show({eyebrow: PASSWORD.recovery, step: PASSWORD.stepRestore, back: toPhrase, finish: restore});
        return;
      }
      if (r.outcome === 'not-this-wallet') return notice(RESTORE.notThisWallet, RESTORE.notThisWalletHelp, tryAnother);
      if (r.outcome === 'no-wallet') return notice(COMMON.noWallet, '', setUp);
      if (r.outcome === 'damaged') return notice(COMMON.damaged, COMMON.damagedHelp, null);
      screen.line(r.outcome === 'invalid-mnemonic' ? IMPORT.invalid : COMMON.failedTryAgain);
    },
  });

  /** #8, after the stored vault is read: no wallet and a damaged one are said before any phrase is typed. */
  const read = async () => {
    proof = null;
    screen.show();
    let raw: unknown;
    try {
      raw = await deps.store.readEnvelope();
    } catch {
      return screen.notice(COMMON.unreadable, '', null);
    }
    const stored = storedVault(raw);
    if (stored.kind === 'none') screen.notice(COMMON.noWallet, '', setUp);
    else if (stored.kind === 'damaged') screen.notice(COMMON.damaged, COMMON.damagedHelp, null);
  };

  return {show: read, holds: () => ({proof: proof !== null})};
}
