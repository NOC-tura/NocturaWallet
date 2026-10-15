// @vitest-environment happy-dom
import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {ed25519} from '@noble/curves/ed25519.js';
import {base64} from '@scure/base';
import {VersionedTransaction} from '@solana/web3.js';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {handleMessage} from '../../background/messages';
import {setSession} from '../../background/session';
import {readDappSession} from '../../background/dapp/store';
import {GRANTS_KEY} from '../../background/dapp/grants';
import {openPage} from '../../background/dapp/__tests__/pageHarness';
import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';
import {ME, coSigned, mintTo, setAuthorityToNone, transfer, v0} from '../../background/dapp/__tests__/txHarness';
import {pendingOf, type RequestView} from '../client';
import {Tx} from '../Tx';
import {ARM_MS} from '../useArmed';
import {CONFIRM_DELAY_MS} from '../ui';
import {SECOND, openWindow} from './windowHarness';

const SELECTORS = selectorsOf(UI_SHEETS);
const text = (sel: string) => document.querySelector(sel)?.textContent ?? null;
const texts = (sel: string) => [...document.querySelectorAll(sel)].map(e => e.textContent);
const cta = (name: string | RegExp) => screen.getByRole('button', {name}) as HTMLButtonElement;
const armedAfter = () => new Promise(r => setTimeout(r, ARM_MS + 50));
const unstyled = () => unstyledClasses(document.querySelector('.app-approve')!, SELECTORS);
/** The recipient is known (no first-send re-authentication) unless a test says otherwise. */
const known = (w: Awaited<ReturnType<typeof openWindow>>) => w.ext.local.set('v1_known_recipients', [{address: RECIPIENT, at: 1}]);
afterEach(() => cleanup());
/**
 * The window learns by polling (§2.3): its first read starts the simulation (the background runs it outside the read);
 * this waits — deterministically, on the background's own state — until the simulation is stored, then gives the window
 * the read it would make on its next poll (a focus, as a user returning to the window), and waits for it to render.
 */
async function simulated(w: Awaited<ReturnType<typeof openWindow>>, shows: string): Promise<void> {
  await waitFor(async () => expect((await readDappSession(w.ext)).queue[0]?.sim ?? null).not.toBeNull());
  await act(async () => void window.dispatchEvent(new Event('focus')));
  await screen.findAllByText(shows);
}

// Spec B1c §3.3, #48 (index.html ix:18261-18705), against the real background.
describe('#48 dapp-tx-approval', () => {
  it('simulating-blocking, then simulated: the banner and skeleton, Approve disabled; then the changes beside the decoded instructions, the fee, the origin pill — Approve held 500 ms, then signed', async () => {
    const w = await openWindow();
    await known(w);
    // The simulation answers only when released: the blocking state is held, never slept through.
    const reader = w.deps.reader;
    let release!: () => void;
    const gate = new Promise<void>(r => (release = r));
    const simulate = reader.simulateTransaction;
    reader.simulateTransaction = async (...a) => {
      await gate;
      return simulate(...a);
    };
    // 0.001 SOL to a known recipient: no re-authentication rule fires (under 5 %, under $100).
    const {page, requestId} = await w.signTx('https://jup.ag', [v0([transfer(1_000_000)])]);
    w.show();
    await screen.findByText('Simulating transaction…');
    expect([text('.top-bar .title'), text('.s9-sim-banner .meta')]).toEqual(['Approve transaction', 'Noctura server · simulateTransaction']);
    expect(text('.s9-bal-card .label')).toBe('Balance changes (waiting…)');
    expect(document.querySelector('.s9-bal-card')?.className).toBe('s9-bal-card app-busy-dim');
    // The instructions are shown while simulating (decoded locally).
    expect(texts('.s9-payload-card > .app-tx-ix .row .k')).toEqual(['Program 1', 'instruction', 'from', 'to', 'lamports']);
    // Fix round 1 (promoted minor 3, R5): Compute units / Network fee are computed locally — shown while still
    // simulating too (the limit and the fee do not need a live answer; only "consumed" does, so it reads "—").
    expect(texts('.s9-payload-card > .row .k')).toEqual(['Compute units', 'Network fee']);
    expect(texts('.s9-payload-card > .row .v')).toEqual(['— / 200 000', '0.000 005 SOL']);
    expect(text('.app-tx-caption')).toBe('Simulation runs against the current slot before you see Approve. This is mandatory — no skip.');
    // Review 1 L7: who broadcasts — for signTransaction, the site.
    expect(text('.app-tx-sends')).toBe('The site sends this transaction itself after you approve.');
    const pending = cta(/Approve/);
    expect([pending.textContent, pending.disabled]).toEqual(['Approve· simulating', true]);
    // ✕ disabled during the simulation, as drawn; Reject open.
    expect([cta('Close').disabled, cta('Reject').disabled]).toEqual([true, false]);
    expect(unstyled()).toEqual([]);
    release();
    await simulated(w, 'Balance changes (post-simulation)');
    expect(texts('.s9-bal-row .pri')).toEqual(['SOL']);
    expect(texts('.s9-bal-row .delta')).toEqual(['−0.001005']);
    expect(texts('.s9-bal-row .fiat')).toEqual(['$0.15']);
    expect(texts('.s9-payload-card .row .k')).toEqual(['Program 1', 'instruction', 'from', 'to', 'lamports', 'Compute units', 'Network fee']);
    expect(text('.s9-payload-card .app-tx-addr-label')).toBe('Your account: Main');
    expect(texts('.s9-payload-card > .row .v')).toEqual(['450 / 200 000', '0.000 005 SOL']);
    expect(text('.s9-origin-pill .body')).toBe('Request from jup.ag · matches active session');
    expect(document.querySelector('.s9-sim-banner')).toBeNull();
    expect(unstyled()).toEqual([]);
    expect(cta('Approve').disabled).toBe(true);
    await armedAfter();
    fireEvent.click(cta('Approve'));
    await waitFor(() => expect(w.closed.n).toBe(1));
    const signed = (page.answersFor(requestId)[0]?.result as {signed: string[]}).signed;
    const tx = VersionedTransaction.deserialize(base64.decode(signed[0] ?? ''));
    expect(ed25519.verify(tx.signatures[0] ?? new Uint8Array(), tx.message.serialize(), ME.toBytes())).toBe(true);
    // The harness's closed window reads nothing more (rev 2 dry run): a later focus never counts a second close.
    await act(async () => void window.dispatchEvent(new Event('focus')));
    expect(w.closed.n).toBe(1);
  });

  it('a batch: each transaction’s section on one screen, approved as a whole; a co-signer’s fee is not this account’s', async () => {
    const w = await openWindow();
    await known(w);
    await w.signTx('https://jup.ag', [v0([transfer(1)]), coSigned()]);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    expect(texts('.app-tx-batch')).toEqual(['Transaction 1 of 2', 'Transaction 2 of 2']);
    // The co-signed one: the dApp pays the fee — no Network fee row in its section.
    const sections = [...document.querySelectorAll('.app-tx-item')];
    expect(sections.map(sec => [...sec.querySelectorAll('.s9-payload-card > .row .k')].map(k => k.textContent))).toEqual([
      ['Compute units', 'Network fee'],
      ['Compute units'],
    ]);
    expect(unstyled()).toEqual([]);
  });

  it('couldn’t simulate, an unreachable proxy, an expired blockhash (Q21): the reason, and only Reject', async () => {
    for (const [err, down, head, line] of [
      [{InstructionError: [0, {Custom: 1}]}, false, "Couldn't simulate", '{"InstructionError":[0,{"Custom":1}]}'],
      [null, true, "Couldn't simulate", 'Could not reach the Noctura server.'],
      ['BlockhashNotFound', false, 'This request has expired. Ask the site to try again.', null],
    ] as const) {
      cleanup();
      const w = await openWindow();
      w.chain.err = err;
      w.chain.down = down;
      await w.signTx('https://jup.ag', [v0()]);
      w.show();
      await simulated(w, head);
      if (line !== null) expect(texts('.s9-flag-banner.danger .body, .s9-flag-banner.danger .meta')).toEqual([line]);
      expect(screen.queryByRole('button', {name: /Approve/})).toBeNull();
      expect(cta('Reject').disabled).toBe(false);
      expect(document.querySelector('.s9-bal-card')).toBeNull();
      expect(unstyled()).toEqual([]);
    }
  });

  it('re-authentication (B1b’s rules, D11): the line before Approve; Approve asks, the window points to the toolbar, Approve waits; proven → it signs', async () => {
    const w = await openWindow();
    const {page, requestId} = await w.signTx('https://jup.ag', [v0([transfer(1_000_000)])]);
    w.show();
    await simulated(w, "Approving asks you to confirm with your password (or passkey) — you'll start it from the Noctura icon.");
    await armedAfter();
    fireEvent.click(cta('Approve'));
    await screen.findByText("Confirm it's you");
    expect(text('.s9-flag-banner.warn .body')).toBe("Click the Noctura icon in your browser's toolbar and confirm with your password (or passkey). This request will wait here.");
    // The window never links into the vault page: no link, no input of any kind.
    expect(document.querySelectorAll('a, input, select, textarea')).toHaveLength(0);
    await armedAfter();
    expect(cta('Approve').disabled).toBe(true);
    const challengeId = String((await readDappSession(w.ext)).queue[0]?.challengeId);
    await handleMessage(w.ext, {type: 'vault.reauthOk', challengeId}, {id: w.ext.runtimeId, origin: w.ext.extensionOrigin, url: `${w.ext.extensionOrigin}/unlock.html`}, w.deps);
    await act(async () => void document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(screen.queryByText("Confirm it's you")).toBeNull());
    await armedAfter();
    fireEvent.click(cta('Approve'));
    await waitFor(() => expect(w.closed.n).toBe(1));
    expect(page.answersFor(requestId)).toHaveLength(1);
  });

  it('a lookalike origin: no origin pill, the banner, [Reject and report] primary, "Approve anyway (not recommended)" → the 2-second confirm → signed', async () => {
    const w = await openWindow();
    await known(w);
    const {page, requestId} = await w.signTx('https://tensr.trade', [v0()]);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    expect(text('.top-bar .title')).toBe('Suspicious origin');
    expect(document.querySelector('.s9-origin-pill')).toBeNull();
    expect(text('.s9-domain-warn .body b')).toBe('This domain is not tensor.trade');
    expect(cta('Reject and report').className).toBe('btn btn-destructive');
    await armedAfter();
    fireEvent.click(cta('Approve anyway (not recommended)'));
    const sheet = await screen.findByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'});
    await new Promise(r => setTimeout(r, CONFIRM_DELAY_MS + 50));
    fireEvent.click(within(sheet).getByRole('button', {name: 'I understand the risk'}));
    await waitFor(() => expect(w.closed.n).toBe(1));
    expect((page.answersFor(requestId)[0]?.result as {signed: string[]}).signed).toHaveLength(1);
    expect(unstyled()).toEqual([]);
  });

  it('signAndSendTransaction: "Noctura sends this transaction as soon as you approve." under the origin (review 1 L7)', async () => {
    const w = await openWindow();
    await known(w);
    await w.signTx('https://jup.ag', [v0()], {send: true});
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    expect(text('.app-tx-sends')).toBe('Noctura sends this transaction as soon as you approve.');
    expect(unstyled()).toEqual([]);
  });

  it('no balance change of the account’s: "No SOL or token balance changes — review the instructions below." (review 1 L3)', async () => {
    const w = await openWindow();
    await known(w);
    // The dApp pays the fee; the account signs a transfer of nothing.
    await w.signTx('https://jup.ag', [coSigned([transfer(0, ME)])]);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    expect(text('.app-tx-none')).toBe('No SOL or token balance changes — review the instructions below.');
    expect(texts('.s9-bal-row')).toEqual([]);
  });

  it('a refresh that lands between the read and the click (stale): the line says why, the new effects are shown, Approve is held again (review 1 L4)', async () => {
    const STALE = 'The transaction changed while you were reviewing. Review it again before approving.';
    const w = await openWindow();
    await known(w);
    const {page, requestId} = await w.signTx('https://jup.ag', [v0()]);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    await armedAfter();
    const first = (await readDappSession(w.ext)).queue[0]?.sim;
    w.deps.clock.t += 30_000;
    // The window's read starts the refresh in the background; the window still shows the first simulation.
    await act(async () => void document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(async () => expect((await readDappSession(w.ext)).queue[0]?.sim).not.toEqual(first));
    expect(screen.queryByText(STALE)).toBeNull();
    fireEvent.click(cta('Approve'));
    await screen.findByText(STALE);
    expect(page.answersFor(requestId)).toEqual([]);
    expect(cta('Approve').disabled).toBe(true);
    expect(unstyled()).toEqual([]);
    // The next click (after the hold) approves the simulation now shown, and the line goes.
    await armedAfter();
    fireEvent.click(cta('Approve'));
    await waitFor(() => expect(w.closed.n).toBe(1));
    expect(page.answersFor(requestId)).toHaveLength(1);
  });

  it('C15: a new simulation re-holds Approve; Enter never approves', async () => {
    const w = await openWindow();
    await known(w);
    const {page, requestId} = await w.signTx('https://jup.ag', [v0()]);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    await armedAfter();
    expect(cta('Approve').disabled).toBe(false);
    fireEvent.keyDown(cta('Approve'), {key: 'Enter'});
    expect(page.answersFor(requestId)).toEqual([]);
    // A refresh lands (its id changes): the window's next read shows it, and Approve is held again in that render.
    const first = (await readDappSession(w.ext)).queue[0]?.sim;
    w.deps.clock.t += 30_000;
    // The window's read (a visibilitychange: no re-hold of its own) starts the refresh in the background.
    await act(async () => void document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(async () => expect((await readDappSession(w.ext)).queue[0]?.sim).not.toEqual(first));
    // A read that is not a focus (focus alone re-holds, C15): the window's own poll, run now.
    expect(cta('Approve').disabled).toBe(false);
    await act(async () => void document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(cta('Approve').disabled).toBe(true));
  });

  it('approving: "Approving", the body at .65, "Approving…" with the ring, every CTA and ✕ disabled', async () => {
    const w = await openWindow();
    await known(w);
    await w.signTx('https://jup.ag', [v0()]);
    const send = w.client.decide;
    w.client.decide = () => new Promise(() => undefined);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    await armedAfter();
    fireEvent.click(cta('Approve'));
    await screen.findByRole('button', {name: 'Approving…'});
    expect(text('.top-bar .title')).toBe('Approving');
    expect(document.querySelector('.app-approve-scroll')?.className).toContain('app-tx-busy');
    expect([cta('Approving…').disabled, cta('Reject').disabled, cta('Close').disabled]).toEqual([true, true, true]);
    expect(unstyled()).toEqual([]);
    w.client.decide = send;
  });

  it('can no longer be signed (the account left the session): Q26 and only Reject', async () => {
    const w = await openWindow();
    await w.signTx('https://jup.ag', [v0()]);
    // The granted account leaves the unlocked session (the other account stays): its detail cannot be built.
    await setSession(w.ext, [SECOND]);
    w.show();
    await screen.findByText('This request can no longer be signed. Reject it and ask the site to try again.');
    expect(screen.getAllByRole('button').map(b => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Close', 'Reject']);
  });

  // Fix round 1, I1: `{kind: 'none'}` (a legitimate protocol-level absence) used to be rejected by the window's own
  // parser (it only knew `{kind: 'address', value: null}`), so pendingOf returned null and the window stayed blank
  // (aria-busy) forever for any setAuthority-to-None, Token-2022 transfer-hook init/update, or similar instruction.
  it('a setAuthority to None renders — the window’s own "none" field is not an unresolved address (I1)', async () => {
    const w = await openWindow();
    await known(w);
    await w.signTx('https://jup.ag', [v0([setAuthorityToNone()])]);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    expect(texts('.s9-payload-card .row .k')).toEqual(['Program 1', 'instruction', 'account', 'currentAuthority', 'authorityType', 'newAuthority', 'Compute units', 'Network fee']);
    expect(text('.s9-payload-card .row:last-of-type .v')).not.toBeNull();
    const rows = [...document.querySelectorAll('.s9-payload-card .row')];
    const newAuthorityRow = rows.find(r => r.querySelector('.k')?.textContent === 'newAuthority');
    expect(newAuthorityRow?.querySelector('.v')?.textContent).toBe('—');
    expect(cta('Reject').disabled).toBe(false);
    expect(unstyled()).toEqual([]);
  });

  // Negative control (I1): a field value of a kind the parser does not recognize at all is still refused — the fix
  // for `none` did not loosen the fail-closed default branch next to it.
  it('a malformed field value (an unrecognized kind) is still refused — pendingOf fails closed (I1 negative control)', () => {
    const request = {
      requestId: 'x',
      type: 'signTransaction',
      origin: 'https://jup.ag',
      host: 'jup.ag',
      site: {kind: 'verified', name: 'Jupiter', imitates: null, rule: null, idn: null, international: false},
      offerBlock: false,
      connect: null,
      sign: null,
      mismatch: null,
      tx: {
        kind: 'signTransaction',
        account: {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
        simulation: {status: 'simulating'},
        reauth: null,
        labels: [],
        transactions: [
          {
            version: 'legacy',
            feePayer: ACCOUNT.publicKey,
            unitLimit: null,
            feeLamports: null,
            outcome: null,
            instructions: [{programId: null, program: null, name: null, fields: [{name: 'x', value: {kind: 'bogus'}}]}],
          },
        ],
      },
    };
    expect(pendingOf({state: 'request', waiting: 0, windowNotice: false, request})).toBeNull();
  });

  // Fix round 1, I2: the sheet is for exactly the simulation it opened on; a refresh landing while it is open must
  // close it (or, if a captured click still slips in, the background refuses it `stale`) — never sign effects the
  // user never saw.
  it('a lookalike’s risk-confirm sheet closes when a refresh lands while it is open — nothing signed (I2)', async () => {
    const w = await openWindow();
    await known(w);
    const {page, requestId} = await w.signTx('https://tensr.trade', [v0()]);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    await armedAfter();
    fireEvent.click(cta('Approve anyway (not recommended)'));
    await screen.findByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'});
    // A refresh lands while the sheet is open (the window's own read starts it in the background).
    const first = (await readDappSession(w.ext)).queue[0]?.sim;
    w.deps.clock.t += 30_000;
    await act(async () => void document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(async () => expect((await readDappSession(w.ext)).queue[0]?.sim).not.toEqual(first));
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'})).toBeNull());
    expect(page.answersFor(requestId)).toEqual([]);
    expect(w.closed.n).toBe(0);
  });

  // Fix round 1, I3 (controller ruling, overrides plan R2's display): a known program's instruction the decoder
  // names but does not decode the fields of must never look fully decoded.
  it('mintTo (a known tag outside the decoded list): named, but marked "not decoded" (I3)', async () => {
    const w = await openWindow();
    await known(w);
    await w.signTx('https://jup.ag', [v0([mintTo()])]);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    expect(texts('.app-tx-ix .row .v')[1]).toBe('mintTo · Details not decoded — check them on the site before approving.');
    expect(texts('.s9-payload-card .row .k')).toEqual(['Program 1', 'instruction', 'Compute units', 'Network fee']);
  });

  // Fix round 1 (promoted minor 2): a v0 transaction whose lookup table is not yet resolved used to make the whole
  // instructions card vanish; it now says why, instead.
  it('a v0 transaction whose lookup table is not yet resolved: the card says why, instead of vanishing (promoted minor 2)', () => {
    const request: RequestView = {
      requestId: 'p',
      type: 'signTransaction',
      origin: 'https://jup.ag',
      host: 'jup.ag',
      site: {kind: 'verified', name: 'Jupiter', imitates: null, rule: null, idn: null, international: false},
      offerBlock: false,
      connect: null,
      sign: null,
      mismatch: null,
      tx: {
        kind: 'signTransaction',
        account: {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
        simulation: {status: 'simulating'},
        reauth: null,
        labels: [],
        transactions: [{version: 0, feePayer: ACCOUNT.publicKey, instructions: null, unitLimit: null, feeLamports: null, outcome: null}],
      },
    };
    render(<Tx request={request} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />);
    expect(screen.getByText('Instructions appear once the transaction is simulated.')).toBeTruthy();
  });

  // Fix round 2 (Rules of Hooks): the I2 effect used to sit after the early `detail === null` return. `Tx` is keyed
  // by `requestId` (Approve.tsx) — the SAME mounted instance sees its `tx` go null → non-null or back, on the head's
  // own account leaving or rejoining the session (Q26), never a remount — so a hook after that return threw
  // "Rendered fewer/more hooks than expected" the moment it did, with nothing under src/approve to catch it: a blank
  // window. `rerender` on the same instance (never a fresh `render`) is what actually exercises this.
  it('the same <Tx> instance’s tx going non-null → null and back: no "Rendered fewer/more hooks" throw (fix round 2)', () => {
    const withTx: RequestView = {
      requestId: 'q26',
      type: 'signTransaction',
      origin: 'https://jup.ag',
      host: 'jup.ag',
      site: {kind: 'verified', name: 'Jupiter', imitates: null, rule: null, idn: null, international: false},
      offerBlock: false,
      connect: null,
      sign: null,
      mismatch: null,
      tx: {
        kind: 'signTransaction',
        account: {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
        simulation: {status: 'simulating'},
        reauth: null,
        labels: [],
        transactions: [{version: 0, feePayer: ACCOUNT.publicKey, instructions: null, unitLimit: null, feeLamports: null, outcome: null}],
      },
    };
    const withoutTx: RequestView = {...withTx, tx: null};
    const view = render(<Tx request={withTx} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />);
    expect(screen.getByText('Simulating transaction…')).toBeTruthy();
    expect(() => view.rerender(<Tx request={withoutTx} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />)).not.toThrow();
    expect(screen.getByText('This request can no longer be signed. Reject it and ask the site to try again.')).toBeTruthy();
    expect(() => view.rerender(<Tx request={withTx} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />)).not.toThrow();
    expect(screen.getByText('Simulating transaction…')).toBeTruthy();
  });
});

// #48 "origin-mismatch · auto-reject" (ix:18484-18521).
describe('#48 origin-mismatch · auto-reject', () => {
  it('the design’s hero, banner and detail rows; [OK, return to dApp] only dismisses; no Approve; the page was answered unauthorized', async () => {
    const w = await openWindow();
    // jup.ag holds the grant; dapp.test asks to sign with that account.
    await w.ext.local.set(GRANTS_KEY, [{origin: 'https://jup.ag', account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: []}]);
    const page = openPage(w.ext, w.deps, 'https://dapp.test', {tab: {id: 99}});
    expect(await page.ask({type: 'page.signTransaction', id: 'm', account: ACCOUNT.publicKey, transactions: [v0()]})).toEqual({id: 'm', error: 'unauthorized'});
    w.show();
    await screen.findByText('Request blocked automatically');
    expect([text('.top-bar .title'), document.querySelector('.top-bar .title')?.className]).toEqual(['Auto-rejected · Origin mismatch', 'title noc-overline noc-danger']);
    expect(text('.s9-fail-hero .sub')).toBe('A transaction came from a different origin than the one you connected. We rejected it without showing Approve.');
    expect(text('.s9-flag-banner .head')).toBe('Origin mismatch · auto-reject');
    expect(text('.s9-flag-banner .body')).toBe('A connected session for jup.ag received a transaction request from dapp.test. This is almost always a man-in-the-middle attempt. The request was dropped without prompting.');
    expect(texts('.s9-payload-card .row .k')).toEqual(['Active session', 'Request origin', 'Match', 'Action']);
    expect(texts('.s9-payload-card .row .v')).toEqual(['jup.ag', 'dapp.test', 'false', 'REJECT_NO_PROMPT']);
    expect(text('.app-tx-caption')).toBe('If you believe this is legitimate, disconnect the existing jup.ag session in Settings → Connected dApps and reconnect through the new domain explicitly. Never approve cross-origin transactions.');
    expect(screen.queryByRole('button', {name: /Approve|Review session/})).toBeNull();
    expect(unstyled()).toEqual([]);
    fireEvent.click(cta('OK, return to dApp'));
    await waitFor(() => expect(w.closed.n).toBe(1));
  });
});
