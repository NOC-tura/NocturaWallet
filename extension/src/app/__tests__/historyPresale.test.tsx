// @vitest-environment happy-dom
import type {ReactNode} from 'react';
import {act, cleanup, screen} from '@testing-library/react';
import {drainInFlight, renderInWallet, walletReader} from './harness';
import {Activity} from '../screens/Activity';
import {TxDetail} from '../screens/TxDetail';
import {useWallet} from '../WalletContext';
import type {HistoryItem} from '../engine';
import type {Ext} from '../../ext';
import {registerPresale} from '../../background/presale/api';
import {registerPresaleHandler} from '../../background/messages';
import {PRESALE_RECORDS_KEY} from '../../background/presaleRecordsKey';
import {lock} from '../../background/autolock';
import {fakeDeps} from '../../background/__tests__/fakeDeps';
import {fakeExt} from '../../background/__tests__/fakeExt';
import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';
import {COUNTERPARTY, presalePurchase, receivedUsdc, sentSol, sig} from '../../../e2e/historyFixtures';

registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});

// B1d-2 Task 5 (§4.6, Q31, Q34, D29): #26's "Presale" badge on every purchase row — the kind is the chain's history's,
// a site's purchase included — and #27's Q34 while presale.unrecorded lists the purchase's signature (`due`, `given-up`,
// `refused`), against the REAL background. This file runs in both vitest runs: the build without presale shows B1b's
// rows and B1b's #27, with no badge, no Q34 and no presale message.
const off = process.env.NOCTURA_PRESALE === '0';
const Q34 = 'Recorded on chain; presale service not yet updated';
const NOW = Math.floor(Date.now() / 1000);
/** The wallet's own purchase (sig 3, recorded) and a site's (sig 4, no record of ours — the chain's kind only). */
const OURS = sig(3);
const SITES = sig(4);
const types = (sent: unknown[]) => sent.map(m => (m as {type: string}).type);
const settled = () =>
  act(async () => {
    await drainInFlight();
    await new Promise<void>(r => setTimeout(r, 0));
    await drainInFlight();
  });

type State = 'due' | 'done' | 'refused' | 'given-up';
/** A `v1_presale_records` entry as Task 1's record.ts stores it (§2.4, D28). */
const entry = (signature: string, state: State, account = ACCOUNT.publicKey) => ({
  signature,
  account,
  payload: {txHash: signature, buyerAddress: account, paymentToken: 'SOL', paymentAmount: '1', nocAmount: 998_000.5, usdValue: 150, stage: 1},
  confirmedAt: 1_000,
  attempts: 1,
  nextAt: state === 'due' ? 61_000 : 1_000,
  state,
});

function historyReader() {
  const txs: Record<string, unknown> = {
    [sig(1)]: sentSol(ACCOUNT.publicKey, RECIPIENT, 2_480_000_000, NOW - 60),
    [sig(2)]: receivedUsdc(ACCOUNT.publicKey, COUNTERPARTY, 250_000_000, NOW - 120),
    [OURS]: presalePurchase(ACCOUNT.publicKey, 1_000_000_000, NOW - 180),
    [SITES]: presalePurchase(ACCOUNT.publicKey, 500_000_000, NOW - 240),
  };
  const list = [sig(1), sig(2), OURS, SITES];
  return walletReader({
    getSignaturesForAddress: async () => list.map(s => ({signature: s, blockTime: null, err: null})),
    getTransaction: async s => txs[s] ?? null,
  });
}

/** Every row of #26: its title's own text, its badges (class and text), its meta and its amount. */
const rows = () =>
  [...document.querySelectorAll('.tx-row:not([data-pending])')].map(r => ({
    title: [...(r.querySelector('.pri')?.childNodes ?? [])].filter(n => n.nodeType === 3).map(n => n.textContent).join(''),
    badges: [...(r.querySelector('.pri')?.children ?? [])].map(b => `${b.className}:${b.textContent}`),
    meta: r.querySelector('.sec')?.textContent?.replace(/ · .*$/, ''),
    amount: r.querySelector('.amt')?.textContent,
  }));
const B1B_ROWS = [
  {title: 'Sent SOL', meta: 'to Your account: Savings', amount: '−2.4800'},
  {title: 'Received USDC', meta: `from ${COUNTERPARTY.slice(0, 4)}…${COUNTERPARTY.slice(-4)}`, amount: '+250.00'},
  {title: 'Presale purchase', meta: 'NOC', amount: '−1.0000'},
  {title: 'Presale purchase', meta: 'NOC', amount: '−0.5000'},
];
const PRESALE_BADGE = 'status-pill app-badge:Presale';
const DAPP_BADGE = 'origin-badge:Dapp · simulated';

async function activity(o: {records?: unknown[]} = {}) {
  const sent: unknown[] = [];
  await renderInWallet(<Activity onTx={() => undefined} onReceive={() => undefined} onPending={() => undefined} />, {
    reader: historyReader(),
    before: async ext => {
      // The site's purchase: B1c-2's record of what a site had this wallet sign — no presale record, no pending record.
      await ext.local.set('v1_dapp_txs', [{signature: SITES, origin: 'https://presale.example', at: 1}]);
      if (o.records !== undefined) await ext.local.set(PRESALE_RECORDS_KEY, o.records);
    },
    gate: m => void sent.push(m),
  });
  await screen.findAllByText('Presale purchase');
  await settled();
  return sent;
}

describe(`#26 in this build (${off ? 'off' : 'on'}): the purchase rows`, () => {
  it(
    off
      ? 'off: B1b’s rows exactly — no "Presale" badge on any row (the site’s keeps B1c’s badge), and no presale message'
      : 'on: "Presale" on both purchase rows — the wallet’s own and the site’s, which has no record of ours (the kind is the chain’s) — none on a send or a receive; the rows otherwise B1b’s; no presale message',
    async () => {
      const sent = await activity({records: [entry(OURS, 'done')]});
      const badges = off ? [[], [], [], [DAPP_BADGE]] : [[], [], [PRESALE_BADGE], [PRESALE_BADGE, DAPP_BADGE]];
      expect(rows()).toEqual(B1B_ROWS.map((r, i) => ({...r, badges: badges[i]})));
      // A badged row lets its badges wrap under the title (app.css): the site's purchase carries two, wider than the
      // meta column at 412 px. B1b's rows keep B1b's class.
      expect([...document.querySelectorAll('.tx-row:not([data-pending]) .pri')].map(e => e.className)).toEqual(B1B_ROWS.map((_, i) => (!off && i >= 2 ? 'pri noc-body-lg app-tx-badged' : 'pri noc-body-lg')));
      // The badge reads nothing: the row's kind is the history's (core/solana/history.ts decodes the presale program).
      expect(types(sent).filter(t => t.startsWith('presale.'))).toEqual([]);
      if (off) expect(document.body.textContent).not.toMatch(/Presale(?! purchase)/);
    },
  );
});

/** As in the App: #27 opens once the provider knows the selected account (Main), so a read keyed on it would see it. */
function WhenSelected({children}: {children: ReactNode}) {
  return useWallet().account === null ? null : children;
}
/** #27 for this history row, opened for `owner` (the route's account), and every message it sent. */
async function detail(item: HistoryItem, o: {owner?: string; records?: unknown[]; gate?: (m: unknown, ext: Ext) => Promise<void> | void} = {}) {
  const sent: unknown[] = [];
  let ext: Ext | null = null;
  await renderInWallet(
    <WhenSelected>
      <TxDetail signature={item.signature} account={o.owner ?? ACCOUNT.publicKey} item={item} canRetry onBack={() => undefined} onTryAgain={() => undefined} />
    </WhenSelected>,
    {
      before: async e => {
        ext = e;
        if (o.records !== undefined) await e.local.set(PRESALE_RECORDS_KEY, o.records);
      },
      gate: async m => {
        sent.push(m);
        if (ext !== null) await o.gate?.(m, ext);
      },
    },
  );
  await screen.findByText(/^Confirmed/);
  await settled();
  return sent;
}
const purchaseItem = (signature: string, over: Partial<HistoryItem> = {}): HistoryItem => ({
  signature,
  blockTime: NOW - 180,
  kind: 'purchase',
  token: 'SOL',
  mint: null,
  amount: 1_000_000_000n,
  counterparty: null,
  feeLamports: 5_000n,
  failed: false,
  origin: null,
  ...over,
});
const sendItem = (over: Partial<HistoryItem> = {}): HistoryItem => ({...purchaseItem(sig(1)), kind: 'sent', counterparty: RECIPIENT, amount: 2_480_000_000n, ...over});
const asked = (sent: unknown[]) => sent.filter(m => (m as {type: string}).type === 'presale.unrecorded');
/** B1b's purchase variant of #27, whatever else is on the screen. */
function expectB1bPurchase() {
  expect(document.querySelector('.amount-card .eyebrow')?.textContent).toBe('PRESALE PURCHASE');
  expect(document.querySelector('.amount-card .amt')?.textContent).toBe('−1.0000 SOL');
  expect([...document.querySelectorAll('.detail-row .lbl')].map(e => e.textContent)).toEqual(['Hash', 'Network fee', 'Date']);
  expect(screen.getByRole('link', {name: 'Explorer'})).toBeTruthy();
}

describe(`#27 in this build (${off ? 'off' : 'on'}): Q34`, () => {
  it(off ? 'off: a purchase with a due record — B1b’s purchase variant, no Q34 and no presale message' : 'on: a purchase with a due record shows Q34 as an info line under the amount card (positive control of the off run)', async () => {
    const sent = await detail(purchaseItem(OURS), {records: [entry(OURS, 'due')]});
    expectB1bPurchase();
    if (off) {
      expect(screen.queryByText(Q34)).toBeNull();
      expect(document.querySelector('.banner')).toBeNull();
      expect(types(sent).filter(t => t.startsWith('presale.'))).toEqual([]);
      return;
    }
    const line = screen.getByText(Q34).closest('.banner') as HTMLElement;
    expect([line.className, line.getAttribute('role'), line.previousElementSibling?.className, line.nextElementSibling?.className]).toEqual(['banner info', 'status', 'amount-card', 'detail-card']);
    expect(asked(sent)).toEqual([{type: 'presale.unrecorded', account: ACCOUNT.publicKey}]);
  });
});

describe.skipIf(off)('#27’s Q34 (§4.6, D29): exactly while presale.unrecorded lists the signature', () => {
  it.each<[State, boolean]>([
    ['due', true],
    ['given-up', true],
    ['refused', true],
    ['done', false],
  ])('a record %s → Q34 %s', async (state, shown) => {
    const sent = await detail(purchaseItem(OURS), {records: [entry(OURS, state)]});
    expect(screen.queryByText(Q34) !== null).toBe(shown);
    expectB1bPurchase();
    // The read happened either way: an absent line is the answer's, not a request never made.
    expect(asked(sent)).toHaveLength(1);
  });

  it('a purchase we never recorded (a site’s) shows no Q34 — also while another purchase of the account is unrecorded', async () => {
    const sent = await detail(purchaseItem(SITES, {origin: 'dapp'}), {records: [entry(OURS, 'due'), entry(sig(9), 'refused')]});
    expect(screen.queryByText(Q34)).toBeNull();
    expect(asked(sent)).toEqual([{type: 'presale.unrecorded', account: ACCOUNT.publicKey}]);
    expectB1bPurchase();
  });

  it('asked for the route’s account, never the selected one: #27 of Savings’s purchase while Main is selected', async () => {
    const sent = await detail(purchaseItem(OURS), {owner: RECIPIENT, records: [entry(OURS, 'due', RECIPIENT)]});
    expect(screen.getByText(Q34)).toBeTruthy();
    expect(asked(sent)).toEqual([{type: 'presale.unrecorded', account: RECIPIENT}]);
  });

  it('the answer is only the asked account’s: the same signature unrecorded under another account is no Q34 here', async () => {
    const sent = await detail(purchaseItem(OURS), {owner: RECIPIENT, records: [entry(OURS, 'due', ACCOUNT.publicKey)]});
    expect(screen.queryByText(Q34)).toBeNull();
    expect(asked(sent)).toEqual([{type: 'presale.unrecorded', account: RECIPIENT}]);
  });

  // The engine asks a failed transport once more (B1b: a service worker restarting), so a request that fails is two.
  it.each<[string, (m: unknown, ext: Ext) => Promise<void>, number]>([
    [
      'the request fails',
      async m => {
        if ((m as {type: string}).type === 'presale.unrecorded') throw new Error('port closed');
      },
      2,
    ],
    [
      'the wallet locked under it',
      async (m, ext) => {
        if ((m as {type: string}).type === 'presale.unrecorded') await lock(ext);
      },
      1,
    ],
  ])('fail quiet — %s: no Q34, no notice, B1b’s purchase variant', async (_, gate, asks) => {
    const sent = await detail(purchaseItem(OURS), {records: [entry(OURS, 'due')], gate});
    expect(asked(sent)).toHaveLength(asks);
    expect(screen.queryByText(Q34)).toBeNull();
    expect(document.querySelector('.banner')).toBeNull();
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expectB1bPurchase();
  });

  it('B1b’s sends unchanged: #27 of a send and of a receive asks nothing and shows no Q34, even with that signature listed', async () => {
    for (const item of [sendItem(), sendItem({kind: 'received', counterparty: COUNTERPARTY})]) {
      const sent = await detail(item, {records: [entry(item.signature, 'due')]});
      expect(document.querySelector('.amount-card .eyebrow')?.textContent).toBe(item.kind === 'sent' ? 'SENT' : 'RECEIVED');
      expect(screen.queryByText(Q34)).toBeNull();
      expect(asked(sent)).toEqual([]);
      cleanup();
    }
  });
});
