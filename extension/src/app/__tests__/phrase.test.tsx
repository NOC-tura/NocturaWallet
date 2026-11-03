// @vitest-environment happy-dom
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {App} from '../App';
import {WalletProvider, useWallet} from '../WalletContext';
import {Locked} from '../screens/Locked';
import {createEngine} from '../engine';
import {Security, SECURITY_TEXT} from '../screens/Security';
import {PHRASE_TEXT} from '../ui/PhraseLine';
import {base64} from '@scure/base';
import {PHRASE_KEY} from '../../background/phraseKey';
import {VAULT_KEY} from '../../background/accountsStore';
import {REAUTH_KEY} from '../../background/session';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {renderApp} from './appHarness';
import {renderInWallet, setupWallet, type WalletOptions} from './harness';

// B1e §1.2, §1.3 (undrawn, §9): the anti-phishing phrase in the popup and the UI tab — the locked screen's line (from
// wallet.state; nothing when none is set; R9's line when it could not be read) and #35's row and card (set when none is
// set, at once; change and remove through #10). Against the real background; runs in both vitest runs.
const SELECTORS = selectorsOf(UI_SHEETS);
const BLUE = 'Blue horse 42';
const GREEN = 'Green fox 7';
const MARKUP = '<b>x</b>';
/** An RTL phrase (Hebrew, then digits): \u escapes. */
const RTL = '\u05e9\u05dc\u05d5\u05dd \u05e2\u05d5\u05dc\u05dd 42';
const B = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));
/** A v1 envelope's sealed fields, in the shapes envelopeShape accepts (the bytes are filler: nothing here opens it). */
const SEALED = {kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16, 1)}, seed: {iv: B(12, 2), ct: B(48, 3)}, password: {wrapped: B(40, 4)}};
/**
 * Rev 2.6 (the final review's Minor 1): wallet.state carries the phrase only beside a wallet this version accepts
 * (envelopeShape). The harness's ENV is a skeleton — scheme and accounts, which is all hasWallet reads — so the rows
 * here complete it with the sealed fields; the skeleton itself is a vault this version refuses (its own row below).
 */
const accepted: NonNullable<WalletOptions['before']> = async ext => {
  const env = await ext.local.get(VAULT_KEY);
  if (typeof env === 'object' && env !== null) await ext.local.set(VAULT_KEY, {...env, ...SEALED});
};
const withPhrase =
  (phrase: unknown): NonNullable<WalletOptions['before']> =>
  async ext => {
    await accepted(ext);
    await ext.local.set(PHRASE_KEY, phrase);
  };
const storedOnly =
  (phrase: unknown): NonNullable<WalletOptions['before']> =>
  async ext => {
    await ext.local.set(PHRASE_KEY, phrase);
  };
const lines = () => [...document.querySelectorAll('.app-phrase-line')].map(l => ({tone: l.classList.contains('shield') ? 'shield' : l.classList.contains('warning') ? 'warning' : 'other', text: l.textContent}));

describe('the locked screen: the phrase under the header (B1e §1.2)', () => {
  it.each(['popup', 'tab'] as const)('%s: the phrase beside the shield, named for a screen reader, under "Welcome back"', async surface => {
    await renderApp({unlocked: false, surface, before: withPhrase(BLUE)});
    const h1 = await screen.findByText('Welcome back');
    expect(lines()).toEqual([{tone: 'shield', text: `${PHRASE_TEXT.label}: ${BLUE}`}]);
    const line = document.querySelector('.app-phrase-line') as HTMLElement;
    expect(line.querySelector('.app-sr')?.textContent).toBe(`${PHRASE_TEXT.label}: `);
    expect(h1.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(line.compareDocumentPosition(screen.getByRole('button', {name: 'Unlock'})) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(unstyledClasses(document.querySelector('.screen') as HTMLElement, SELECTORS)).toEqual([]);
  });

  it('none set: nothing — the screen is as before', async () => {
    await renderApp({unlocked: false, before: accepted});
    await screen.findByText('Welcome back');
    expect(lines()).toEqual([]);
  });

  it('a phrase that looks like markup renders as its own text — no element is made of it', async () => {
    await renderApp({unlocked: false, before: withPhrase(MARKUP)});
    await screen.findByText('Welcome back');
    expect(lines()).toEqual([{tone: 'shield', text: `${PHRASE_TEXT.label}: ${MARKUP}`}]);
    expect(document.querySelector('.app-phrase-line .copy')?.childElementCount).toBe(0);
    expect(document.querySelector('.app-phrase-line b')).toBeNull();
  });

  // Task 5 fix round 1 (Minor 4): the phrase is its own bidi run — an RTL phrase keeps its order inside the LTR line.
  it('an RTL phrase: its own isolated run (dir="auto"), as text', async () => {
    await renderApp({unlocked: false, before: withPhrase(RTL)});
    await screen.findByText('Welcome back');
    expect(lines()).toEqual([{tone: 'shield', text: `${PHRASE_TEXT.label}: ${RTL}`}]);
    const copy = document.querySelector('.app-phrase-line .copy') as HTMLElement;
    expect([copy.getAttribute('dir'), copy.textContent]).toEqual(['auto', RTL]);
  });

  it.each([
    ['missing', (d: Record<string, unknown>) => ({...d, phrase: undefined})],
    ['not a phrase', (d: Record<string, unknown>) => ({...d, phrase: 42})],
  ] as const)('a phrase field this side cannot read (%s): R9’s line — the screen still shows, with [Unlock]', async (_why, tamper) => {
    const w = await setupWallet({unlocked: false, before: withPhrase(BLUE)});
    const engine = createEngine(async m => {
      const r = (await w.transport(m)) as {ok: boolean; data?: unknown};
      return (m as {type?: unknown}).type === 'wallet.state' && r.ok ? {...r, data: tamper(r.data as Record<string, unknown>)} : r;
    }, async () => undefined);
    render(<App surface="popup" engine={engine} platform={w.platform} hash="" />);
    await screen.findByText('Welcome back');
    expect(lines()).toEqual([{tone: 'warning', text: PHRASE_TEXT.failed}]);
    expect(screen.getByRole('status').textContent).toBe(PHRASE_TEXT.failed);
    expect(screen.getByRole('button', {name: 'Unlock'})).toBeTruthy();
  });

  // Task 4 review M3: after the accepted apply-vs-delete race (§1.4) a phrase is stored with no wallet, and wallet.state
  // says so — {hasWallet: false, phrase}. The no-wallet state draws no line (§1.2): the line keys on hasWallet, never on
  // the phrase alone — not through the App, and not on the locked screen itself when given that state.
  it('a phrase stored with no wallet (the accepted apply-vs-delete race): no line — the App shows no-wallet; the locked screen given that state draws none', async () => {
    /** What the provider has read: the locked screen is drawn beside it, so the line is judged on the state it was given. */
    function Seen() {
      const {wallet} = useWallet();
      return <i data-testid="seen">{wallet === null ? 'none yet' : `hasWallet ${String(wallet.hasWallet)}`}</i>;
    }
    const lockedGiven = async (w: Awaited<ReturnType<typeof setupWallet>>, seen: string) => {
      render(
        <WalletProvider engine={w.engine} platform={w.platform} surface="tab">
          <Seen />
          <Locked />
        </WalletProvider>,
      );
      await waitFor(() => expect(screen.getByTestId('seen').textContent).toBe(seen));
      await screen.findByText('Welcome back');
    };
    const stored = await setupWallet({wallet: false, before: withPhrase(BLUE)});
    // The race's state, from the real background: no wallet, and (rev 2.6) no phrase — wallet.state reads it only beside
    // a wallet this version accepts. The line's own guard is still pinned: the answer below carries the phrase anyway (an
    // answer from before rev 2.6's reading), and the no-wallet state still draws none.
    expect(await stored.engine.state()).toMatchObject({ok: true, data: {hasWallet: false, unlocked: false, phrase: {state: 'none'}}});
    const raced = {
      ...stored,
      engine: createEngine(async m => {
        const r = (await stored.transport(m)) as {ok: boolean; data?: unknown};
        return (m as {type?: unknown}).type === 'wallet.state' && r.ok ? {...r, data: {...(r.data as Record<string, unknown>), phrase: BLUE}} : r;
      }, async () => undefined),
    };
    expect(await raced.engine.state()).toMatchObject({ok: true, data: {hasWallet: false, unlocked: false, phrase: {state: 'set', phrase: BLUE}}});
    render(<App surface="tab" engine={raced.engine} platform={raced.platform} hash="" />);
    await screen.findByText('No wallet on this browser yet.');
    expect(lines()).toEqual([]);
    cleanup();
    await lockedGiven(raced, 'hasWallet false');
    expect(lines()).toEqual([]);
    cleanup();
    // The control: the same screen and the same phrase with the wallet stored draws the line.
    await lockedGiven(await setupWallet({unlocked: false, before: withPhrase(BLUE)}), 'hasWallet true');
    await waitFor(() => expect(lines()).toEqual([{tone: 'shield', text: `${PHRASE_TEXT.label}: ${BLUE}`}]));
  });

  // Rev 2.6 (the final review's Minor 1, its probe P1 on the popup): a vault this version refuses still routes to the
  // locked screen (hasWallet reads scheme and accounts only), and the line is not drawn there — as no approval window
  // draws it over the same vault (dapp.pending, background phrase.test). Positive control: the same store accepted.
  it.each([
    ['the harness skeleton (no sealed fields)', (env: Record<string, unknown>) => env],
    ['a later format (v: 2)', (env: Record<string, unknown>) => ({...env, ...SEALED, v: 2})],
    ['a KDF cost below the floor (F2)', (env: Record<string, unknown>) => ({...env, ...SEALED, kdf: {...SEALED.kdf, m: 32768}})],
  ] as const)('a vault this version refuses (%s), a phrase stored: the locked screen, and no line', async (_why, refuse) => {
    const w = await renderApp({
      unlocked: false,
      before: async ext => {
        await storedOnly(BLUE)(ext);
        await ext.local.set(VAULT_KEY, refuse((await ext.local.get(VAULT_KEY)) as Record<string, unknown>));
      },
    });
    await screen.findByText('Welcome back');
    expect(await w.engine.state()).toMatchObject({ok: true, data: {hasWallet: true, unlocked: false, phrase: {state: 'none'}}});
    expect(lines()).toEqual([]);
    cleanup();
    await renderApp({unlocked: false, before: withPhrase(BLUE)});
    await screen.findByText('Welcome back');
    await waitFor(() => expect(lines()).toEqual([{tone: 'shield', text: `${PHRASE_TEXT.label}: ${BLUE}`}]));
  });
});

describe('#35: the anti-phishing row and its card (B1e §1.3, R1 = E18)', () => {
  async function shown(phrase?: unknown, surface: 'popup' | 'tab' = 'popup') {
    const calls = {back: 0};
    const w = await renderInWallet(<Security onBack={() => void calls.back++} onPasskey={() => undefined} onDelete={() => undefined} />, {surface, before: phrase === undefined ? accepted : withPhrase(phrase)});
    await waitFor(() => expect(document.querySelector('.s7-score-card')).not.toBeNull());
    return w;
  }
  const row = () => screen.getByText(SECURITY_TEXT.phrase, {selector: '.s7-title'}).closest('button') as HTMLButtonElement;
  const meta = () => row().querySelector('.s7-meta');
  const open = () => fireEvent.click(row());
  const field = () => document.querySelector('.app-phrase-input') as HTMLInputElement;
  const action = (name: string) => screen.getByRole('button', {name}) as HTMLButtonElement;

  it('Off when none is set, On when one is — as wallet.state says', async () => {
    await shown();
    await waitFor(() => expect(meta()?.textContent).toBe(SECURITY_TEXT.off));
    expect(meta()?.className).toBe('s7-meta');
    cleanup();
    await shown(BLUE);
    await waitFor(() => expect(meta()?.textContent).toBe(SECURITY_TEXT.on));
    expect(meta()?.className).toBe('s7-meta noc-success');
  });

  it('set when none is set: the card’s input, [Set phrase] only for a phrase the rules accept; written at once — no #10 — and the row says On', async () => {
    const w = await shown();
    await waitFor(() => expect(meta()?.textContent).toBe(SECURITY_TEXT.off));
    open();
    expect([field().getAttribute('aria-label'), screen.queryByRole('button', {name: SECURITY_TEXT.phraseRemove})]).toEqual([SECURITY_TEXT.phrase, null]);
    expect(unstyledClasses(document.querySelector('.app-phrase-card') as HTMLElement, SELECTORS)).toEqual([]);
    for (const bad of ['', 'ab', 'x'.repeat(33), 'Blue \u202ehorse 42']) {
      fireEvent.change(field(), {target: {value: bad}});
      expect([bad, action(SECURITY_TEXT.phraseSet).disabled]).toEqual([bad, true]);
    }
    fireEvent.change(field(), {target: {value: ` ${BLUE} `}});
    fireEvent.click(action(SECURITY_TEXT.phraseSet));
    await waitFor(() => expect(meta()?.textContent).toBe(SECURITY_TEXT.on));
    expect([await w.ext.local.get(PHRASE_KEY), w.platform.opened, w.platform.closed]).toEqual([BLUE, [], 0]);
  });

  it.each([
    ['change', SECURITY_TEXT.phraseChange, GREEN],
    ['remove', SECURITY_TEXT.phraseRemove, null],
  ] as const)('%s: goes to #10 — the popup opens it and closes; nothing is written here; the row and the card never show the stored phrase', async (_op, button, bound) => {
    const w = await shown(BLUE);
    await waitFor(() => expect(meta()?.textContent).toBe(SECURITY_TEXT.on));
    open();
    expect(field().getAttribute('aria-label')).toBe(SECURITY_TEXT.phraseNew);
    // Neither as text nor in the field: the card starts empty, whatever is stored.
    expect([document.body.textContent?.includes(BLUE), field().value]).toEqual([false, '']);
    if (bound !== null) fireEvent.change(field(), {target: {value: bound}});
    fireEvent.click(action(button));
    await waitFor(() => expect(w.platform.opened).toHaveLength(1));
    expect(w.platform.opened[0]).toMatch(/^unlock\.html\?mode=reauth&challenge=[0-9a-f]{32}$/);
    expect([w.platform.closed, await w.ext.local.get(PHRASE_KEY)]).toEqual([1, BLUE]);
    const id = w.platform.opened[0]?.split('challenge=')[1] ?? '';
    expect(((await w.ext.session.get(REAUTH_KEY)) as Record<string, {about: unknown}>)[id]?.about).toEqual({kind: 'phrase', phrase: bound});
  });

  it('change in the tab: #10 opens and the tab stays; the row keeps saying what is stored', async () => {
    const w = await shown(BLUE, 'tab');
    await waitFor(() => expect(meta()?.textContent).toBe(SECURITY_TEXT.on));
    open();
    fireEvent.change(field(), {target: {value: GREEN}});
    fireEvent.click(action(SECURITY_TEXT.phraseChange));
    await waitFor(() => expect(w.platform.opened).toHaveLength(1));
    expect([w.platform.closed, await w.ext.local.get(PHRASE_KEY)]).toEqual([0, BLUE]);
  });
});
