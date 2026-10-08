import {finishOnboarding} from '../onboarding';
import type {PageDeps} from '../page';
import {storedVault} from '../stored';
import {COMMON, PASSWORD, WELCOME} from '../strings';
import {mountConfirm} from './confirm';
import type {PasswordScreen} from './password';
import {mountPasskey} from './passkey';
import {mountSeed} from './seed';
import {mountIntro, mountWelcome} from './welcome';

/**
 * Runs a store of the wallet (`finishOnboarding`) as the page's one store in flight: while it runs, #1 shown
 * by a restore from the back/forward cache offers nothing (Task 8 fix round 2, N1), and #1 reads again once
 * it settles. The create run's own store and the import run's (Task 9) both go through it.
 */
export type Storing = <T>(work: () => Promise<T>) => Promise<T>;

export interface CreateRun {
  /** Shows #1 (`welcome`) or #2 (`intro`, `?mode=create`). */
  start(at: 'welcome' | 'intro'): void;
  /** What the run still references (plan-2 review H2): the new phrase, #5's password held for #6. */
  holds(): {phrase: boolean; password: boolean};
  /** The page's store tracker (see `Storing`), for the import run that shares this page. */
  storing: Storing;
}

/**
 * The whole create run (spec S2, §3.1–§3.6) in ONE page: #1 → #2 → #3 → #4 → #5 → #6, so the new phrase
 * never crosses a navigation. It is generated when #3 is first reached and dropped once the wallet is
 * stored (`created`, `created-locked`, `exists`) — or with the page: it lives in this closure only; a
 * failed store keeps it for another try. The password #5 sets is held for #6's passkey and dropped when
 * #6 ends or the tab is hidden (a tab hidden while the wallet is being stored counts: #6 then asks for
 * it). `pagehide` drops the phrase as well (fix round 1: the page may be kept in the back/forward cache,
 * `persisted` or not), and a page restored from that cache starts again at #1. A stored wallet hands over to the UI tab's #7 (`wallet.html#/created`; `created`
 * via #6, `created-locked` at once), which shows its locked variant when the keys did not reach the background.
 * The other answers stay on #5: `exists` with its lines (the run stops there), `weak-password` and `failed`
 * (and `invalid-mnemonic`) with the field to type again.
 * Mounted once per page (Task 9): #5 is the page's one PasswordScreen, shared with the import run, and #1's
 * "I have a wallet" hands over to that run in the same page — dropping the phrase a #3 visit generated first.
 */
export function createCreateRun(deps: PageDeps, o: {password: PasswordScreen; importRun(): void}): CreateRun {
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
  /** #1 is the screen up (the run's own record: #1 is shown only through `toWelcome`). */
  let onWelcome = false;
  const toWelcome = () => {
    onWelcome = true;
    // N1: while a store is in flight, #1 offers nothing — it re-reads once the store settles.
    if (storing) welcome.hold();
    else void welcome.show();
  };
  deps.onReturn(why => {
    if (why === 'restored') toWelcome();
  });
  const whileStoring: Storing = async work => {
    storing = true;
    try {
      return await work();
    } finally {
      storing = false;
      // N1: a store that settles while #1 is up (a restore from the back/forward cache) — #1 reads again.
      if (onWelcome) void welcome.show();
    }
  };

  const welcome = mountWelcome(deps, {
    create: () => {
      onWelcome = false;
      intro.show();
    },
    import: () => {
      onWelcome = false;
      // Task 9 carry: the create run ends here — the phrase a #3 visit generated is not the wallet being imported.
      mnemonic = null;
      o.importRun();
    },
  });
  const intro = mountIntro({back: toWelcome, continue: () => seed.show(words())});
  const seed = mountSeed(deps, {back: () => intro.show(), done: () => confirm.show(words())});
  const confirm = mountConfirm(deps, {back: () => seed.show(words()), done: () => passwordStep()});
  const pw = o.password;
  const passkey = mountPasskey(deps, {done: () => deps.go('wallet.html#/created')});

  const passwordStep = () =>
    pw.show({
      eyebrow: PASSWORD.onboarding,
      step: PASSWORD.stepCreate,
      back: () => confirm.show(words()),
      finish: async chosen => {
        const phrase = mnemonic;
        if (phrase === null) return {line: PASSWORD.failed, then: 'stop'};
        leftWhileStoring = false;
        const started = generation;
        let revision: string | null = null;
        const out = await whileStoring(() =>
          finishOnboarding({...deps.store, send: deps.send, kdf: deps.kdf}, {mnemonic: phrase, password: chosen, scheme: 'slip10', indexes: [0]}, {created: r => void (revision = r)}),
        );
        if (out === 'created' || out === 'created-locked' || out === 'exists') mnemonic = null;
        // The page was left (pagehide) while this ran: the run was dropped, and #1 shows what is stored now.
        if (started !== generation) return null;
        if (out === 'created') {
          // B1b-2b C8 (E15): this wallet's phrase just passed #4's check — recorded once it is stored and its keys are
          // in the session, bound to the envelope this run stored (the final review's m7). A refusal is ignored: the
          // fact is cosmetic (two #35 rows), and #6 must not wait on it.
          try {
            if (revision !== null) await deps.send({type: 'vault.phraseVerified', expectedRevision: revision});
          } catch {
            // Not recorded: #35 asks the user to verify, which is true enough.
          }
          if (started !== generation) return null;
          // §3.5: held for #6 only — unless the tab was hidden meanwhile, which drops it (#6 asks again).
          password = leftWhileStoring ? null : chosen;
          passkey.show({get: () => password, drop: () => void (password = null)});
          return null;
        }
        if (out === 'created-locked') {
          deps.go('wallet.html#/created');
          return null;
        }
        if (out === 'exists') return existsLines(deps);
        return {line: out === 'weak-password' ? PASSWORD.weak : out === 'invalid-mnemonic' ? PASSWORD.invalid : PASSWORD.failed, then: 'retype'};
      },
    });

  return {
    start(at) {
      if (at === 'welcome') toWelcome();
      else intro.show();
    },
    holds: () => ({phrase: mnemonic !== null, password: password !== null}),
    storing: whileStoring,
  };
}

/**
 * #5's lines when `finishOnboarding` answers `exists` — it does for anything stored, a damaged vault too
 * (stored.ts) — read again to say which, as #1 does (Task 8 fix round 1, M1/M4): a wallet → "Open the
 * Noctura icon to use it."; damaged → the damaged lines; unreadable → the reload line. Shared by the
 * create and import runs.
 */
export async function existsLines(deps: PageDeps): Promise<{line: string; help: string; then: 'stop'}> {
  try {
    const stored = storedVault(await deps.store.readEnvelope());
    if (stored.kind === 'damaged') return {line: COMMON.damaged, help: COMMON.damagedHelp, then: 'stop'};
    return {line: COMMON.exists, help: WELCOME.useIt, then: 'stop'};
  } catch {
    return {line: COMMON.unreadable, help: '', then: 'stop'};
  }
}
