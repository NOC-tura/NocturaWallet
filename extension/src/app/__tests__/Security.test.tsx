// @vitest-environment happy-dom
import {act, cleanup, render, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {base64} from '@scure/base';
import {Security, dollars, securityTasks} from '../screens/Security';
import {WalletProvider, useWallet, type WalletModel} from '../WalletContext';
import {ENV, renderInWallet, setupWallet} from './harness';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {SETTINGS_KEY} from '../../background/settings';

// B1b-2b §4.2 (#35; D1–D5, C8, C15, E9).
const SELECTORS = selectorsOf(UI_SHEETS);
const B = (n: number) => base64.encode(new Uint8Array(n).fill(1));
const WITH_PASSKEY = {...ENV, passkey: {credentialId: B(16), prfSalt: B(32), wrapped: B(40)}};
async function shown(o: Parameters<typeof renderInWallet>[1] = {}) {
  const calls = {passkey: 0, delete: 0, back: 0};
  const w = await renderInWallet(<Security onBack={() => void calls.back++} onPasskey={() => void calls.passkey++} onDelete={() => void calls.delete++} />, o);
  await screen.findByText('Security center', {selector: '.top-bar .title'});
  return {...w, calls};
}
const meta = (title: string) => screen.getByText(title, {selector: '.s7-title'}).parentElement?.querySelector('.s7-meta');

describe('#35 security center', () => {
  it('securityTasks: both phrase rows follow the one fact (C8); the passkey row the passkey', () => {
    expect(securityTasks(false, null)).toEqual(['write', 'verify', 'passkey']);
    expect(securityTasks(true, null)).toEqual(['write', 'verify']);
    expect(securityTasks(false, 5)).toEqual(['passkey']);
    expect(securityTasks(true, 5)).toEqual([]);
    expect([dollars(5_000), dollars(100_000), dollars(1_250)]).toEqual(['$50', '$1,000', '$12.50']);
  });

  it('35a tasks outstanding: the ring-less card (C15), the three tasks, Locks, the danger zone — no score, no "Never", no staking, no air-gap', async () => {
    await shown();
    expect(screen.getByText('Improve your security')).toBeTruthy();
    expect(screen.getByText('3 outstanding tasks.')).toBeTruthy();
    expect(screen.getByText('Outstanding tasks')).toBeTruthy();
    expect([...document.querySelectorAll('.s7-task .label')].map(e => e.textContent)).toEqual(['Write down your recovery phrase', 'Verify recovery phrase', 'Add a passkey']);
    expect(screen.queryByText('Active protections')).toBeNull();
    expect(meta('Auto-lock')?.textContent).toBe('5 min');
    expect(screen.getByText('Locks when the browser closes')).toBeTruthy();
    expect(meta('Re-authentication threshold')?.textContent).toBe('$100');
    expect(meta('Passkey')?.textContent).toBe('Off');
    expect(meta('Passkey')?.classList.contains('noc-warning')).toBe(true);
    expect(screen.getByText('Change password')).toBeTruthy();
    expect(screen.getByText('Danger zone')).toBeTruthy();
    expect(screen.getByText("Removes the encrypted keys and local data from this browser. To restore, you'll need your recovery phrase.")).toBeTruthy();
    expect(document.querySelector('.s7-ring')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Never|\/ 100|Score|staking|Air-gap|App-lock timer|Immediately/);
    expect(unstyledClasses(document.querySelector('.screen')!, SELECTORS)).toEqual([]);
  });

  it('the tasks open their pages (the popup closes); "Add a passkey" pushes the passkey screen', async () => {
    const w = await shown();
    fireEvent.click(screen.getByText('Write down your recovery phrase'));
    expect(w.platform.opened).toEqual(['unlock.html?mode=reveal']);
    expect(w.platform.closed).toBe(1);
    await new Promise(r => setTimeout(r, 0));
    fireEvent.click(screen.getByText('Verify recovery phrase'));
    expect(w.platform.opened).toEqual(['unlock.html?mode=reveal', 'unlock.html?mode=verify']);
    fireEvent.click(screen.getByText('Add a passkey'));
    expect(w.calls.passkey).toBe(1);
  });

  it('35b all clear: "Looks great" / "All checks pass."; Active protections, every meta --success; no tasks', async () => {
    await shown({env: WITH_PASSKEY, before: async ext => ext.local.set(SETTINGS_KEY, {phraseVerifiedAt: 5})});
    expect(screen.getByText('Looks great')).toBeTruthy();
    expect(screen.getByText('All checks pass.')).toBeTruthy();
    expect(screen.queryByText('Outstanding tasks')).toBeNull();
    const protections = screen.getByText('Active protections').nextElementSibling as HTMLElement;
    expect([...protections.querySelectorAll('.s7-row')].map(r => [r.querySelector('.s7-title')?.textContent, r.querySelector('.s7-meta')?.textContent, r.querySelector('.s7-meta')?.classList.contains('noc-success')])).toEqual([
      ['Auto-lock', '5 min', true],
      ['Passkey', 'On', true],
      ['Recovery phrase verified', 'Yes', true],
    ]);
  });

  it('35c: the Auto-lock row opens its card — 1 / 5 / 15 / 60 min (D1), the current one selected, O47', async () => {
    await shown();
    fireEvent.click(screen.getByText('Auto-lock', {selector: '.s7-title'}));
    const card = document.querySelector('.app-picker-card') as HTMLElement;
    expect(within(card).getByText('When idle, lock the wallet after')).toBeTruthy();
    expect([...card.querySelectorAll('.opt')].map(o => [o.textContent, o.getAttribute('aria-pressed')])).toEqual([
      ['1 min', 'false'],
      ['5 min', 'true'],
      ['15 min', 'false'],
      ['60 min', 'false'],
    ]);
    expect(within(card).getByText('A longer time asks for your password in a new tab.')).toBeTruthy();
    expect(unstyledClasses(card, SELECTORS)).toEqual([]);
  });

  it('strengthening (1 min) is written at once and the meta follows; nothing opens', async () => {
    const w = await shown();
    fireEvent.click(screen.getByText('Auto-lock', {selector: '.s7-title'}));
    fireEvent.click(screen.getByRole('button', {name: '1 min'}));
    await waitFor(() => expect(meta('Auto-lock')?.textContent).toBe('1 min'));
    expect(await w.ext.local.get(SETTINGS_KEY)).toMatchObject({autoLockMinutes: 1});
    expect(w.platform.opened).toEqual([]);
  });

  it('weakening (15 min) opens #10 for the background’s challenge and closes; the stored value is unchanged', async () => {
    const w = await shown();
    fireEvent.click(screen.getByText('Auto-lock', {selector: '.s7-title'}));
    fireEvent.click(screen.getByRole('button', {name: '15 min'}));
    await waitFor(() => expect(w.platform.opened).toHaveLength(1));
    expect(w.platform.opened[0]).toMatch(/^unlock\.html\?mode=reauth&challenge=[0-9a-f]{32}$/);
    expect(w.platform.closed).toBe(1);
    expect(await w.ext.local.get(SETTINGS_KEY)).toBeUndefined();
  });

  it('the threshold card (D5): $50 / $100 / $500 / $1,000, O48–O50; $500 is a weakening', async () => {
    const w = await shown();
    fireEvent.click(screen.getByText('Re-authentication threshold', {selector: '.s7-title'}));
    const card = document.querySelector('.app-picker-card') as HTMLElement;
    expect(within(card).getByText('Ask for your password before sends worth more than')).toBeTruthy();
    expect(within(card).getByText('A higher amount asks for your password in a new tab.')).toBeTruthy();
    expect([...card.querySelectorAll('.opt')].map(o => o.textContent)).toEqual(['$50', '$100', '$500', '$1,000']);
    fireEvent.click(within(card).getByRole('button', {name: '$500'}));
    await waitFor(() => expect(w.platform.opened[0]).toMatch(/mode=reauth/));
  });

  it('value not a preset: the stored value as the meta, no option selected', async () => {
    await shown({before: async ext => ext.local.set(SETTINGS_KEY, {autoLockMinutes: 7, reauthUsdCents: 25_000})});
    expect(meta('Auto-lock')?.textContent).toBe('7 min');
    expect(meta('Re-authentication threshold')?.textContent).toBe('$250');
    fireEvent.click(screen.getByText('Auto-lock', {selector: '.s7-title'}));
    expect(document.querySelectorAll('.app-picker-card .opt.sel')).toHaveLength(0);
  });

  it('setting failed: O51, and the picker keeps the stored value', async () => {
    const w = await setupWallet();
    const engine = {...w.engine, settingsSet: async () => ({ok: false as const, error: 'failed' as const})};
    render(
      <WalletProvider engine={engine} platform={w.platform} surface="popup">
        <Security onBack={() => undefined} onPasskey={() => undefined} onDelete={() => undefined} />
      </WalletProvider>,
    );
    fireEvent.click(await screen.findByText('Auto-lock', {selector: '.s7-title'}));
    fireEvent.click(screen.getByRole('button', {name: '1 min'}));
    expect(await screen.findByText('Could not save the setting. Try again.')).toBeTruthy();
    expect(screen.getByRole('button', {name: '5 min'}).getAttribute('aria-pressed')).toBe('true');
  });

  it('rule 6: a second option click inside 500 ms writes nothing more', async () => {
    let sets = 0;
    await shown({gate: m => void ((m as {type: string}).type === 'settings.set' && sets++)});
    fireEvent.click(screen.getByText('Auto-lock', {selector: '.s7-title'}));
    const one = screen.getByRole('button', {name: '1 min'}) as HTMLButtonElement;
    fireEvent.click(one);
    one.disabled = false;
    fireEvent.click(one);
    await new Promise(r => setTimeout(r, 30));
    expect(sets).toBe(1);
  });

  it('Change password opens #36; the danger card’s [Delete wallet] pushes #37; Passkey pushes the passkey screen', async () => {
    const w = await shown();
    fireEvent.click(screen.getByText('Change password'));
    expect(w.platform.opened).toEqual(['unlock.html?mode=password']);
    fireEvent.click(screen.getByRole('button', {name: 'Delete wallet'}));
    expect(w.calls.delete).toBe(1);
    fireEvent.click(screen.getByText('Passkey', {selector: '.s7-title'}));
    expect(w.calls.passkey).toBe(1);
  });

  it('35b: "Recovery phrase verified" opens ?mode=verify through a LockedButton (rule 6, pre-flight F9)', async () => {
    const w = await shown({env: WITH_PASSKEY, before: async ext => ext.local.set(SETTINGS_KEY, {phraseVerifiedAt: 5})});
    const row = screen.getByText('Recovery phrase verified', {selector: '.s7-title'}).closest('button') as HTMLButtonElement;
    fireEvent.click(row);
    expect(w.platform.opened).toEqual(['unlock.html?mode=verify']);
    row.disabled = false;
    fireEvent.click(row);
    expect(w.platform.opened).toEqual(['unlock.html?mode=verify']);
  });

  it('35b: the protections’ glyphs are --success too (ix:14486-14489)', async () => {
    await shown({env: WITH_PASSKEY, before: async ext => ext.local.set(SETTINGS_KEY, {phraseVerifiedAt: 5})});
    const protections = screen.getByText('Active protections').nextElementSibling as HTMLElement;
    expect(protections.classList.contains('app-protections')).toBe(true);
    expect(unstyledClasses(protections, SELECTORS)).toEqual([]);
  });

  it('1 outstanding task (O89): the singular', async () => {
    await shown({env: WITH_PASSKEY});
    expect(screen.getByText('2 outstanding tasks.')).toBeTruthy();
    cleanup();
    await shown({before: async ext => ext.local.set(SETTINGS_KEY, {phraseVerifiedAt: 5})});
    expect(screen.getByText('1 outstanding task.')).toBeTruthy();
    expect([...document.querySelectorAll('.s7-task .label')].map(e => e.textContent)).toEqual(['Add a passkey']);
  });

  it('the app-lock row is static (D2): no button, no chevron', async () => {
    await shown();
    const row = screen.getByText('Locks when the browser closes').closest('.s7-row') as HTMLElement;
    expect(row.tagName).toBe('DIV');
    expect(row.querySelector('.s7-chev')).toBeNull();
    expect(row.closest('button')).toBeNull();
  });

  it('rule 6: the task rows, Change password and [Delete wallet] refuse a second click inside 500 ms', async () => {
    const w = await shown();
    const write = screen.getByText('Write down your recovery phrase').closest('button') as HTMLButtonElement;
    fireEvent.click(write);
    write.disabled = false;
    fireEvent.click(write);
    const pw = screen.getByText('Change password').closest('button') as HTMLButtonElement;
    fireEvent.click(pw);
    pw.disabled = false;
    fireEvent.click(pw);
    expect(w.platform.opened).toEqual(['unlock.html?mode=reveal', 'unlock.html?mode=password']);
    const del = screen.getByRole('button', {name: 'Delete wallet'}) as HTMLButtonElement;
    fireEvent.click(del);
    del.disabled = false;
    fireEvent.click(del);
    expect(w.calls.delete).toBe(1);
  });

  /** A weakening (15 min) whose reauth-required answer is held: the background's reply, delivered when the test says. */
  async function heldWeakening() {
    let release: () => void = () => undefined;
    let held = false;
    let current: WalletModel | null = null;
    function Probe() {
      current = useWallet();
      return null;
    }
    const w = await setupWallet();
    const engine = {
      ...w.engine,
      settingsSet: async () => {
        held = true;
        await new Promise<void>(r => (release = r));
        return {ok: false as const, error: 'reauth-required' as const, data: {challengeId: 'a'.repeat(32)}};
      },
    };
    render(
      <WalletProvider engine={engine} platform={w.platform} surface="popup">
        <Security onBack={() => undefined} onPasskey={() => undefined} onDelete={() => undefined} />
        <Probe />
      </WalletProvider>,
    );
    fireEvent.click(await screen.findByText('Auto-lock', {selector: '.s7-title'}));
    fireEvent.click(screen.getByRole('button', {name: '15 min'}));
    await waitFor(() => expect(held).toBe(true));
    const model = (): WalletModel => {
      if (current === null) throw new Error('no model yet');
      return current;
    };
    return {...w, release: () => release(), model};
  }

  it('the held weakening, released while here, opens #10 (the positive control of the two below)', async () => {
    const w = await heldWeakening();
    w.release();
    await waitFor(() => expect(w.platform.opened).toEqual([`unlock.html?mode=reauth&challenge=${'a'.repeat(32)}`]));
    expect(w.platform.closed).toBe(1);
  });

  it('alive: a weakening answered after the screen went opens nothing and closes nothing', async () => {
    const w = await heldWeakening();
    cleanup();
    w.release();
    await new Promise(r => setTimeout(r, 30));
    expect(w.platform.opened).toEqual([]);
    expect(w.platform.closed).toBe(0);
  });

  it('alive: an answer after a lock meanwhile opens nothing and shows no error', async () => {
    const w = await heldWeakening();
    await act(async () => void (await w.model().lock()));
    await waitFor(() => expect(w.model().phase).toBe('locked'));
    w.release();
    await act(async () => new Promise(r => setTimeout(r, 30)));
    expect(w.platform.opened).toEqual([]);
    expect(screen.queryByText('Could not save the setting. Try again.')).toBeNull();
  });
});
