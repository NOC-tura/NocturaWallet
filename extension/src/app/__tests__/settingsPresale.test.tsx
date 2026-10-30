// @vitest-environment happy-dom
import {act, fireEvent, screen} from '@testing-library/react';
import {renderApp} from './appHarness';
import {drainInFlight} from './harness';
import {registerPresale} from '../../background/presale/api';
import {registerPresaleHandler} from '../../background/messages';
import {fakeDeps} from '../../background/__tests__/fakeDeps';
import {fakeExt} from '../../background/__tests__/fakeExt';
import {ACCOUNT, allocationData, program} from '../../background/presale/__tests__/chain';
import {purchaseWorld} from '../presale/__tests__/world';

registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});

// B1d-2 Task 4 (C16, §1.1, §4.4): #31's "Refer a friend" row into #24, in the whole App against the REAL background.
// This file runs in both vitest runs: the build with presale shows the row in its own group and opens #24; the build
// without it has neither the group nor the row, and sends no presale message.
const off = process.env.NOCTURA_PRESALE === '0';
const types = (sent: unknown[]) => sent.map(m => (m as {type: string}).type);
const settled = () =>
  act(async () => {
    await new Promise<void>(r => setTimeout(r, 0));
    await drainInFlight();
    await new Promise<void>(r => setTimeout(r, 0));
  });
const groups = () => [...document.querySelectorAll('.s7-group-label')].map(e => e.textContent);
const rows = () => [...document.querySelectorAll('.s7-row .s7-title')].map(e => e.textContent);
const ROWS = ['Profile', 'Security center', 'Passkey', 'Change password', 'Recovery phrase', 'Lock now', 'Connected dApps', 'Address book', 'Delete wallet', 'About Noctura'];

async function settings() {
  const sent: unknown[] = [];
  const w = purchaseWorld({chain: {allocation: program(allocationData({bonus: 16_142_571_618n}))}});
  await renderApp({
    ...w.options,
    deps: {...w.options.deps, getJson: async () => ({success: true, data: {totalReferrals: 3, totalReferredUsd: 1234.56}})},
    spy: m => void sent.push(m),
  });
  await screen.findByText('TOKENS');
  fireEvent.click(screen.getByRole('button', {name: 'Settings'}));
  await screen.findByRole('heading', {name: 'Settings'});
  await settled();
  return sent;
}

describe(`#31's presale row in this build (${off ? 'off' : 'on'})`, () => {
  it(off ? 'off: no Rewards group and no "Refer a friend" — the rows of B1d-1b exactly — and no presale.referral' : 'on: Rewards › Refer a friend after Connections; the tap opens #24, which asks presale.referral; Back → #31', async () => {
    const sent = await settings();
    if (off) {
      expect(groups()).toEqual(['Account', 'Security', 'Connections', 'Advanced', 'About']);
      expect(rows()).toEqual(ROWS);
      expect(screen.queryByText('Refer a friend')).toBeNull();
      expect(types(sent).filter(t => t === 'presale.referral')).toEqual([]);
      return;
    }
    expect(groups()).toEqual(['Account', 'Security', 'Connections', 'Rewards', 'Advanced', 'About']);
    expect(rows()).toEqual([...ROWS.slice(0, 8), 'Refer a friend', ...ROWS.slice(8)]);
    const row = screen.getByText('Refer a friend', {selector: '.s7-title'}).closest('button') as HTMLButtonElement;
    fireEvent.click(row);
    // Rule 6: a second tap inside 500 ms (disabled lifted — happy-dom drops a click on a disabled button) pushes nothing.
    row.disabled = false;
    fireEvent.click(row);
    await settled();
    expect(document.querySelector('.s-ref .top-bar .title')?.textContent).toBe('Refer a friend');
    expect(document.querySelector('.s-ref .code-card .code')?.textContent).toBe(`https://noc-tura.io?ref=${ACCOUNT}`);
    expect(sent.filter(m => (m as {type: string}).type === 'presale.referral')).toEqual([{type: 'presale.referral', account: ACCOUNT}]);
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(await screen.findByRole('heading', {name: 'Settings'})).toBeTruthy();
    expect(document.querySelector('.s-ref')).toBeNull();
  });
});
