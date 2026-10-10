// @vitest-environment happy-dom
import {fireEvent, screen, waitFor} from '@testing-library/react';
import {render} from '@testing-library/react';
import {renderApp} from './appHarness';
import {setupWallet} from './harness';
import {App} from '../App';
import {getSession} from '../../background/session';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {PASSWORD_TOAST_KEY, readPref} from '../prefs';
import {SETTINGS_KEY} from '../../background/settings';
import {CONTACTS_KEY} from '../../background/contacts';
import {base58, base64} from '@scure/base';
import {Settings} from '../screens/Settings';
import {WalletProvider} from '../WalletContext';
import {ENV} from './harness';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';

const SELECTORS = selectorsOf(UI_SHEETS);
const B = (n: number) => base64.encode(new Uint8Array(n).fill(1));
const WITH_PASSKEY = {...ENV, passkey: {credentialId: B(16), prfSalt: B(32), wrapped: B(40)}};
const noop = () => undefined;

// B1b-2b §4.1: the full #31 (the 2a minimal tab's rows kept: Lock now, About) and #38 about.
async function openSettings(o: Parameters<typeof renderApp>[0] = {}) {
  const r = await renderApp(o);
  await screen.findByText('TOKENS');
  fireEvent.click(screen.getByRole('button', {name: 'Settings'}));
  await screen.findByRole('heading', {name: 'Settings'});
  return r;
}

describe('Settings (#31, B1b-2b §4.1)', () => {
  it('the groups and rows the extension has (D22): Account › Profile; Security › Security center, Passkey, Change password, Recovery phrase, Lock now; Connections › Address book (plan 2); Advanced › Delete wallet; About', async () => {
    await openSettings();
    expect(screen.getAllByText(/^(Account|Security|Connections|Advanced|About)$/).map(e => e.textContent)).toEqual(['Account', 'Security', 'Connections', 'Advanced', 'About']);
    expect([...document.querySelectorAll('.s7-row .s7-title')].map(e => e.textContent)).toEqual([
      'Profile', 'Security center', 'Passkey', 'Change password', 'Recovery phrase', 'Lock now', 'Address book', 'Delete wallet', 'About Noctura',
    ]);
    expect(screen.getByText('v0.1.0')).toBeTruthy();
    for (const gone of ['Currency', 'Notifications', 'Material You accent', 'RPC endpoint', 'Connected dApps', 'Air-gap signing', 'Export transaction history', 'Diagnostics', 'Backup & restore', 'Biometric unlock', 'Change PIN', 'Accounts']) {
      expect(screen.queryByText(gone)).toBeNull();
    }
    expect(document.querySelector('.s7-row.danger .s7-title')?.textContent).toBe('Delete wallet');
  });

  it('31a, no passkey: the tip (O42), Profile = the selected account, "3 to do" and "Off" in --warning, "Not verified"', async () => {
    await openSettings();
    expect(document.querySelector('.s7-tip p')?.textContent).toBe('Tip — add a passkey to unlock with your fingerprint, face or security key. Your password always works too.');
    const meta = (t: string) => screen.getByText(t, {selector: '.s7-title'}).parentElement?.querySelector('.s7-meta');
    expect(meta('Profile')?.textContent).toBe('Main');
    await waitFor(() => expect(meta('Security center')?.textContent).toBe('3 to do'));
    expect(meta('Security center')?.classList.contains('noc-warning')).toBe(true);
    expect(meta('Passkey')?.textContent).toBe('Off');
    expect(meta('Passkey')?.classList.contains('noc-warning')).toBe(true);
    expect(meta('Recovery phrase')?.textContent).toBe('Not verified');
    expect(meta('Recovery phrase')?.classList.contains('noc-warning')).toBe(true);
    expect(unstyledClasses(document.querySelector('.app-content .screen')!, SELECTORS)).toEqual([]);
  });

  it('passkey on and the phrase verified: no tip; "All done" in --success, "On", "Verified" in --fg-secondary', async () => {
    await openSettings({env: WITH_PASSKEY, before: async ext => ext.local.set(SETTINGS_KEY, {phraseVerifiedAt: 1})});
    const meta = (t: string) => screen.getByText(t, {selector: '.s7-title'}).parentElement?.querySelector('.s7-meta');
    await waitFor(() => expect(meta('Security center')?.textContent).toBe('All done'));
    expect(meta('Security center')?.classList.contains('noc-success')).toBe(true);
    expect(meta('Passkey')?.textContent).toBe('On');
    expect(meta('Recovery phrase')?.textContent).toBe('Verified');
    expect(meta('Recovery phrase')?.className).toBe('s7-meta');
    expect(document.querySelector('.s7-tip')).toBeNull();
  });

  it('the rows go where §4.1 says: Profile → the accounts manager; Security center → #35; Passkey → the passkey screen; Delete wallet → #37', async () => {
    await openSettings();
    fireEvent.click(screen.getByText('Profile'));
    expect(await screen.findByRole('button', {name: 'Move Main down'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    fireEvent.click(await screen.findByText('Security center'));
    expect(await screen.findByText('Locks')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    fireEvent.click(await screen.findByText('Passkey', {selector: '.s7-title'}));
    expect(await screen.findByRole('heading', {name: 'Unlock Noctura with a passkey'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    fireEvent.click(await screen.findByText('Delete wallet', {selector: '.s7-title'}));
    expect(await screen.findByText('Delete this wallet?')).toBeTruthy();
  });

  it('Change password and Recovery phrase open their vault pages and the popup closes', async () => {
    const w = await openSettings();
    fireEvent.click(screen.getByText('Change password'));
    expect(w.platform.opened).toEqual(['unlock.html?mode=password']);
    expect(w.platform.closed).toBe(1);
    fireEvent.click(screen.getByText('Recovery phrase'));
    expect(w.platform.opened).toEqual(['unlock.html?mode=password', 'unlock.html?mode=reveal']);
  });

  // The toast's and the decoration's lengths are shortened for the test, but not to a few ms: a timer shorter than a busy
  // run's observer tick removed the toast before findByText saw it (a flake seen once in the implementation).
  it('36e (C10): a password changed in the last ten minutes — the toast and "Just updated" once; the next open shows neither', async () => {
    localStorage.clear();
    const now = Date.now();
    const settings = {passwordChangedAt: now - 60_000};
    const w = await setupWallet({before: async ext => ext.local.set(SETTINGS_KEY, settings)});
    const {unmount} = render(
      <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} toastMs={400} decorateMs={800} />
      </WalletProvider>,
    );
    expect(await screen.findByText('Password updated')).toBeTruthy();
    const row = screen.getByText('Change password').closest('.s7-row');
    expect(row?.classList.contains('app-just-updated')).toBe(true);
    expect(row?.querySelector('.s7-meta')?.textContent).toBe('Just updated');
    expect(row?.querySelector('.s7-meta')?.classList.contains('noc-success')).toBe(true);
    expect(unstyledClasses(document.querySelector('.s7-toast')!, SELECTORS)).toEqual([]);
    await waitFor(() => expect(screen.queryByText('Password updated')).toBeNull());
    await waitFor(() => expect(screen.getByText('Change password').closest('.s7-row')?.classList.contains('app-just-updated')).toBe(false));
    unmount();
    render(
      <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} />
      </WalletProvider>,
    );
    await screen.findByText('Change password');
    await new Promise(r => setTimeout(r, 30));
    expect(screen.queryByText('Password updated')).toBeNull();
  });

  it('36e: a change older than ten minutes shows nothing', async () => {
    localStorage.clear();
    const w = await setupWallet({before: async ext => ext.local.set(SETTINGS_KEY, {passwordChangedAt: Date.now() - 11 * 60_000})});
    render(
      <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} />
      </WalletProvider>,
    );
    await screen.findByText('Change password');
    await new Promise(r => setTimeout(r, 30));
    expect(screen.queryByText('Password updated')).toBeNull();
  });

  it('Lock now locks the wallet and shows the locked screen', async () => {
    const {ext} = await openSettings();
    fireEvent.click(screen.getByText('Lock now'));
    expect(await screen.findByText('Welcome back')).toBeTruthy();
    expect(await getSession(ext)).toBeNull();
  });

  it('#38 about: the wordmark, the adapted line, the version, the site as text, the licence', async () => {
    await openSettings();
    fireEvent.click(screen.getByText('About Noctura'));
    expect(await screen.findByText('Solana wallet for your browser — your keys stay on this device.')).toBeTruthy();
    expect(document.querySelector('.s7-wordmark')?.textContent).toBe('noctura.');
    expect(screen.getByText('noc-tura.io').closest('a')).toBeNull();
    expect(screen.getByText('© 2026 Noctura')).toBeTruthy();
    expect(screen.getByText(/BSL 1\.1 · converts to MIT on/)).toBeTruthy();
    for (const gone of ['Terms of Service', 'Privacy Policy', 'Open-source licenses', 'Help & support', 'shielded']) expect(screen.queryByText(new RegExp(gone))).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    await waitFor(() => expect(screen.getByRole('heading', {name: 'Settings'})).toBeTruthy());
  });

  // Review M3 / spec §7.6: "Lock now" is a LockedButton — a second click inside 500 ms, or before the
  // lock settles, does nothing.
  async function withSlowLock(settle: 'now' | 'never') {
    const w = await setupWallet();
    let locks = 0;
    const engine = {...w.engine, lock: () => (locks++, settle === 'now' ? Promise.resolve({ok: true as const, data: null}) : new Promise<never>(() => undefined))};
    render(<App surface="popup" engine={engine} platform={w.platform} />);
    fireEvent.click(await screen.findByRole('button', {name: 'Settings'}));
    return {count: () => locks};
  }

  it('Lock now: a second click inside 500 ms does nothing', async () => {
    const {count} = await withSlowLock('now');
    const button = await screen.findByRole('button', {name: /Lock now/});
    fireEvent.click(button);
    // The lock has settled; the 500 ms floor has not passed.
    await new Promise(r => setTimeout(r, 50));
    fireEvent.click(button);
    expect(count()).toBe(1);
  });

  it('Lock now: a second click after 500 ms but before the lock settles does nothing', async () => {
    const {count} = await withSlowLock('never');
    const button = await screen.findByRole('button', {name: /Lock now/});
    fireEvent.click(button);
    await new Promise(r => setTimeout(r, 600));
    fireEvent.click(button);
    expect(count()).toBe(1);
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  // Task 16 review, fix round 1 #6 (ruling, rule 7): Lock now never fails silently.
  const LOCK_FAILED = 'Could not lock the wallet. Try again.';
  async function withLock(lock: () => Promise<{ok: true; data: null} | {ok: false; error: 'failed'}>) {
    const w = await setupWallet();
    const engine = {...w.engine, lock};
    render(<App surface="popup" engine={engine} platform={w.platform} />);
    fireEvent.click(await screen.findByRole('button', {name: 'Settings'}));
    const button = await screen.findByRole('button', {name: /Lock now/});
    fireEvent.click(button);
    return button as HTMLButtonElement;
  }

  it('a failed vault.lock: the danger line, still Settings, the button back after the floor', async () => {
    const button = await withLock(async () => ({ok: false, error: 'failed'}));
    expect((await screen.findByRole('alert')).textContent).toBe(LOCK_FAILED);
    expect(screen.getByRole('heading', {name: 'Settings'})).toBeTruthy();
    await waitFor(() => expect(button.disabled).toBe(false), {timeout: 2_000});
  });

  it('a lock that answered ok but left the wallet unlocked: the same line', async () => {
    await withLock(async () => ({ok: true, data: null}));
    expect((await screen.findByRole('alert')).textContent).toBe(LOCK_FAILED);
    expect(screen.queryByText('Welcome back')).toBeNull();
  });

  it('a lock that worked shows no failure line', async () => {
    await openSettings();
    fireEvent.click(screen.getByText('Lock now'));
    expect(await screen.findByText('Welcome back')).toBeTruthy();
    expect(screen.queryByText(LOCK_FAILED)).toBeNull();
  });

  // Rule 6 (spec §7, every #31 row that opens something): a second tap inside 500 ms — with `disabled` lifted, since
  // happy-dom drops clicks on a disabled button — opens nothing twice.
  async function rows() {
    localStorage.clear();
    const w = await setupWallet();
    const calls = {profile: 0, security: 0, passkey: 0, del: 0, about: 0, contacts: 0};
    render(
      <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
        <Settings
          onProfile={() => void calls.profile++}
          onSecurity={() => void calls.security++}
          onPasskey={() => void calls.passkey++}
          onDelete={() => void calls.del++}
          onAbout={() => void calls.about++}
          onContacts={() => void calls.contacts++}
        />
      </WalletProvider>,
    );
    await waitFor(() => expect(screen.getByText('Security center').parentElement?.querySelector('.s7-meta')?.textContent).toBe('3 to do'));
    return {w, calls};
  }
  const twice = (title: string) => {
    const button = screen.getByText(title, {selector: '.s7-title'}).closest('button') as HTMLButtonElement;
    fireEvent.click(button);
    button.disabled = false;
    fireEvent.click(button);
  };

  it('rule 6: Profile, Security center, Passkey, Address book, Delete wallet and About each fire once for two taps inside 500 ms', async () => {
    const {calls} = await rows();
    for (const t of ['Profile', 'Security center', 'Passkey', 'Address book', 'Delete wallet', 'About Noctura']) twice(t);
    expect(calls).toEqual({profile: 1, security: 1, passkey: 1, del: 1, about: 1, contacts: 1});
  });

  // Plan 2 (§4.1, ix:13552): the Address book row's meta is the book's size; a refused read leaves it empty.
  it.each([
    [0, '0 contacts'],
    [1, '1 contact'],
    [7, '7 contacts'],
  ])('Address book meta with %i saved: "%s"', async (n, text) => {
    await openSettings({
      before: ext =>
        ext.local.set(
          CONTACTS_KEY,
          Array.from({length: n}, (_, i) => ({address: base58.encode(Uint8Array.from({length: 32}, (_, j) => (j === 0 ? i + 1 : 7))), name: `C${i}`})),
        ),
    });
    const meta = () => screen.getByText('Address book', {selector: '.s7-title'}).parentElement?.querySelector('.s7-meta');
    await waitFor(() => expect(meta()?.textContent).toBe(text));
    expect(meta()?.classList.contains('noc-warning')).toBe(false);
  });

  it('Address book: a refused contacts.list leaves the meta empty, and the row still opens #15', async () => {
    await openSettings({
      gate: m => {
        if ((m as {type: string}).type === 'contacts.list') throw new Error('worker restarting');
      },
    });
    const row = screen.getByText('Address book', {selector: '.s7-title'});
    await waitFor(() => expect(screen.getByText('Security center', {selector: '.s7-title'}).parentElement?.querySelector('.s7-meta')?.textContent).toBe('3 to do'));
    expect(row.parentElement?.querySelector('.s7-meta')?.textContent).toBe('');
    fireEvent.click(row);
    expect(await screen.findByText('Address book', {selector: '.top-bar .title'})).toBeTruthy();
  });

  it('rule 6: Change password and Recovery phrase each open their page once for two taps inside 500 ms', async () => {
    const {w} = await rows();
    twice('Change password');
    twice('Recovery phrase');
    expect(w.platform.opened).toEqual(['unlock.html?mode=password', 'unlock.html?mode=reveal']);
  });

  it('36e: a settings read answered after #31 went shows, remembers and decorates nothing', async () => {
    localStorage.clear();
    const w = await setupWallet({before: async ext => ext.local.set(SETTINGS_KEY, {passwordChangedAt: Date.now() - 60_000})});
    let answer: () => void = noop;
    const engine = {
      ...w.engine,
      settings: () => new Promise<Awaited<ReturnType<typeof w.engine.settings>>>(resolve => (answer = () => void w.engine.settings().then(resolve))),
    };
    const {unmount} = render(
      <WalletProvider engine={engine} platform={w.platform} surface="popup">
        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} />
      </WalletProvider>,
    );
    await screen.findByText('Change password');
    unmount();
    answer();
    await new Promise(r => setTimeout(r, 50));
    expect(readPref(PASSWORD_TOAST_KEY)).toBeNull();
    expect(screen.queryByText('Password updated')).toBeNull();
  });

  // Fix round 1 (review I1): the 36e border has to WIN the cascade, not just be named. happy-dom cascades by specificity but
  // cannot parse color-mix(), so the real app.css is loaded with each color-mix(…) swapped for a plain colour: the selectors
  // and their order are app.css's own. The row reset `.app-content button.s7-row { border: 0 }` beat `.s7-row.app-just-updated`.
  it('36e: app.css gives the decorated row its 1 px border over the row reset (computed, real selectors)', () => {
    const swap = (css: string): string => {
      let out = '';
      for (let i = 0; i < css.length; ) {
        if (!css.startsWith('color-mix(', i)) {
          out += css[i++];
          continue;
        }
        let depth = 0;
        let j = i + 'color-mix'.length;
        do {
          if (css[j] === '(') depth++;
          else if (css[j] === ')') depth--;
          j++;
        } while (depth > 0);
        out += 'rgb(0, 128, 0)';
        i = j;
      }
      return out;
    };
    const style = document.createElement('style');
    style.textContent = swap(readFileSync(join(__dirname, '..', 'app.css'), 'utf8'));
    document.head.append(style);
    document.body.innerHTML = '<main class="app-content"><button class="s7-row app-just-updated">a</button><button class="s7-row">b</button></main>';
    const [decorated, plain] = [...document.querySelectorAll('button')] as HTMLButtonElement[];
    expect(getComputedStyle(decorated!).borderTopWidth).toBe('1px');
    expect(getComputedStyle(decorated!).borderTopStyle).toBe('solid');
    expect(getComputedStyle(plain!).borderTopWidth).toBe('0px');
    style.remove();
    document.body.innerHTML = '';
  });

  it('36e: a passwordChangedAt in the future (a clock set back) shows no toast and remembers nothing (fix round 1, m4)', async () => {
    localStorage.clear();
    const w = await setupWallet({before: async ext => ext.local.set(SETTINGS_KEY, {passwordChangedAt: Date.now() + 60_000})});
    render(
      <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} />
      </WalletProvider>,
    );
    await waitFor(() => expect(screen.getByText('Security center').parentElement?.querySelector('.s7-meta')?.textContent).toBe('3 to do'));
    await new Promise(r => setTimeout(r, 30));
    expect(screen.queryByText('Password updated')).toBeNull();
    expect(screen.getByText('Change password').closest('.s7-row')?.classList.contains('app-just-updated')).toBe(false);
    expect(readPref(PASSWORD_TOAST_KEY)).toBeNull();
  });

  it('no wallet state yet: the Passkey row has no meta (not "Off") and no tip (fix round 1, m5)', async () => {
    localStorage.clear();
    const w = await setupWallet();
    const engine = {...w.engine, state: () => new Promise<never>(() => undefined)};
    render(
      <WalletProvider engine={engine} platform={w.platform} surface="popup">
        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} />
      </WalletProvider>,
    );
    await waitFor(() => expect(screen.getByText('Security center').parentElement?.querySelector('.s7-meta')?.textContent).not.toBe(''));
    const meta = screen.getByText('Passkey', {selector: '.s7-title'}).parentElement?.querySelector('.s7-meta');
    expect(meta?.textContent).toBe('');
    expect(meta?.className).toBe('s7-meta');
    expect(document.querySelector('.s7-tip')).toBeNull();
  });

  // Fix round 1 (m1): the tab stays open, so it reads the facts again when shown again; the popup reads them on open.
  async function onSurface(surface: 'popup' | 'tab') {
    localStorage.clear();
    const w = await setupWallet();
    let reads = 0;
    const engine = {...w.engine, settings: () => (reads++, w.engine.settings())};
    const r = render(
      <WalletProvider engine={engine} platform={w.platform} surface={surface}>
        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} />
      </WalletProvider>,
    );
    const meta = (t: string) => screen.getByText(t, {selector: '.s7-title'}).parentElement?.querySelector('.s7-meta');
    await waitFor(() => expect(meta('Recovery phrase')?.textContent).toBe('Not verified'));
    // Meanwhile, in the vault tab: the phrase verified and the password changed.
    await w.ext.local.set(SETTINGS_KEY, {phraseVerifiedAt: 1, passwordChangedAt: Date.now() - 1_000});
    return {...r, meta, reads: () => reads};
  }

  it('tab: shown again (visibilitychange → visible, or focus), #31 reads the facts again — "Verified" and 36e', async () => {
    const {meta} = await onSurface('tab');
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(meta('Recovery phrase')?.textContent).toBe('Verified'));
    expect(await screen.findByText('Password updated')).toBeTruthy();
    expect(meta('Security center')?.textContent).toBe('1 to do');
  });

  it('tab: a window focus reads them again too', async () => {
    const {meta} = await onSurface('tab');
    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(meta('Recovery phrase')?.textContent).toBe('Verified'));
  });

  it('tab: once #31 is gone, being shown again reads nothing', async () => {
    const {unmount, reads} = await onSurface('tab');
    const before = reads();
    unmount();
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    await new Promise(r => setTimeout(r, 30));
    expect(reads()).toBe(before);
  });

  it('tab: a re-read overtaken by a newer one sets nothing from the older answer', async () => {
    localStorage.clear();
    const w = await setupWallet();
    const answers: (() => void)[] = [];
    let first = true;
    const engine = {
      ...w.engine,
      settings: () => {
        if (first) return (first = false), w.engine.settings();
        return new Promise<Awaited<ReturnType<typeof w.engine.settings>>>(resolve => {
          const at = answers.length;
          answers.push(() => void w.engine.settings().then(r => resolve(r.ok && at === 0 ? {...r, data: {...r.data, phraseVerifiedAt: null}} : r)));
        });
      },
    };
    render(
      <WalletProvider engine={engine} platform={w.platform} surface="tab">
        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} />
      </WalletProvider>,
    );
    const meta = () => screen.getByText('Recovery phrase', {selector: '.s7-title'}).parentElement?.querySelector('.s7-meta');
    await waitFor(() => expect(meta()?.textContent).toBe('Not verified'));
    await w.ext.local.set(SETTINGS_KEY, {phraseVerifiedAt: 1});
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    expect(answers).toHaveLength(2);
    answers[1]!();
    await waitFor(() => expect(meta()?.textContent).toBe('Verified'));
    // The older read answers last (rewritten to "not verified"): it is dropped.
    answers[0]!();
    await new Promise(r => setTimeout(r, 30));
    expect(meta()?.textContent).toBe('Verified');
  });

  it('popup: being shown again reads nothing more (a popup reads on every open)', async () => {
    const {reads, meta} = await onSurface('popup');
    const before = reads();
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    await new Promise(r => setTimeout(r, 30));
    expect(reads()).toBe(before);
    expect(meta('Recovery phrase')?.textContent).toBe('Not verified');
  });
});
