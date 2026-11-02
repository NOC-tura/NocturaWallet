// @vitest-environment happy-dom
import {createHash} from 'node:crypto';
import {VAULT_KEY, WALLET_DATA_KEYS} from '../../background/accountsStore';
import {PENDING_KEY} from '../../background/pendingStore';
import {setSession} from '../../background/session';
import {ACCOUNT, pendingRecord} from '../../background/__tests__/fixtures';
import {DELETE_TEXT, HOLD_MS as POPUP_HOLD_MS, WORD} from '../../app/screens/DeleteWallet';
import {HOLD_TICK_MS as POPUP_TICK_MS} from '../../app/ui/HoldButton';
import {createEnvelope} from '../../vault/envelope';
import {DELETABLE, F, F_WALLETS, FIXTURE_ACCOUNT, MNEMONIC, PASSWORD, edited} from '../../shared/__tests__/vaultControls';
import {pageMode} from '../mode';
import {startMode} from '../modes';
import {mountDamaged} from '../screens/damaged';
import {mountRemoveDamaged, readableAddress} from '../screens/removeDamaged';
import {mountUnlock} from '../screens/unlock';
import {mountWelcome} from '../screens/welcome';
import {TYPED_DELETE} from '../strings';
import {CONFIRM_WORD, HOLD_MS, HOLD_TICK_MS} from '../view/deleteConfirm';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible, type Harness} from './pageHarness';

// B1e §2.2–§2.4 against the REAL background: #9's and #1's damaged states, "Save the damaged data", and the removal.
const digestOf = (raw: unknown): string => createHash('sha256').update(Buffer.from(JSON.stringify(raw), 'utf8')).digest('hex');
const UNREADABLE = edited(e => (e.seed = 'damaged'));
const OTHER_UNREADABLE = edited(e => (e.password = 'damaged'));
const REFUSED = edited(e => (e.v = 2));
const K1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
const DATA_PREFIX = 'data:application/json;charset=utf-8,';

beforeEach(loadPage);

/** What a saved file holds: the link's data: URL decoded. */
function saved(id: string): {name: string; text: string} {
  const a = el<HTMLAnchorElement>(id);
  const href = a.getAttribute('href') ?? '';
  expect(href.startsWith(DATA_PREFIX)).toBe(true);
  expect(a.hasAttribute('download')).toBe(true);
  return {name: a.getAttribute('download') ?? '', text: decodeURIComponent(href.slice(DATA_PREFIX.length))};
}
const forgets = (h: Harness) => h.sent.filter(m => m.type === 'vault.forgetDamaged');

async function removal(raw: unknown) {
  const h = await harness({vault: raw});
  await mountRemoveDamaged(h.deps, mountDamaged(h.deps)).show();
  return h;
}
const press = () => el('rd-hold').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, button: 0}));
const releaseHold = () => el('rd-hold').dispatchEvent(new PointerEvent('pointerup', {bubbles: true, button: 0}));
/** Types DELETE and holds the button for the full second. */
async function confirmRemoval(h: Harness) {
  type(el<HTMLInputElement>('rd-word'), 'DELETE');
  press();
  h.timers.advance(HOLD_MS + HOLD_TICK_MS);
  await h.until(() => !h.deps.gate.isBusy());
}

describe('the damaged states on #9 and #1 (B1e §2.2)', () => {
  it.each([
    ['#9', (h: Harness) => mountUnlock(h.deps).show(null)],
    ['#1', (h: Harness) => mountWelcome(h.deps, {create: () => undefined, import: () => undefined}).show()],
  ] as const)('%s: an unreadable vault → "Wallet data is damaged", Save and Remove; nothing sent', async (_screen, open) => {
    const h = await harness({vault: UNREADABLE});
    await open(h);
    expect(visible(el('v-damaged'))).toBe(true);
    expect(text(el('dmg-unreadable'))).toBe('Wallet data is damaged');
    expect(text(el('dmg-unreadable-body'))).toBe("This browser's copy of your wallet can't be read by this or any later version of Noctura. Your funds are on Solana. After you remove this copy, only your recovery phrase reaches them.");
    // Said before any typed word (Minor 6), and never "funds are safe".
    expect(el('dmg-unreadable-body').querySelector('b')?.textContent).toBe('only your recovery phrase reaches them');
    expect(text(el('v-damaged'))).not.toMatch(/safe/i);
    expect(visible(el('dmg-refused'))).toBe(false);
    expect(visible(el('dmg-save'))).toBe(true);
    expect(visible(el('dmg-remove'))).toBe(true);
    expect(text(el('dmg-remove'))).toBe('Remove damaged wallet');
    // Save comes before Remove (§2.3).
    expect([...el('v-damaged').querySelectorAll('.sticky-bar > *')].map(e => e.id)).toEqual(['dmg-save', 'dmg-remove']);
    click(el('dmg-remove'));
    expect(h.went).toEqual(['unlock.html?mode=remove-damaged']);
    expect(h.sent).toEqual([]);
    expect(unstyled('v-damaged')).toEqual([]);
  });

  it.each([
    ['#9', (h: Harness) => mountUnlock(h.deps).show(null)],
    ['#1', (h: Harness) => mountWelcome(h.deps, {create: () => undefined, import: () => undefined}).show()],
  ] as const)('%s: a vault refused by this version (F2–F8, F13–F17) → "update the extension", Save, and NO removal (R4)', async (_screen, open) => {
    for (const [name, env] of F.filter(([n]) => !F_WALLETS.includes(n.split(' ')[0] ?? ''))) {
      loadPage();
      const h = await harness({vault: env});
      await open(h);
      expect([name, visible(el('dmg-refused'))]).toEqual([name, true]);
      // E19: a short heading; the sentence that says why is the body's first line.
      expect(text(el('dmg-refused'))).toBe('Update Noctura to open this wallet');
      expect(el('dmg-refused').querySelector('h1')?.textContent).toBe('Update Noctura to open this wallet');
      expect(el('dmg-refused-body').firstElementChild?.textContent).toBe("This version of Noctura can't open this wallet's data.");
      expect(text(el('dmg-refused-body'))).toBe(
        "This version of Noctura can't open this wallet's data. Update Noctura (in Chrome: Extensions → Update). If it is up to date, the data may have been changed. Nothing was removed. Your funds stay on Solana; your recovery phrase still controls them. To use them here, remove Noctura from this browser, install it again and import the phrase.",
      );
      expect(visible(el('dmg-unreadable'))).toBe(false);
      expect(visible(el('dmg-save'))).toBe(true);
      expect([name, visible(el('dmg-remove')), el<HTMLButtonElement>('dmg-remove').disabled]).toEqual([name, false, true]);
      // A listener a stray event still reaches does not act — with the button made clickable, a click goes nowhere: the
      // removal is offered only for `unreadable`.
      el<HTMLButtonElement>('dmg-remove').disabled = false;
      click(el('dmg-remove'));
      expect([name, h.went, h.sent]).toEqual([name, [], []]);
      expect(saved('dmg-save').text).toBe(JSON.stringify(env));
    }
  });

  it('a wallet (F_WALLETS: F0, F1, F9–F12, F18) never shows the damaged screen on #9 or #1', async () => {
    for (const [name, env] of F.filter(([n]) => F_WALLETS.includes(n.split(' ')[0] ?? ''))) {
      loadPage();
      const h = await harness({vault: env});
      await mountUnlock(h.deps).show(null);
      expect([name, visible(el('v-damaged')), visible(el('unl-entry'))]).toEqual([name, false, true]);
      loadPage();
      await mountWelcome(h.deps, {create: () => undefined, import: () => undefined}).show();
      expect([name, visible(el('v-damaged')), text(el('wel-notice-line'))]).toEqual([name, false, 'A wallet already exists in this browser. Nothing was changed.']);
    }
  });

  it('#9: an attempt that ends `damaged` over a wallet (its seed fails AES-GCM after the unwrap, §2.1 out of the predicate) keeps the damaged notice — never the removal', async () => {
    // A wallet at the page's test cost with its ciphertext's first character changed: still well formed, and its
    // password still unwraps the data key.
    const env = await createEnvelope({mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: FIXTURE_ACCOUNT}], kdf: testKdf});
    const broken = {...env, seed: {...env.seed, ct: `${env.seed.ct.startsWith('A') ? 'B' : 'A'}${env.seed.ct.slice(1)}`}};
    const h = await harness({vault: broken});
    await mountUnlock(h.deps).show(null);
    type(el<HTMLInputElement>('unl-password'), PASSWORD);
    click(el('unl-submit'));
    await h.until(() => visible(el('unl-notice')) && !h.deps.gate.isBusy());
    expect(text(el('unl-notice-line'))).toBe("This wallet's stored data is damaged.");
    expect(visible(el('v-damaged'))).toBe(false);
    expect(h.sent.filter(m => m.type === 'vault.setKeys')).toEqual([]);
  }, 60_000);
});

describe('"Save the damaged data" (B1e §2.3, E10, R4)', () => {
  it('carries exactly the bytes the digest hashes — the digest the removal then sends — named by its first 8 hex', async () => {
    const surrogate = edited(e => {
      e.seed = 1;
      e.accounts = [{index: 0, name: '\uD800', publicKey: FIXTURE_ACCOUNT}];
    });
    for (const [name, raw] of [...DELETABLE, ['a lone surrogate in a name', surrogate] as const]) {
      loadPage();
      const h = await removal(raw);
      const file = saved('rd-save');
      expect([name, file.text]).toEqual([name, JSON.stringify(raw)]);
      expect([name, file.name]).toEqual([name, `noctura-damaged-wallet-${digestOf(raw).slice(0, 8)}.json`]);
      await confirmRemoval(h);
      expect([name, forgets(h)]).toEqual([name, [{type: 'vault.forgetDamaged', expectedDigest: createHash('sha256').update(Buffer.from(file.text, 'utf8')).digest('hex')}]]);
      expect([name, h.went]).toEqual([name, ['unlock.html?mode=welcome']]);
    }
  }, 60_000);

  it('the damaged screen’s link carries the same bytes on both states, and is offered before any removal', async () => {
    for (const raw of [UNREADABLE, REFUSED]) {
      loadPage();
      const h = await harness({vault: raw});
      await mountUnlock(h.deps).show(null);
      expect(saved('dmg-save')).toEqual({name: `noctura-damaged-wallet-${digestOf(raw).slice(0, 8)}.json`, text: JSON.stringify(raw)});
    }
  });

  it('no object URL, no text/html, and no new permission (the link is a plain data:application/json download)', async () => {
    await removal(UNREADABLE);
    for (const id of ['rd-save', 'dmg-save']) expect(el(id).tagName).toBe('A');
    expect(el('rd-save').getAttribute('href')).not.toMatch(/^blob:|text\/html/);
  });
});

describe('the removal screen (B1e §2.2)', () => {
  it('names the lowest-index readable address, never accounts[0]; the lines; no password field', async () => {
    const raw = edited(e => {
      e.seed = 'damaged';
      e.accounts = [
        {index: 3, name: 'Three', publicKey: K1},
        {index: 1, name: 'One', publicKey: FIXTURE_ACCOUNT},
        {index: 0, name: 'Zero', publicKey: 'not an address'},
        {index: -1, name: 'Neg', publicKey: K1},
        null,
      ];
    });
    expect(readableAddress(raw)).toBe(FIXTURE_ACCOUNT);
    const h = await removal(raw);
    expect(visible(el('rd-entry'))).toBe(true);
    expect([...el('rd-address').querySelectorAll('.addr-groups > span')].map(g => g.textContent)).toEqual(FIXTURE_ACCOUNT.match(/.{1,4}/g));
    expect(visible(el('rd-no-address'))).toBe(false);
    expect(text(el('rd-entry'))).toContain('This removes the wallet from this browser only.');
    expect(text(el('rd-entry'))).toContain('Your funds are on Solana. After you remove this copy, only your recovery phrase reaches them.');
    expect(el('v-remove-damaged').querySelector('input[type="password"]')).toBeNull();
    expect(text(el('rd-entry'))).not.toContain('Zero');
    expect(h.sent).toEqual([]);
    expect(unstyled('v-remove-damaged')).toEqual([]);
  });

  it('no readable address: "The address can\'t be read"', async () => {
    for (const raw of [null, [], 'x', edited(e => (e.accounts = {})), edited(e => (e.accounts = [{index: '0', publicKey: FIXTURE_ACCOUNT}]))]) {
      loadPage();
      expect(readableAddress(raw)).toBeNull();
      await removal(raw);
      expect(visible(el('rd-address'))).toBe(false);
      expect(text(el('rd-no-address'))).toBe("The address can't be read");
    }
  });

  it('typed DELETE + the full hold removes it: one forgetDamaged, the wallet data gone, then #1', async () => {
    const h = await removal(UNREADABLE);
    for (const key of WALLET_DATA_KEYS) await h.ext.local.set(key, ['x']);
    await confirmRemoval(h);
    expect(forgets(h)).toEqual([{type: 'vault.forgetDamaged', expectedDigest: digestOf(UNREADABLE)}]);
    expect(await h.ext.local.get(VAULT_KEY)).toBeUndefined();
    for (const key of WALLET_DATA_KEYS) expect(await h.ext.local.get(key)).toBeUndefined();
    expect(h.went).toEqual(['unlock.html?mode=welcome']);
  });

  it('without the word, or with the word not exact, the button refuses a press; nothing sent', async () => {
    const h = await removal(UNREADABLE);
    for (const typed of ['', 'DEL', 'delete', 'DELETE ', 'DELETEX']) {
      type(el<HTMLInputElement>('rd-word'), typed);
      expect([typed, el<HTMLButtonElement>('rd-hold').disabled]).toEqual([typed, true]);
      press();
      h.timers.advance(HOLD_MS * 2);
      releaseHold();
    }
    await h.until(() => !h.deps.gate.isBusy());
    expect(forgets(h)).toEqual([]);
    expect(await h.ext.local.get(VAULT_KEY)).toEqual(UNREADABLE);
  });

  it('a hold released before the full second removes nothing; held again for the full second it does', async () => {
    const h = await removal(UNREADABLE);
    type(el<HTMLInputElement>('rd-word'), 'DELETE');
    expect(el<HTMLButtonElement>('rd-hold').disabled).toBe(false);
    press();
    h.timers.advance(HOLD_MS - HOLD_TICK_MS);
    expect(text(el('rd-hold'))).toMatch(/^Hold to delete · 0\.\d s$/);
    releaseHold();
    h.timers.advance(HOLD_MS);
    expect(text(el('rd-hold'))).toBe('Hold to delete');
    expect(forgets(h)).toEqual([]);
    press();
    h.timers.advance(HOLD_MS + HOLD_TICK_MS);
    await h.until(() => h.went.length > 0);
    expect(forgets(h)).toHaveLength(1);
  });

  it('Enter in the word field confirms nothing; Space or Enter held on the button is the hold', async () => {
    const h = await removal(UNREADABLE);
    type(el<HTMLInputElement>('rd-word'), 'DELETE');
    el('rd-word').dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
    h.timers.advance(HOLD_MS * 2);
    expect(forgets(h)).toEqual([]);
    el('rd-hold').dispatchEvent(new KeyboardEvent('keydown', {key: ' ', bubbles: true, cancelable: true}));
    h.timers.advance(HOLD_MS + HOLD_TICK_MS);
    await h.until(() => h.went.length > 0);
    expect(forgets(h)).toHaveLength(1);
  });

  it('the value replaced by another unreadable one between the screen and the click: nothing sent, the new value shown with the line', async () => {
    const h = await removal(UNREADABLE);
    await h.ext.local.set(VAULT_KEY, OTHER_UNREADABLE);
    await confirmRemoval(h);
    expect(forgets(h)).toEqual([]);
    expect(await h.ext.local.get(VAULT_KEY)).toEqual(OTHER_UNREADABLE);
    expect(text(el('rd-helper'))).toBe('The stored data changed — check it again');
    // The screen read again: it now offers the NEW value (its bytes, its digest), the word cleared.
    expect(saved('rd-save').text).toBe(JSON.stringify(OTHER_UNREADABLE));
    expect(el<HTMLInputElement>('rd-word').value).toBe('');
    await confirmRemoval(h);
    expect(forgets(h)).toEqual([{type: 'vault.forgetDamaged', expectedDigest: digestOf(OTHER_UNREADABLE)}]);
  });

  it('the background answers busy (replaced after the page compared): the line, the screen reads again, nothing removed', async () => {
    const h = await harness({
      vault: UNREADABLE,
      send: inner => async m => {
        if ((m as {type: string}).type === 'vault.forgetDamaged') await h.ext.local.set(VAULT_KEY, OTHER_UNREADABLE);
        return inner(m);
      },
    });
    await mountRemoveDamaged(h.deps, mountDamaged(h.deps)).show();
    await confirmRemoval(h);
    expect(forgets(h)).toHaveLength(1);
    expect(await h.ext.local.get(VAULT_KEY)).toEqual(OTHER_UNREADABLE);
    expect(text(el('rd-helper'))).toBe('The stored data changed — check it again');
    expect(saved('rd-save').text).toBe(JSON.stringify(OTHER_UNREADABLE));
  });

  it('a value that became readable meanwhile is never removed: refused → the refused state; a wallet → "A wallet already exists"', async () => {
    for (const [next, check] of [
      [REFUSED, () => expect(visible(el('dmg-refused'))).toBe(true)],
      [F[0]?.[1], () => expect(text(el('rd-notice-line'))).toBe('A wallet already exists in this browser. Nothing was changed.')],
    ] as const) {
      loadPage();
      const h = await removal(UNREADABLE);
      await h.ext.local.set(VAULT_KEY, next);
      await confirmRemoval(h);
      expect(forgets(h)).toEqual([]);
      expect(await h.ext.local.get(VAULT_KEY)).toEqual(next);
      check();
    }
  });

  it('opened over a refused vault or a wallet it offers no removal at all', async () => {
    let h = await removal(REFUSED);
    expect(visible(el('v-damaged'))).toBe(true);
    expect(visible(el('dmg-remove'))).toBe(false);
    expect(visible(el('v-remove-damaged'))).toBe(false);
    loadPage();
    h = await removal(F[0]?.[1]);
    expect(visible(el('rd-entry'))).toBe(false);
    expect(visible(el('rd-hold'))).toBe(false);
    expect(text(el('rd-notice-help'))).toBe('Open the Noctura icon to use it.');
    // Its own way out, and no second one: [Close this tab] without the bar's Cancel.
    expect([visible(el('rd-close')), visible(el('rd-cancel'))]).toEqual([true, false]);
    type(el<HTMLInputElement>('rd-word'), 'DELETE');
    press();
    h.timers.advance(HOLD_MS * 2);
    expect(forgets(h)).toEqual([]);
  });

  it('a send still open (E12): #37’s line, nothing removed, the record kept; Start again reads again', async () => {
    const h = await removal(UNREADABLE);
    await h.ext.local.set(PENDING_KEY, [pendingRecord({state: 'pending'})]);
    await confirmRemoval(h);
    expect(text(el('rd-notice-line'))).toBe(DELETE_TEXT.sendOpen);
    expect(await h.ext.local.get(VAULT_KEY)).toEqual(UNREADABLE);
    expect([visible(el('rd-again')), visible(el('rd-close')), visible(el('rd-cancel'))]).toEqual([true, true, false]);
    click(el('rd-again'));
    await h.until(() => visible(el('rd-entry')) && !h.deps.gate.isBusy());
    expect(el<HTMLInputElement>('rd-word').value).toBe('');
  });

  it('a session back between the lock and the removal: "Noctura was unlocked meanwhile — try again", nothing removed', async () => {
    const h = await removal(UNREADABLE);
    const clear = h.ext.session.clear.bind(h.ext.session);
    h.ext.session.clear = async () => {
      await clear();
      void setSession(h.ext, [ACCOUNT]);
    };
    await confirmRemoval(h);
    expect(text(el('rd-notice-line'))).toBe('Noctura was unlocked meanwhile — try again');
    expect(await h.ext.local.get(VAULT_KEY)).toEqual(UNREADABLE);
  });

  it('a send that fails (the background unreachable): the failed line, the confirmation asked again', async () => {
    const h = await harness({
      vault: UNREADABLE,
      send: inner => async m => {
        if ((m as {type: string}).type === 'vault.forgetDamaged') throw new Error('Could not establish connection.');
        return inner(m);
      },
    });
    await mountRemoveDamaged(h.deps, mountDamaged(h.deps)).show();
    await confirmRemoval(h);
    expect(text(el('rd-helper'))).toBe('Something went wrong. Nothing was deleted.');
    expect(el<HTMLInputElement>('rd-word').value).toBe('');
    expect(await h.ext.local.get(VAULT_KEY)).toEqual(UNREADABLE);
  });

  it('Cancel and the X close the tab; nothing sent', async () => {
    const h = await removal(UNREADABLE);
    click(el('rd-cancel'));
    await h.until(() => !h.deps.gate.isBusy());
    click(el('rd-x'));
    await h.until(() => !h.deps.gate.isBusy());
    expect(h.closed).toBe(2);
    expect(h.sent).toEqual([]);
  });

  it('unlock.html?mode=remove-damaged mounts this screen (and only the URL names it — no parameter is read)', async () => {
    expect(pageMode('?mode=remove-damaged')).toEqual({mode: 'remove-damaged'});
    expect(pageMode('?mode=remove-damaged&digest=00')).toEqual({mode: 'remove-damaged'});
    const h = await harness({vault: UNREADABLE});
    startMode(pageMode('?mode=remove-damaged'), h.deps);
    await h.until(() => visible(el('rd-entry')));
    expect(saved('rd-save').text).toBe(JSON.stringify(UNREADABLE));
  });
});

describe('#37’s words and hold, as the popup has them (E11)', () => {
  it('the word, the hold and its tick are the popup’s; the copy is DELETE_TEXT’s', () => {
    expect([CONFIRM_WORD, HOLD_MS, HOLD_TICK_MS]).toEqual([WORD, POPUP_HOLD_MS, POPUP_TICK_MS]);
    expect([TYPED_DELETE.caseSensitive, TYPED_DELETE.notAPrefix, TYPED_DELETE.keepGoing(3)]).toEqual([DELETE_TEXT.caseSensitive, DELETE_TEXT.notAPrefix, DELETE_TEXT.keepGoing(3)]);
    loadPage();
    expect(el<HTMLInputElement>('rd-word').placeholder).toBe(DELETE_TEXT.placeholder);
    expect(text(el('rd-eyebrow'))).toBe(`${DELETE_TEXT.typeLead}${DELETE_TEXT.typeWord}${DELETE_TEXT.typeTail}`);
    expect(text(el('rd-matched'))).toBe(DELETE_TEXT.matched);
    expect(text(el('rd-caption'))).toBe(DELETE_TEXT.holdCaption);
    expect(text(el('rd-hold'))).toBe(DELETE_TEXT.hold);
  });
});
