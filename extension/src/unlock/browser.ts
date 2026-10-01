import {workerKdf} from '../vault/kdf';
import {readLocal} from '../shared/readLocal';
import {send} from '../ui/send';
import {newMnemonic} from './onboarding';
import {createPageGate, type PageDeps} from './page';
import {ENVELOPE_KEY} from './unlockFlow';
import {backgroundVaultStore} from './vaultStore';

/**
 * The vault page's real dependencies: the background by runtime message (the page never touches the
 * network or writes storage), v1_vault read through src/shared/readLocal, Argon2id in the page's worker,
 * the browser's WebAuthn, timers and tab. Tests build their own PageDeps (pageHarness.ts).
 */
export function browserPageDeps(): PageDeps {
  return {
    send,
    store: backgroundVaultStore(send, () => readLocal(ENVELOPE_KEY)),
    kdf: workerKdf,
    credentials: navigator.credentials,
    randomBytes: n => crypto.getRandomValues(new Uint8Array(n)),
    newMnemonic,
    timers: {
      now: () => Date.now(),
      setTimeout: (f, ms) => window.setTimeout(f, ms),
      clearTimeout: id => window.clearTimeout(id),
      setInterval: (f, ms) => window.setInterval(f, ms),
      clearInterval: id => window.clearInterval(id),
    },
    sleep: ms => new Promise<void>(resolve => window.setTimeout(resolve, ms)),
    // Cardinal rule 6: ONE busy flag for the whole page — a passkey prompt and a password submit share it.
    gate: createPageGate(),
    // Same tab: the page — and the phrase or password it held — goes away with the navigation.
    go: target => location.replace(target),
    closeTab: () => window.close(),
    // Spec §3.5's memory rule: both the page going away and the tab being hidden drop what a screen holds.
    onLeave: f => {
      window.addEventListener('pagehide', f);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') f();
      });
    },
    onReturn: f => {
      window.addEventListener('pageshow', f);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') f();
      });
    },
  };
}
