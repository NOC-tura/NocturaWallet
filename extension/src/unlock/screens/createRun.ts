import {finishOnboarding} from '../onboarding';
import type {PageDeps} from '../page';
import {storedVault} from '../stored';
import {COMMON, PASSWORD, WELCOME} from '../strings';
import {mountConfirm} from './confirm';
import {mountPassword} from './password';
import {mountPasskey} from './passkey';
import {mountSeed} from './seed';
import {mountIntro, mountWelcome} from './welcome';

export interface CreateRun {
  /** What the run still references (plan-2 review H2): the new phrase, #5's password held for #6. */
  holds(): {phrase: boolean; password: boolean};
}

/**
 * The whole create run (spec S2, §3.1–§3.6) in ONE page: #1 → #2 → #3 → #4 → #5 → #6, so the new phrase
 * never crosses a navigation. It is generated when #3 is first reached and dropped once the wallet is
 * stored (`created`, `created-locked`, `exists`) — or with the page: it lives in this closure only; a
 * failed store keeps it for another try. The password #5 sets is held for #6's passkey and dropped when
 * #6 ends or the tab is hidden (a tab hidden while the wallet is being stored counts: #6 then asks for
 * it). `pagehide` drops the phrase as well (fix round 1: the page may be kept in the back/forward cache,
 * `persisted` or not), and a page restored from that cache starts again at #1. Every end hands over to the UI tab's #7 (`wallet.html#/created`), which shows its locked variant
 * when the keys did not reach the background.
 */
export function startCreateRun(deps: PageDeps, o: {at: 'welcome' | 'intro'; importRun(): void}): CreateRun {
  let mnemonic: string | null = null;
  let password: string | null = null;
  let storing = false;
  let leftWhileStoring = false;
  /** Bumped by pagehide: a store that settles after the page was left must not move the run on. */
  let generation = 0;
  const words = (): string[] => {
    mnemonic ??= deps.newMnemonic();
    return mnemonic.split(' ');
  };
  deps.onLeave(why => {
    password = null;
    if (storing) leftWhileStoring = true;
    if (why === 'pagehide') {
      mnemonic = null;
      generation += 1;
    }
  });
  deps.onReturn(why => {
    if (why === 'restored') void welcome.show();
  });

  const welcome = mountWelcome(deps, {create: () => intro.show(), import: () => o.importRun()});
  const intro = mountIntro({back: () => void welcome.show(), continue: () => seed.show(words())});
  const seed = mountSeed(deps, {back: () => intro.show(), done: () => confirm.show(words())});
  const confirm = mountConfirm(deps, {back: () => seed.show(words()), done: () => passwordStep()});
  const pw = mountPassword(deps);
  const passkey = mountPasskey(deps, {done: () => deps.go('wallet.html#/created')});

  const passwordStep = () =>
    pw.show({
      eyebrow: PASSWORD.onboarding,
      step: PASSWORD.stepCreate,
      back: () => confirm.show(words()),
      finish: async chosen => {
        const phrase = mnemonic;
        if (phrase === null) return {line: PASSWORD.failed, stop: true};
        storing = true;
        leftWhileStoring = false;
        const started = generation;
        let out: Awaited<ReturnType<typeof finishOnboarding>>;
        try {
          out = await finishOnboarding({...deps.store, send: deps.send, kdf: deps.kdf}, {mnemonic: phrase, password: chosen, scheme: 'slip10', indexes: [0]});
        } finally {
          storing = false;
        }
        if (out === 'created' || out === 'created-locked' || out === 'exists') mnemonic = null;
        // The page was left (pagehide) while this ran: the run was dropped, and #1 shows what is stored now.
        if (started !== generation) return null;
        if (out === 'created') {
          // §3.5: held for #6 only — unless the tab was hidden meanwhile, which drops it (#6 asks again).
          password = leftWhileStoring ? null : chosen;
          passkey.show({get: () => password, drop: () => void (password = null)});
          return null;
        }
        if (out === 'created-locked') {
          deps.go('wallet.html#/created');
          return null;
        }
        if (out === 'exists') return stopped();
        return {line: out === 'weak-password' ? PASSWORD.weak : out === 'invalid-mnemonic' ? PASSWORD.invalid : PASSWORD.failed, stop: false};
      },
    });

  /**
   * finishOnboarding answers `exists` for anything stored — a damaged vault too (stored.ts). Read it again to
   * say which, as #1 does (fix round 1, M1/M4): a wallet → "Open the Noctura icon to use it."; damaged → the
   * damaged lines; unreadable → the reload line.
   */
  const stopped = async (): Promise<{line: string; help: string; stop: true}> => {
    try {
      const stored = storedVault(await deps.store.readEnvelope());
      if (stored.kind === 'damaged') return {line: COMMON.damaged, help: COMMON.damagedHelp, stop: true};
      return {line: COMMON.exists, help: WELCOME.useIt, stop: true};
    } catch {
      return {line: COMMON.unreadable, help: '', stop: true};
    }
  };

  if (o.at === 'welcome') void welcome.show();
  else intro.show();
  return {holds: () => ({phrase: mnemonic !== null, password: password !== null})};
}
