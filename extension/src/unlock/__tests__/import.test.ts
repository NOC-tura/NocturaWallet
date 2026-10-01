// @vitest-environment happy-dom
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createEnvelope, decryptMnemonic, unlockWithPassword, type EnvelopeV1} from '../../vault/envelope';
import {VAULT_KEY} from '../../background/accountsStore';
import {importCandidates} from '../onboarding';
import {IDLE_WARN_MS, IDLE_WIPE_MS, mountImport} from '../screens/importScreen';
import {createImportRun} from '../screens/importRun';
import {mountPassword} from '../screens/password';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible, type Harness} from './pageHarness';

const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const KCLI = 'EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o';
const PW = 'a long enough password';
/** A valid 24-word phrase of 24 distinct words none of the page's static copy uses: what the leak detector looks for. */
const PHRASE = 'wonder sauce regret hover leopard hundred luxury home wise frost naive body company wedding want sponsor buyer birth february friend frequent neglect draw pond';
const WORDS = PHRASE.split(' ');
const PARTIAL = 'legend frost marble river coral anchor valid echo raven';

/**
 * Everything the page carries as strings — every text node on its own and every attribute value (Task 7's
 * leak detector, as create.test.ts has it) — counted per phrase word above the page's static baseline. A
 * field's typed `value` is not in either: each test asserts `value` itself.
 */
const pageStrings = (): string => {
  const texts: string[] = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n !== null; n = walk.nextNode()) texts.push(n.nodeValue ?? '');
  return [...texts, ...[...document.body.querySelectorAll('*')].flatMap(e => [...e.attributes].map(a => a.value))].join('\n');
};
const counts = (words: readonly string[]): number[] => {
  const all = pageStrings();
  return words.map(w => (all.match(new RegExp(`(?<![a-z-])${w}(?![a-z-])`, 'g')) ?? []).length);
};
let baseline: number[] = [];
const leaked = (): string[] => {
  const now = counts(WORDS);
  return WORDS.flatMap((w, i) => Array.from({length: Math.max(0, (now.at(i) ?? 0) - (baseline.at(i) ?? 0))}, () => w));
};

beforeEach(() => {
  loadPage();
  baseline = counts(WORDS);
});

/** Waits until the button is enabled — what a person (and Playwright) waits for — then clicks it. */
async function press(h: Harness, id: string): Promise<void> {
  await h.until(() => !el<HTMLButtonElement>(id).disabled);
  click(el(id));
}
/** A stray event on a button the page drew disabled: happy-dom drops clicks on disabled buttons, so lift it first. */
function force(id: string): void {
  el<HTMLButtonElement>(id).disabled = false;
  click(el(id));
}

describe('#8 import: the screen (spec §3.8)', () => {
  async function shown(o: {holdSleep?: boolean} = {}) {
    const h = await harness(o);
    const next: string[] = [];
    const backs: number[] = [];
    const screen = mountImport(h.deps, {back: () => backs.push(1), next: async p => void next.push(p)});
    screen.show();
    return {h, next, backs, screen, field: el<HTMLTextAreaElement>('imp-phrase'), cta: el<HTMLButtonElement>('imp-continue')};
  }

  it('phrase idle: the title, lede, placeholder and the D8 banner; no backup file, no segmented control, no clipboard claim (D1, D17)', async () => {
    const {field, cta} = await shown();
    const screen = el('v-import');
    expect(text(screen.querySelector('.top-bar .title'))).toBe('Import wallet');
    expect(text(screen.querySelector('.vlt-import-lede'))).toBe('Bring an existing wallet onto this device.');
    expect(field.placeholder).toBe('Enter your 12 or 24-word recovery phrase, separated by spaces.');
    expect([field.getAttribute('autocomplete'), field.getAttribute('spellcheck')]).toEqual(['off', 'false']);
    expect(text(screen.querySelector('.banner.info:not(.toast)'))).toBe(
      "This phrase is also the root of the Noctura phone app's future private (shielded) keys — anyone who gets it from this browser gets those too. Accounts after the first one exist only in this extension until the phone app supports more than one account.",
    );
    expect(cta.disabled).toBe(true);
    expect(text(screen)).not.toMatch(/Backup file|Screenshots|auto-clears from clipboard|clipboard cleared/);
    expect(screen.querySelector('.seg')).toBeNull();
    expect(visible(el('imp-grid'))).toBe(false);
    expect(unstyled('v-import')).toEqual([]);
  });

  it('typing: the words in the mono cell grid and "N of 12 words entered."; Continue stays off until a valid phrase', async () => {
    const {field, cta} = await shown();
    type(field, PARTIAL);
    expect([...el('imp-grid').querySelectorAll('.w')].map(text).slice(0, 10)).toEqual(['01 legend', '02 frost', '03 marble', '04 river', '05 coral', '06 anchor', '07 valid', '08 echo', '09 raven', '10 …']);
    expect(el('imp-grid').querySelectorAll('.w.empty')).toHaveLength(3);
    expect(text(el('imp-count'))).toBe('9 of 12 words entered.');
    expect(cta.disabled).toBe(true);
    expect(visible(el('imp-toast'))).toBe(false);
    expect(unstyled('v-import')).toEqual([]);
  });

  it('past twelve words the grid and the counter target 24', async () => {
    const {field} = await shown();
    type(field, WORDS.slice(0, 13).join(' '));
    expect(el('imp-grid').querySelectorAll('.w')).toHaveLength(24);
    expect(el('imp-grid').querySelectorAll('.w.empty')).toHaveLength(11);
    expect(text(el('imp-count'))).toBe('13 of 24 words entered.');
  });

  it('invalid-mnemonic inline (ruling 3): twelve list words with a bad checksum — the refusal line, no counter, Continue off', async () => {
    const {field, cta} = await shown();
    type(field, 'abandon '.repeat(12).trim());
    expect(el('imp-grid').querySelectorAll('.w:not(.empty)')).toHaveLength(12);
    expect(visible(el('imp-invalid'))).toBe(true);
    expect(text(el('imp-invalid'))).toBe('That is not a valid 12- or 24-word recovery phrase.');
    expect(visible(el('imp-count'))).toBe(false);
    expect(visible(el('imp-valid'))).toBe(false);
    expect(cta.disabled).toBe(true);
    expect(unstyled('v-import')).toEqual([]);
  });

  it('invalid-mnemonic inline: a typo in a 12-word phrase', async () => {
    const {field, cta} = await shown();
    type(field, M.replace('about', 'abuot'));
    expect(text(el('imp-invalid'))).toBe('That is not a valid 12- or 24-word recovery phrase.');
    expect(cta.disabled).toBe(true);
    // Corrected, it is the phrase again.
    type(field, M);
    expect(visible(el('imp-invalid'))).toBe(false);
    expect(cta.disabled).toBe(false);
  });

  it('invalid-mnemonic inline: 25 words — the refusal, the grid capped at 24 cells, never "25 of 24"', async () => {
    const {field, cta} = await shown();
    type(field, `${PHRASE} wonder`);
    expect(visible(el('imp-invalid'))).toBe(true);
    expect(el('imp-grid').querySelectorAll('.w')).toHaveLength(24);
    expect(visible(el('imp-count'))).toBe(false);
    expect(text(el('v-import'))).not.toContain('of 24 words');
    expect(cta.disabled).toBe(true);
  });

  it('invalid-mnemonic inline: from 12 words on, a finished word not on the BIP-39 list; the word still being typed is not judged', async () => {
    const {field} = await shown();
    const twelve = WORDS.slice(0, 12).join(' ');
    type(field, `${twelve} wo`);
    expect(visible(el('imp-invalid'))).toBe(false);
    expect(text(el('imp-count'))).toBe('13 of 24 words entered.');
    type(field, `${twelve} wonderz `);
    expect(visible(el('imp-invalid'))).toBe(true);
    expect(visible(el('imp-count'))).toBe(false);
    // Below 12 words nothing is judged yet.
    type(field, 'wonderz sauce ');
    expect(visible(el('imp-invalid'))).toBe(false);
    expect(text(el('imp-count'))).toBe('2 of 12 words entered.');
  });

  it('NFKD (fix round 1, item 6): a precomposed or a decomposed accent reads as the plain word; a Cyrillic homoglyph is refused', async () => {
    const {field, cta} = await shown();
    const precomposed = String.fromCharCode(0xe1); // a with acute, one code point
    const decomposed = `a${String.fromCharCode(0x301)}`; // a + combining acute
    for (const a of [precomposed, decomposed]) {
      type(field, M.replace('abandon', `${a}bandon`));
      expect(text(el('imp-grid').querySelector('.w'))).toBe('01 abandon');
      expect(text(el('imp-valid'))).toBe('Valid 12-word BIP-39 phrase · checksum OK');
      expect(cta.disabled).toBe(false);
    }
    const cyrillicA = String.fromCharCode(0x430);
    type(field, M.replace('abandon', `${cyrillicA}bandon`));
    expect(text(el('imp-grid').querySelector('.w'))).toBe('01 bandon');
    expect(visible(el('imp-invalid'))).toBe(true);
    expect(cta.disabled).toBe(true);
  });

  it('a bad checksum is refused by the click itself too, not only by `disabled` (24 valid words, the last one changed)', async () => {
    const {field, cta, next} = await shown();
    type(field, [...WORDS.slice(0, 23), 'zoo'].join(' '));
    expect(cta.disabled).toBe(true);
    force('imp-continue');
    await new Promise(r => setTimeout(r, 5));
    expect(next).toEqual([]);
  });

  it('paste-detected: the toast that does not claim to clear the clipboard, the grid, "Valid 12-word … checksum OK", Continue on', async () => {
    const {field, cta, next} = await shown();
    field.dispatchEvent(new Event('paste', {bubbles: true}));
    type(field, M);
    expect(visible(el('imp-toast'))).toBe(true);
    expect(text(el('imp-toast'))).toBe('Pasted from clipboard. Noctura cannot clear your clipboard — clear it yourself.');
    expect(el('imp-grid').querySelectorAll('.w')).toHaveLength(12);
    expect(text(el('imp-valid'))).toBe('Valid 12-word BIP-39 phrase · checksum OK');
    expect(visible(el('imp-count'))).toBe(false);
    expect(cta.disabled).toBe(false);
    expect(unstyled('v-import')).toEqual([]);
    // The next keystroke that is not a paste takes the toast away.
    type(field, `${M} `);
    expect(visible(el('imp-toast'))).toBe(false);
    click(cta);
    await new Promise(r => setTimeout(r, 5));
    expect(next).toEqual([`${M} `]);
  });

  it('a pasted 24-word phrase: 24 cells and "Valid 24-word BIP-39 phrase · checksum OK"', async () => {
    const {field, cta} = await shown();
    field.dispatchEvent(new Event('paste', {bubbles: true}));
    type(field, PHRASE);
    expect([...el('imp-grid').querySelectorAll('.w')].map(text)).toEqual(WORDS.map((w, i) => `${String(i + 1).padStart(2, '0')} ${w}`));
    expect(text(el('imp-valid'))).toBe('Valid 24-word BIP-39 phrase · checksum OK');
    expect(cta.disabled).toBe(false);
  });

  it('the page never reads the clipboard: no clipboard API, no paste command, no clipboardData anywhere in src/unlock', () => {
    const dir = join(__dirname, '..');
    const files = readdirSync(dir, {recursive: true, encoding: 'utf8'}).filter(f => f.endsWith('.ts') && !f.includes('__tests__'));
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) expect([f, readFileSync(join(dir, f), 'utf8')]).not.toEqual([f, expect.stringMatching(/navigator\.clipboard|clipboardData|readText|execCommand/)]);
  });

  // Rule 6 (§7.6): the page's one gate — a second Continue before the first settles does nothing.
  it('rule 6: a second Continue before the first settles runs nothing more — tested past a lifted `disabled`', async () => {
    const h = await harness();
    let calls = 0;
    let finish: () => void = () => undefined;
    mountImport(h.deps, {back: () => undefined, next: () => (calls++, new Promise<void>(r => (finish = r)))}).show();
    type(el<HTMLTextAreaElement>('imp-phrase'), M);
    click(el('imp-continue'));
    expect(el<HTMLButtonElement>('imp-continue').disabled).toBe(true);
    expect(el<HTMLTextAreaElement>('imp-phrase').disabled).toBe(true);
    force('imp-continue');
    force('imp-back');
    expect(calls).toBe(1);
    finish();
    await h.until(() => !h.deps.gate.isBusy());
    // Back in the typing phase: the 500 ms floor still applies to the next click.
    expect(el<HTMLButtonElement>('imp-continue').disabled).toBe(false);
  });

  it('rule 6: inside the 500 ms floor a lifted Continue, Back or Keep runs nothing; each acts only in its own phase', async () => {
    const {h, field, next, backs} = await shown({holdSleep: true});
    type(field, M);
    click(el('imp-continue'));
    // `next` resolved at once, but the floor holds the gate.
    await new Promise(r => setTimeout(r, 5));
    expect(next).toEqual([M]);
    expect(h.deps.gate.isBusy()).toBe(true);
    force('imp-continue');
    force('imp-back');
    await new Promise(r => setTimeout(r, 5));
    expect([next.length, backs.length]).toEqual([1, 0]);
    h.wake();
    await h.until(() => !h.deps.gate.isBusy());
    // Off-phase: no choice is open, so a stray pick does nothing (and takes no gate).
    force('imp-choose-cli');
    expect(h.deps.gate.isBusy()).toBe(false);
  });

  it('idle-timer: "Auto-clearing in 12 s" after 48 s without input, [Keep working] resets it, and at 60 s the field and the grid are wiped', async () => {
    const {h, field} = await shown();
    type(field, PARTIAL);
    h.timers.advance(IDLE_WARN_MS);
    expect(visible(el('imp-idle'))).toBe(true);
    expect(text(el('imp-idle'))).toBe('Auto-clearing in 12 s No activity for 60 s — phrase will be wiped from this field.');
    expect(text(el('imp-keep'))).toBe('Keep working — reset timer');
    expect(visible(el('imp-keep'))).toBe(true);
    expect(unstyled('v-import')).toEqual([]);
    // Item 5: a polite status, the per-second title hidden from screen readers; the live region speaks once.
    expect(el('imp-idle').getAttribute('role')).toBe('status');
    expect(el('imp-idle-title').closest('[aria-hidden="true"]')).not.toBeNull();
    expect(el('imp-idle-live').getAttribute('aria-live')).toBe('polite');
    expect(text(el('imp-idle-live'))).toBe('Auto-clearing in 12 s');
    h.timers.advance(1_000);
    expect(text(el('imp-idle-title'))).toBe('Auto-clearing in 11 s');
    expect(text(el('imp-idle-live'))).toBe('Auto-clearing in 12 s');
    click(el('imp-keep'));
    expect(visible(el('imp-idle'))).toBe(false);
    h.timers.advance(IDLE_WARN_MS);
    expect(visible(el('imp-idle'))).toBe(true);
    h.timers.advance(IDLE_WIPE_MS - IDLE_WARN_MS);
    expect(field.value).toBe('');
    expect(text(el('imp-idle-live'))).toBe('The phrase was wiped from this field.');
    expect(visible(el('imp-grid'))).toBe(false);
    expect(el('imp-grid').children).toHaveLength(0);
    expect(visible(el('imp-count'))).toBe(false);
    expect(visible(el('imp-idle'))).toBe(false);
    expect(visible(el('imp-keep'))).toBe(false);
    // The timer stops with the wipe.
    expect(h.timers.pending()).toBe(0);
  });

  it('idle-timer: the wipe leaves no word of a full phrase in the DOM — text or attribute — and the field value empty', async () => {
    const {h, field} = await shown();
    field.dispatchEvent(new Event('paste', {bubbles: true}));
    type(field, PHRASE);
    expect(leaked().length).toBe(24);
    h.timers.advance(IDLE_WIPE_MS);
    expect(field.value).toBe('');
    expect(leaked()).toEqual([]);
    expect(visible(el('imp-toast'))).toBe(false);
    expect(el<HTMLButtonElement>('imp-continue').disabled).toBe(true);
  });

  it('idle-timer: typing resets it; an empty field runs no timer at all', async () => {
    const {h, field} = await shown();
    type(field, PARTIAL);
    h.timers.advance(IDLE_WARN_MS - 1_000);
    type(field, `${PARTIAL} melody`);
    h.timers.advance(IDLE_WARN_MS - 1_000);
    expect(visible(el('imp-idle'))).toBe(false);
    expect(field.value).toBe(`${PARTIAL} melody`);
    type(field, '');
    expect(h.timers.pending()).toBe(0);
  });

  it('rule 6: [Keep working] through the gate — a lifted second click inside its floor does not reset the timer again', async () => {
    const {h, field} = await shown({holdSleep: true});
    type(field, PARTIAL);
    h.timers.advance(IDLE_WARN_MS);
    click(el('imp-keep'));
    expect(h.deps.gate.isBusy()).toBe(true);
    // The field still takes typing inside Keep's floor (it follows the phase, not the gate: Task 8's M2).
    expect(field.disabled).toBe(false);
    h.timers.advance(IDLE_WARN_MS);
    expect(visible(el('imp-idle'))).toBe(true);
    force('imp-keep');
    expect(visible(el('imp-idle'))).toBe(true);
    h.timers.advance(IDLE_WIPE_MS - IDLE_WARN_MS);
    expect(field.value).toBe('');
    h.wake();
  });

  it('Back: wipes the field and the grid, then hands back — never inside the floor', async () => {
    const {h, field, backs} = await shown({holdSleep: true});
    type(field, PHRASE);
    click(el('imp-back'));
    expect(backs).toEqual([1]);
    expect(field.value).toBe('');
    expect(leaked()).toEqual([]);
    force('imp-back');
    expect(backs).toEqual([1]);
    h.wake();
  });

  it('a tab hidden on #8 keeps the phrase in the field (Scope 19); pagehide empties the field, the grid and the toast', async () => {
    const {h, field} = await shown();
    field.dispatchEvent(new Event('paste', {bubbles: true}));
    type(field, PHRASE);
    h.leave('hidden');
    expect(field.value).toBe(PHRASE);
    h.back('visible');
    expect(field.value).toBe(PHRASE);
    h.leave('pagehide');
    expect(field.value).toBe('');
    expect(leaked()).toEqual([]);
    expect(visible(el('imp-toast'))).toBe(false);
    expect(h.timers.pending()).toBe(0);
    // Ended: a stray Continue does nothing.
    force('imp-continue');
    expect(h.deps.gate.isBusy()).toBe(false);
  });
});

describe('#8 → #5 → #40: the plain import run, against the real background', () => {
  async function run(reader: NonNullable<Parameters<typeof harness>[0]>['reader'], o: {phrase?: string; send?: NonNullable<Parameters<typeof harness>[0]>['send']} = {}) {
    const h = await harness({reader, send: o.send});
    const r = createImportRun(h.deps, {password: mountPassword(h.deps), back: () => undefined});
    r.show();
    type(el<HTMLTextAreaElement>('imp-phrase'), o.phrase ?? M);
    click(el('imp-continue'));
    return {h, r};
  }
  async function setPassword(h: Harness) {
    await h.until(() => visible(el('v-password')) && !h.deps.gate.isBusy());
    expect(text(el('pw-step'))).toBe('Import · 2 / 2');
    expect(text(el('pw-eyebrow'))).toBe('Onboarding');
    type(el<HTMLInputElement>('pw-field'), PW);
    click(el('pw-cta'));
    await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('pw-field'), PW);
    click(el('pw-cta'));
    await h.until(() => h.went.length > 0);
  }
  const none = {getMultipleLamports: async (keys: readonly unknown[]) => keys.map(() => 0n)};

  it('nothing funded: the standard scheme, account 0, stored and handed over to #/imported (no #6); nothing holds the phrase after', async () => {
    const {h, r} = await run(none);
    await h.until(() => visible(el('v-password')));
    expect(r.holds()).toEqual({phrase: true});
    // Fix round 1, item 1: the probe is the background's public-key read, exactly — nothing else rides on it.
    const keys = (await importCandidates(M)).map(c => c.publicKey);
    expect(keys).toContain(K0);
    expect(keys).toContain(KCLI);
    expect(h.sent).toEqual([{type: 'wallet.probeBalances', publicKeys: keys}]);
    // And no message carries a word of the phrase.
    for (const m of h.sent) expect(JSON.stringify(m)).not.toMatch(/(?<![a-z])(abandon|about)(?![a-z])/);
    // The field and grid were emptied when the run moved on to #5.
    expect(el<HTMLTextAreaElement>('imp-phrase').value).toBe('');
    expect(el('imp-grid').children).toHaveLength(0);
    await setPassword(h);
    expect(h.went).toEqual(['wallet.html#/imported']);
    const env = (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
    expect(env.accounts.map(a => a.publicKey)).toEqual([K0]);
    expect(await decryptMnemonic(env, await unlockWithPassword(env, PW, testKdf))).toBe(M);
    expect(visible(el('v-passkey'))).toBe(false);
    expect(r.holds()).toEqual({phrase: false});
  }, 30_000);

  it('checking: "Checking which addresses hold funds…" while the background reads the balances; the field is locked', async () => {
    const probe: {release: (() => void) | null} = {release: null};
    const {h} = await run(none, {
      send: inner => async m => {
        if ((m as {type: string}).type === 'wallet.probeBalances') await new Promise<void>(res => (probe.release = res));
        return inner(m);
      },
    });
    await h.until(() => probe.release !== null);
    expect(text(el('imp-line'))).toBe('Checking which addresses hold funds…');
    expect(visible(el('imp-line'))).toBe(true);
    expect(el<HTMLTextAreaElement>('imp-phrase').disabled).toBe(true);
    expect(el<HTMLButtonElement>('imp-continue').disabled).toBe(true);
    expect(el<HTMLButtonElement>('imp-back').disabled).toBe(true);
    expect(unstyled('v-import')).toEqual([]);
    probe.release?.();
    await h.until(() => visible(el('v-password')));
  }, 30_000);

  /** Holds the probe until `release`; `pending` once the run has sent it. */
  function heldProbe() {
    const probe: {release: (() => void) | null} = {release: null};
    const send: NonNullable<Parameters<typeof harness>[0]>['send'] = inner => async m => {
      if ((m as {type: string}).type === 'wallet.probeBalances') await new Promise<void>(res => (probe.release = res));
      return inner(m);
    };
    return {probe, send};
  }

  it('pagehide while the probe runs (item 2): once it lands nothing moves on — no line, no choice, no #5, nothing held', async () => {
    const {probe, send} = heldProbe();
    const {h, r} = await run({}, {phrase: PHRASE, send});
    await h.until(() => probe.release !== null);
    h.leave('pagehide');
    probe.release?.();
    await h.until(() => !h.deps.gate.isBusy());
    await new Promise(r2 => setTimeout(r2, 20));
    expect(r.holds()).toEqual({phrase: false});
    expect(visible(el('imp-line'))).toBe(false);
    expect(visible(el('imp-choose'))).toBe(false);
    expect(visible(el('v-password'))).toBe(false);
    expect(el<HTMLTextAreaElement>('imp-phrase').value).toBe('');
    expect(leaked()).toEqual([]);
  });

  it('a probe that hangs (ruling 7): the idle timer still runs — at 60 s the field is wiped and the run ends; the late answer moves nothing on', async () => {
    const {probe, send} = heldProbe();
    const {h, r} = await run({}, {phrase: PHRASE, send});
    await h.until(() => probe.release !== null);
    h.timers.advance(IDLE_WARN_MS);
    expect(visible(el('imp-idle'))).toBe(true);
    // Continue holds the gate while the probe runs: there is nothing to keep working on.
    expect(visible(el('imp-keep'))).toBe(false);
    h.timers.advance(IDLE_WIPE_MS - IDLE_WARN_MS);
    expect(el<HTMLTextAreaElement>('imp-phrase').value).toBe('');
    expect(leaked()).toEqual([]);
    expect(visible(el('imp-line'))).toBe(false);
    probe.release?.();
    await h.until(() => !h.deps.gate.isBusy());
    await new Promise(r2 => setTimeout(r2, 20));
    expect(r.holds()).toEqual({phrase: false});
    expect(visible(el('imp-choose'))).toBe(false);
    expect(visible(el('v-password'))).toBe(false);
    // #8 is ready for a new phrase.
    expect(el<HTMLTextAreaElement>('imp-phrase').disabled).toBe(false);
  });

  it('balances that cannot be read: the user chooses, in the design’s chrome — here the Solana CLI key', async () => {
    const {h} = await run({});
    await h.until(() => visible(el('imp-choose')) && !h.deps.gate.isBusy());
    expect(text(el('imp-choose-why'))).toBe('Balances could not be checked. Choose the address type to use.');
    expect([text(el('imp-choose-slip10')), text(el('imp-choose-cli'))]).toEqual(['Standard (Phantom/Solflare)', 'Solana CLI (solana-keygen)']);
    expect(visible(el('imp-line'))).toBe(false);
    expect(el<HTMLButtonElement>('imp-continue').disabled).toBe(true);
    expect(unstyled('v-import')).toEqual([]);
    // Continue belongs to the typing phase: a stray one during the choice checks nothing again.
    force('imp-continue');
    await new Promise(r2 => setTimeout(r2, 20));
    expect(h.sent.filter(m => m.type === 'wallet.probeBalances')).toHaveLength(1);
    expect(visible(el('imp-choose'))).toBe(true);
    click(el('imp-choose-cli'));
    await setPassword(h);
    expect(((await h.ext.local.get(VAULT_KEY)) as EnvelopeV1).accounts.map(a => a.publicKey)).toEqual([KCLI]);
  }, 30_000);

  it('both address types funded: "Both address types on this phrase hold funds…"', async () => {
    const {h} = await run({getMultipleLamports: async keys => keys.map(() => 1n)});
    await h.until(() => visible(el('imp-choose')));
    expect(text(el('imp-choose-why'))).toBe('Both address types on this phrase hold funds. Choose the one to use.');
  });

  it('rule 6 on the choice: a lifted second pick inside the first one’s floor does nothing — one #5, the first scheme', async () => {
    const h = await harness({holdSleep: true});
    const r = createImportRun(h.deps, {password: mountPassword(h.deps), back: () => undefined});
    r.show();
    type(el<HTMLTextAreaElement>('imp-phrase'), M);
    click(el('imp-continue'));
    await h.until(() => visible(el('imp-choose')));
    h.wake();
    await h.until(() => !h.deps.gate.isBusy());
    click(el('imp-choose-cli'));
    // The pick holds the page's gate for its floor: #5, shown inside it, offers nothing until it frees.
    expect(h.deps.gate.isBusy()).toBe(true);
    force('imp-choose-slip10');
    force('imp-back');
    await h.until(() => visible(el('v-password')));
    expect(el<HTMLButtonElement>('pw-back').disabled).toBe(true);
    expect(visible(el('v-import'))).toBe(false);
    h.wake();
    await h.until(() => !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('pw-field'), PW);
    click(el('pw-cta'));
    h.wake();
    await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('pw-field'), PW);
    click(el('pw-cta'));
    await h.until(() => {
      h.wake();
      return h.went.length > 0;
    });
    expect(((await h.ext.local.get(VAULT_KEY)) as EnvelopeV1).accounts.map(a => a.publicKey)).toEqual([KCLI]);
  }, 30_000);

  it('Back during the choice drops the phrase: the field and grid emptied, the run holds nothing', async () => {
    const {h, r} = await run({}, {phrase: PHRASE});
    await h.until(() => visible(el('imp-choose')) && !h.deps.gate.isBusy());
    expect(r.holds()).toEqual({phrase: true});
    click(el('imp-back'));
    await h.until(() => r.holds().phrase === false);
    expect(el<HTMLTextAreaElement>('imp-phrase').value).toBe('');
    expect(visible(el('imp-choose'))).toBe(false);
    expect(leaked()).toEqual([]);
  });

  it('the idle timer runs on the choice too: at 60 s the choice closes, the field and grid are wiped and the run drops the phrase', async () => {
    const {h, r} = await run({}, {phrase: PHRASE});
    await h.until(() => visible(el('imp-choose')) && !h.deps.gate.isBusy());
    h.timers.advance(IDLE_WARN_MS);
    expect(visible(el('imp-idle'))).toBe(true);
    h.timers.advance(IDLE_WIPE_MS - IDLE_WARN_MS);
    await h.until(() => r.holds().phrase === false);
    expect(el<HTMLTextAreaElement>('imp-phrase').value).toBe('');
    expect(visible(el('imp-choose'))).toBe(false);
    expect(leaked()).toEqual([]);
    // A stray pick after the wipe moves nothing on, and #8 still takes a new phrase.
    force('imp-choose-slip10');
    await new Promise(r2 => setTimeout(r2, 5));
    expect(visible(el('v-password'))).toBe(false);
    expect(el<HTMLTextAreaElement>('imp-phrase').disabled).toBe(false);
    // So does a stray Continue: the phrase is gone, nothing is checked.
    force('imp-continue');
    await new Promise(r2 => setTimeout(r2, 5));
    expect(visible(el('imp-line'))).toBe(false);
  });

  it('back from #5 returns to #8 with the phrase still in the field; the run no longer holds it', async () => {
    const {h, r} = await run(none);
    await h.until(() => visible(el('v-password')) && !h.deps.gate.isBusy());
    click(el('pw-back'));
    expect(visible(el('v-import'))).toBe(true);
    expect(el<HTMLTextAreaElement>('imp-phrase').value).toBe(M);
    expect(el('imp-grid').querySelectorAll('.w')).toHaveLength(12);
    expect(r.holds()).toEqual({phrase: false});
  });

  // M4 (plan review): the hidden-tab rule drops the password, never the phrase under an open #5.
  it('a tab hidden on #5 keeps the phrase: the password set after it stores the wallet — no "not a valid phrase"', async () => {
    const {h, r} = await run(none);
    await h.until(() => visible(el('v-password')) && !h.deps.gate.isBusy());
    h.leave();
    expect(r.holds()).toEqual({phrase: true});
    await setPassword(h);
    expect(text(document.body)).not.toContain('That is not a valid 12- or 24-word recovery phrase.');
    expect(h.went).toEqual(['wallet.html#/imported']);
    const env = (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
    expect(await decryptMnemonic(env, await unlockWithPassword(env, PW, testKdf))).toBe(M);
  }, 30_000);

  it('pagehide on #5 drops the phrase; a store already running lands, but the run does not move on', async () => {
    const {h, r} = await run(none);
    await h.until(() => visible(el('v-password')) && !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('pw-field'), PW);
    click(el('pw-cta'));
    await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('pw-field'), PW);
    click(el('pw-cta'));
    await h.until(() => visible(el('pw-creating')));
    h.leave('pagehide');
    expect(r.holds()).toEqual({phrase: false});
    await h.until(() => !h.deps.gate.isBusy());
    expect(await h.ext.local.get(VAULT_KEY)).toBeDefined();
    expect(h.went).toEqual([]);
  }, 30_000);

  it('a wallet stored meanwhile (exists): the #5 notice as #1 says it, and the phrase dropped', async () => {
    const {h, r} = await run(none);
    await h.until(() => visible(el('v-password')) && !h.deps.gate.isBusy());
    await h.ext.local.set(VAULT_KEY, await createEnvelope({mnemonic: M, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: K0}], kdf: testKdf}));
    await setPasswordNoGo(h);
    await h.until(() => visible(el('pw-notice')));
    expect(text(el('pw-notice'))).toBe('A wallet already exists in this browser. Nothing was changed. Open the Noctura icon to use it.');
    expect(r.holds()).toEqual({phrase: false});
    expect(h.went).toEqual([]);
  }, 30_000);

  it('a damaged vault stored meanwhile (null): the damaged lines, never "A wallet already exists"', async () => {
    const {h, r} = await run(none);
    await h.until(() => visible(el('v-password')) && !h.deps.gate.isBusy());
    await h.ext.local.set(VAULT_KEY, null);
    await setPasswordNoGo(h);
    await h.until(() => visible(el('pw-notice')));
    expect(text(el('pw-notice-line'))).toBe("This wallet's stored data is damaged.");
    expect(r.holds()).toEqual({phrase: false});
  }, 30_000);

  it('a store that fails keeps the phrase for another try', async () => {
    const {h, r} = await run(none, {send: inner => async m => ((m as {type: string}).type === 'vault.storeEnvelope' ? {ok: false, error: 'failed'} : inner(m))});
    await h.until(() => visible(el('v-password')) && !h.deps.gate.isBusy());
    await setPasswordNoGo(h);
    await h.until(() => text(el('pw-helper')) === 'Something went wrong. Nothing was saved.' && !h.deps.gate.isBusy());
    expect(r.holds()).toEqual({phrase: true});
  }, 30_000);

  /** #5's two steps, without waiting for a hand-over. */
  async function setPasswordNoGo(h: Harness) {
    type(el<HTMLInputElement>('pw-field'), PW);
    click(el('pw-cta'));
    await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('pw-field'), PW);
    click(el('pw-cta'));
  }
});

describe('#1 → #8 in one page', () => {
  it("welcome's [I have a wallet] opens #8 here; its back arrow returns to #1", async () => {
    const {startMode} = await import('../modes');
    const h = await harness();
    startMode({mode: 'welcome'}, h.deps);
    await h.until(() => visible(el('wel-actions')));
    await press(h, 'wel-import');
    expect(visible(el('v-import'))).toBe(true);
    expect(visible(el('import'))).toBe(false);
    await press(h, 'imp-back');
    await h.until(() => visible(el('wel-actions')));
    expect(visible(el('v-import'))).toBe(false);
  });

  it('?mode=import (no source) opens #8 in the plan-2 page, not the B1b-1 section', async () => {
    const {startMode} = await import('../modes');
    const h = await harness();
    startMode({mode: 'import', source: null}, h.deps);
    expect(visible(el('v-import'))).toBe(true);
    expect(visible(el('import'))).toBe(false);
    expect(visible(el('status'))).toBe(false);
  });

  it('one page gate: #2 → #3 → #2 → #1 → Import — #8 runs under the same gate #1 used', async () => {
    const {startMode} = await import('../modes');
    const h = await harness({holdSleep: true});
    const woken = async (id: string) => {
      await h.until(() => {
        h.wake();
        return !h.deps.gate.isBusy() && !el<HTMLButtonElement>(id).disabled;
      });
      click(el(id));
    };
    startMode({mode: 'create'}, h.deps);
    click(el('int-continue'));
    await woken('sg-cancel');
    click(el('int-back'));
    await h.until(() => visible(el('wel-actions')));
    await woken('wel-import');
    // #1's Import holds the page's gate: #8's buttons wait for that same gate.
    expect(h.deps.gate.isBusy()).toBe(true);
    type(el<HTMLTextAreaElement>('imp-phrase'), M);
    expect(el<HTMLButtonElement>('imp-continue').disabled).toBe(true);
    h.wake();
    await h.until(() => !el<HTMLButtonElement>('imp-continue').disabled);
  });

  it('bfcache: pagehide on #8 empties it; a page restored (pageshow persisted) starts again at #1', async () => {
    const {startMode} = await import('../modes');
    const h = await harness();
    startMode({mode: 'import', source: null}, h.deps);
    type(el<HTMLTextAreaElement>('imp-phrase'), PHRASE);
    h.leave('hidden');
    expect(el<HTMLTextAreaElement>('imp-phrase').value).toBe(PHRASE);
    h.leave('pagehide');
    expect(el<HTMLTextAreaElement>('imp-phrase').value).toBe('');
    expect(leaked()).toEqual([]);
    h.back('restored');
    await h.until(() => visible(el('wel-actions')));
    expect(visible(el('v-import'))).toBe(false);
  });

  it('bfcache: restored while the import’s store is in flight — #1 offers nothing until it lands, then says the wallet exists', async () => {
    const {startMode} = await import('../modes');
    let storeStarted = false;
    let releaseStore: () => void = () => undefined;
    const h = await harness({
      reader: {getMultipleLamports: async keys => keys.map(() => 0n)},
      send: inner => async m => {
        if ((m as {type: string}).type === 'vault.storeEnvelope') {
          storeStarted = true;
          await new Promise<void>(r => (releaseStore = r));
        }
        return inner(m);
      },
    });
    startMode({mode: 'import', source: null}, h.deps);
    type(el<HTMLTextAreaElement>('imp-phrase'), M);
    click(el('imp-continue'));
    await h.until(() => visible(el('v-password')) && !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('pw-field'), PW);
    click(el('pw-cta'));
    await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('pw-field'), PW);
    click(el('pw-cta'));
    await h.until(() => storeStarted);
    h.leave('pagehide');
    h.back('restored');
    const offered = () => visible(el('wel-actions')) || !el<HTMLButtonElement>('wel-create').disabled || !el<HTMLButtonElement>('wel-import').disabled;
    expect(visible(el('v-welcome'))).toBe(true);
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1));
      expect(offered()).toBe(false);
    }
    releaseStore();
    await h.until(() => visible(el('wel-notice')));
    expect(text(el('wel-notice-line'))).toBe('A wallet already exists in this browser. Nothing was changed.');
    expect(h.went).toEqual([]);
  }, 30_000);

  it('a sourced import (#39/#40, B1b-1 section until Tasks 12–13) runs under the page’s one gate too', async () => {
    const {startMode} = await import('../modes');
    const h = await harness();
    startMode({mode: 'import', source: 'forgot'}, h.deps);
    expect(visible(el('import'))).toBe(true);
    h.deps.gate.setBusy(true);
    click(el('import-btn'));
    await new Promise(r => setTimeout(r, 5));
    expect(text(el('status'))).toBe('');
    h.deps.gate.setBusy(false);
    click(el('import-btn'));
    await h.until(() => text(el('status')) !== '');
    expect(text(el('status'))).toBe('The password must be at least 12 characters.');
  });
});
