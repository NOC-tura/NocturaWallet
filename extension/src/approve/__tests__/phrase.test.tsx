// @vitest-environment happy-dom
import {fireEvent, render, screen} from '@testing-library/react';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {PHRASE_TEXT} from '../../app/ui/PhraseLine';
import {PHRASE_KEY} from '../../background/phraseKey';
import {VAULT_KEY} from '../../background/accountsStore';
import {handleMessage} from '../../background/messages';
import {setSession} from '../../background/session';
import {GRANTS_KEY} from '../../background/dapp/grants';
import {readDappSession} from '../../background/dapp/store';
import {openPage} from '../../background/dapp/__tests__/pageHarness';
import {presaleIx, transfer, v0} from '../../background/dapp/__tests__/txHarness';
import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';
import {Approve} from '../Approve';
import {createClient} from '../client';
import {ARM_MS} from '../useArmed';
import {SECOND, acted, elapse, onHarnessClock, openWindow, settled} from './windowHarness';

// B1e §1.2 (undrawn, §9): the anti-phishing phrase in every approval window — #46, #47, #48 in every state (F12's
// Reject-only screen and a lookalike origin included), the locked window and #48's origin mismatch — under the header,
// as text; nothing when none is set; R9's line when the field cannot be read. Against the real background (dapp.pending
// carries the phrase at its top level); runs in both vitest runs.
const SELECTORS = selectorsOf(UI_SHEETS);
const BLUE = 'Blue horse 42';
const MARKUP = '<b>x</b>';
/** An RTL phrase (Hebrew, then digits): \u escapes. */
const RTL = '\u05e9\u05dc\u05d5\u05dd \u05e2\u05d5\u05dc\u05dd 42';
type Window = Awaited<ReturnType<typeof openWindow>>;
onHarnessClock();

const lines = () => [...document.querySelectorAll('.app-phrase-line')].map(l => ({tone: l.classList.contains('shield') ? 'shield' : l.classList.contains('warning') ? 'warning' : 'other', text: l.textContent}));
const shield = (phrase: string) => [{tone: 'shield', text: `${PHRASE_TEXT.label}: ${phrase}`}];
/** The line is the first thing under the window's top bar (a request screen), never inside the scrolled body. */
const underTopBar = () => document.querySelector('.app-approve > .top-bar')?.nextElementSibling?.classList.contains('app-phrase-line') === true;
const known = (w: Window) => w.ext.local.set('v1_known_recipients', [{address: RECIPIENT, at: 1}]);
/** As tx.test.tsx: the simulation stored, then the window's next read (a focus), then what it shows. */
async function simulated(w: Window, shows: string): Promise<void> {
  await settled(async () => expect((await readDappSession(w.ext)).queue[0]?.sim ?? null).not.toBeNull());
  await acted(() => window.dispatchEvent(new Event('focus')));
  await settled(() => screen.getAllByText(shows));
}
async function opened(phrase: string | undefined, o: {unlocked?: boolean} = {}): Promise<Window> {
  const w = await openWindow(o);
  if (phrase !== undefined) await w.ext.local.set(PHRASE_KEY, phrase);
  return w;
}

/** Each #48 state, reached against the real background; `shows` is what the state says. */
const TX_STATES: [string, (w: Window) => Promise<void>][] = [
  [
    'simulating',
    async w => {
      await known(w);
      w.deps.reader.simulateTransaction = () => new Promise(() => undefined);
      await w.signTx('https://jup.ag', [v0([transfer(1_000_000)])]);
      w.show();
      await settled(() => screen.getByText('Simulating transaction…'));
    },
  ],
  [
    'ready',
    async w => {
      await known(w);
      await w.signTx('https://jup.ag', [v0([transfer(1_000_000)])]);
      w.show();
      await simulated(w, 'Balance changes (post-simulation)');
      expect(screen.getByRole('button', {name: 'Approve'})).toBeTruthy();
    },
  ],
  [
    'couldn’t simulate',
    async w => {
      w.chain.err = {InstructionError: [0, {Custom: 1}]};
      await w.signTx('https://jup.ag', [v0()]);
      w.show();
      await simulated(w, "Couldn't simulate");
    },
  ],
  [
    'unreachable',
    async w => {
      w.chain.down = true;
      await w.signTx('https://jup.ag', [v0()]);
      w.show();
      await simulated(w, 'Could not reach the Noctura server.');
    },
  ],
  [
    'expired',
    async w => {
      w.chain.err = 'BlockhashNotFound';
      await w.signTx('https://jup.ag', [v0()]);
      w.show();
      await simulated(w, 'This request has expired. Ask the site to try again.');
    },
  ],
  [
    'F12 (Reject only)',
    async w => {
      await known(w);
      w.deps.geo = async () => ({open: false, reason: 'sanctioned', countryCode: 'KP'});
      await w.signTx('https://presale.example', [v0([presaleIx('presale_purchase_with_sol')])]);
      w.show();
      await simulated(w, 'Presale purchase blocked');
      expect([...document.querySelectorAll('.sticky-bar button')].map(b => b.textContent)).toEqual(['Reject']);
    },
  ],
  [
    'a lookalike origin',
    async w => {
      await known(w);
      await w.signTx('https://tensr.trade', [v0()]);
      w.show();
      await simulated(w, 'Balance changes (post-simulation)');
      expect(document.querySelector('.top-bar .title')?.textContent).toBe('Suspicious origin');
    },
  ],
  [
    'a lookalike’s risk confirm open',
    async w => {
      await known(w);
      await w.signTx('https://tensr.trade', [v0()]);
      w.show();
      await simulated(w, 'Balance changes (post-simulation)');
      await elapse(ARM_MS);
      fireEvent.click(screen.getByRole('button', {name: 'Approve anyway (not recommended)'}));
      await settled(() => screen.getByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'}));
    },
  ],
  [
    'can no longer be signed (Q26)',
    async w => {
      await w.signTx('https://jup.ag', [v0()]);
      await setSession(w.ext, [SECOND]);
      w.show();
      await settled(() => screen.getByText('This request can no longer be signed. Reject it and ask the site to try again.'));
    },
  ],
];

describe('#48: the phrase on every state (B1e §1.2)', () => {
  it.each(TX_STATES)('%s: the phrase under the top bar', async (_state, reach) => {
    const w = await opened(BLUE);
    await reach(w);
    expect([lines(), underTopBar()]).toEqual([shield(BLUE), true]);
    expect(unstyledClasses(document.querySelector('.app-approve') as HTMLElement, SELECTORS)).toEqual([]);
  });

  it.each(TX_STATES.filter(([s]) => s === 'ready' || s === 'F12 (Reject only)' || s === 'a lookalike origin'))('%s, none set: no line', async (_state, reach) => {
    const w = await opened(undefined);
    await reach(w);
    expect(lines()).toEqual([]);
  });
});

describe('#46, #47, the locked window, #48’s origin mismatch: the phrase (B1e §1.2)', () => {
  const SCREENS: [string, (w: Window) => Promise<void>][] = [
    [
      '#47 connect (a verified site)',
      async w => {
        await w.connect('https://jup.ag');
        w.show();
        await settled(() => screen.getByText('Connection request'));
      },
    ],
    [
      '#47 connect (an unknown site)',
      async w => {
        await w.connect('https://dapp.test');
        w.show();
        await settled(() => screen.getByText('Connect to this app?'));
      },
    ],
    [
      '#47 connect (a lookalike)',
      async w => {
        await w.connect('https://tensr.trade');
        w.show();
        await settled(() => screen.getByText('This domain is not tensor.trade'));
      },
    ],
    [
      '#46 sign message',
      async w => {
        await w.sign('https://jup.ag', 'Sign in to Jupiter');
        w.show();
        await settled(() => screen.getByText('Sign in to Jupiter'));
      },
    ],
    [
      '#48 origin mismatch',
      async w => {
        await w.ext.local.set(GRANTS_KEY, [{origin: 'https://jup.ag', account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: []}]);
        const page = openPage(w.ext, w.deps, 'https://dapp.test', {tab: {id: 99}});
        await page.ask({type: 'page.signTransaction', id: 'm', account: ACCOUNT.publicKey, transactions: [v0()]});
        w.show();
        await settled(() => screen.getByText('Request blocked automatically'));
      },
    ],
  ];

  it.each(SCREENS)('%s: under the top bar', async (_s, reach) => {
    await reach(await opened(BLUE));
    expect([lines(), underTopBar()]).toEqual([shield(BLUE), true]);
    expect(unstyledClasses(document.querySelector('.app-approve') as HTMLElement, SELECTORS)).toEqual([]);
  });

  it.each(SCREENS)('%s, none set: no line', async (_s, reach) => {
    await reach(await opened(undefined));
    expect(lines()).toEqual([]);
  });

  it('the locked window (no top bar): the phrase first in the window; none set: no line', async () => {
    const w = await opened(BLUE, {unlocked: false});
    await w.connect('https://dapp.test');
    w.show();
    await settled(() => screen.getByText('Noctura is locked'));
    expect(lines()).toEqual(shield(BLUE));
    expect(document.querySelector('.app-approve-scroll')?.firstElementChild?.classList.contains('app-phrase-line')).toBe(true);
    expect(document.querySelectorAll('input, select, textarea, a')).toHaveLength(0);
    expect(unstyledClasses(document.querySelector('.app-approve') as HTMLElement, SELECTORS)).toEqual([]);
  });

  // Task 5 fix round 1 (Minor 1, a controller ruling — M3's principle): the reviewer's probe — the accepted
  // apply-vs-delete race left the phrase with no wallet stored, and a site asks to connect. The locked window opens with
  // no line; the row above is the control (the same window, the wallet stored, draws it).
  it('a phrase left behind with no wallet stored (the accepted race): the locked window draws no line', async () => {
    const w = await opened(BLUE, {unlocked: false});
    await w.ext.local.remove(VAULT_KEY);
    expect(await w.ext.local.get(PHRASE_KEY)).toBe(BLUE);
    await w.connect('https://dapp.test');
    w.show();
    await settled(() => screen.getByText('Noctura is locked'));
    expect(lines()).toEqual([]);
  });

  // Task 5 fix round 1 (Minor 4): the phrase is its own bidi run — an RTL phrase keeps its order inside the LTR line.
  it.each([
    ['a request window (#47)', false, 'Connection request'],
    ['the locked window', true, 'Noctura is locked'],
  ] as const)('an RTL phrase in %s: its own isolated run (dir="auto"), as text', async (_where, locked, shows) => {
    const w = await opened(RTL, {unlocked: !locked});
    await w.connect('https://jup.ag');
    w.show();
    await settled(() => screen.getByText(shows));
    expect(lines()).toEqual(shield(RTL));
    const copy = document.querySelector('.app-phrase-line .copy') as HTMLElement;
    expect([copy.getAttribute('dir'), copy.textContent]).toEqual(['auto', RTL]);
  });

  it('a phrase that looks like markup renders as its own text — no element is made of it', async () => {
    const w = await opened(MARKUP);
    await w.connect('https://jup.ag');
    w.show();
    await settled(() => screen.getByText('Connection request'));
    expect(lines()).toEqual(shield(MARKUP));
    expect([document.querySelector('.app-phrase-line .copy')?.childElementCount, document.querySelector('.app-phrase-line b')]).toEqual([0, null]);
  });

  it('a phrase field the window cannot read: R9’s line — the request still shows, its Reject too', async () => {
    const w = await opened(BLUE);
    await w.connect('https://jup.ag');
    const approve = {id: w.ext.runtimeId, origin: w.ext.extensionOrigin, url: `${w.ext.extensionOrigin}/approve.html`};
    const client = createClient(async m => {
      const r = (await handleMessage(w.ext, m, approve, w.deps)) as {ok: boolean; data?: unknown};
      return r.ok && typeof r.data === 'object' && r.data !== null ? {...r, data: {...r.data, phrase: 7}} : r;
    });
    render(
      <div className="app app-window">
        <Approve client={client} close={() => undefined} />
      </div>,
    );
    await settled(() => screen.getByText('Connection request'));
    expect(lines()).toEqual([{tone: 'warning', text: PHRASE_TEXT.failed}]);
    expect(screen.getByRole('button', {name: 'Reject'})).toBeTruthy();
  });
});
