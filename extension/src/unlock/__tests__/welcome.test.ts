// @vitest-environment happy-dom
import {createEnvelope} from '../../vault/envelope';
import {mountIntro, mountWelcome} from '../screens/welcome';
import {click, el, harness, loadPage, testKdf, text, unstyled, visible} from './pageHarness';
import {NOCTURA_PAGES} from '../../shared/links';

const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';

beforeEach(loadPage);

describe('#1 welcome (spec §3.1)', () => {
  it('idle: the wordmark, the tagline and two trust chips as B1e-2 Task 6 rewrote them (no "ZK-private", D6), the terms line with its two links, both CTAs in design order', async () => {
    const h = await harness();
    const calls: string[] = [];
    await mountWelcome(h.deps, {create: () => calls.push('create'), import: () => calls.push('import')}).show();
    const screen = el('v-welcome');
    expect(visible(screen)).toBe(true);
    expect(text(screen.querySelector('.wordmark'))).toBe('Noctura');
    expect(text(screen.querySelector('.tagline'))).toBe('A non-custodial Solana wallet. Your keys stay on this device.');
    expect([...screen.querySelectorAll('.trust-chip')].map(text)).toEqual(['Encrypted on this device', 'Non-custodial']);
    expect(text(screen)).not.toContain('ZK-private');
    expect(visible(el('wel-terms'))).toBe(true);
    expect(text(screen.querySelector('.terms'))).toBe('By continuing you agree to the Terms and Privacy Policy.');
    // B1e §4.1: "Terms" and "Privacy Policy" are the line's two links, and the screen's only ones.
    expect([...screen.querySelectorAll('a')].map(a => [a.textContent, a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel')])).toEqual([
      ['Terms', NOCTURA_PAGES.terms, '_blank', 'noopener noreferrer'],
      ['Privacy Policy', NOCTURA_PAGES.privacy, '_blank', 'noopener noreferrer'],
    ]);
    expect([...el('wel-terms').querySelectorAll('a')].map(a => a.id)).toEqual(['wel-terms-link', 'wel-privacy-link']);
    expect(visible(el('wel-actions'))).toBe(true);
    // Fix round 1 item 6: primary (Create) first, as in the design (index.html:4511-4512).
    expect([...el('wel-actions').querySelectorAll('button')].map(b => b.id)).toEqual(['wel-create', 'wel-import']);
    expect(text(el('wel-create'))).toBe('Create new wallet');
    expect(text(el('wel-import'))).toBe('I have a wallet');
    expect(visible(el('wel-notice'))).toBe(false);
    click(el('wel-create'));
    // One busy gate for the whole page (spec §7.6): Import is blocked until Create's gate frees.
    await h.until(() => !h.deps.gate.isBusy());
    click(el('wel-import'));
    expect(calls).toEqual(['create', 'import']);
    expect(text(document.body)).not.toMatch(/Screenshots disabled|auto-clears/);
    expect(unstyled('v-welcome')).toEqual([]);
  });

  it('B1e §4.1: the two links are the shared table’s, literally — what the link gate (§4.3) requires present', () => {
    expect(NOCTURA_PAGES).toEqual({terms: 'https://noc-tura.io/extension/terms', privacy: 'https://noc-tura.io/extension/privacy', help: 'https://noc-tura.io/extension/help'});
    expect(el<HTMLAnchorElement>('wel-terms-link').getAttribute('href')).toBe('https://noc-tura.io/extension/terms');
    expect(el<HTMLAnchorElement>('wel-privacy-link').getAttribute('href')).toBe('https://noc-tura.io/extension/privacy');
  });

  it('rule 6 (spec §7.6): a second click on Create, or on Import, inside 500 ms does nothing', async () => {
    const h = await harness();
    const calls: string[] = [];
    await mountWelcome(h.deps, {create: () => calls.push('create'), import: () => calls.push('import')}).show();
    click(el('wel-create'));
    click(el('wel-create'));
    expect(calls).toEqual(['create']);
    await h.until(() => !h.deps.gate.isBusy());
    click(el('wel-import'));
    click(el('wel-import'));
    expect(calls).toEqual(['create', 'import']);
  });

  it('exists: a stored wallet is never set up over — the line, "Open the Noctura icon", no CTAs', async () => {
    const env = await createEnvelope({mnemonic: M, password: 'correct horse battery', scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: K0}], kdf: testKdf});
    const h = await harness({vault: env});
    await mountWelcome(h.deps, {create: () => undefined, import: () => undefined}).show();
    expect(visible(el('wel-terms'))).toBe(false);
    expect(visible(el('wel-actions'))).toBe(false);
    expect(text(el('wel-notice-line'))).toBe('A wallet already exists in this browser. Nothing was changed.');
    expect(text(el('wel-notice-help'))).toBe('Open the Noctura icon to use it.');
    expect(visible(el('wel-notice-help'))).toBe(true);
  });

  it('a damaged vault (a stored null, as the background reads it) says so and offers no setup over it', async () => {
    const h = await harness({vault: null});
    await mountWelcome(h.deps, {create: () => undefined, import: () => undefined}).show();
    expect(visible(el('wel-terms'))).toBe(false);
    expect(visible(el('wel-actions'))).toBe(false);
    // B1e §2.2: a stored null is unreadable (U1) — the damaged screen, never the welcome's CTAs.
    expect(visible(el('v-damaged'))).toBe(true);
    expect(visible(el('v-welcome'))).toBe(false);
    expect(visible(el('dmg-unreadable'))).toBe(true);
    expect(h.sent).toEqual([]);
  });

  it('unreadable: a storage read that throws shows the notice, with no help line and no CTA', async () => {
    const h = await harness();
    h.deps.store = {
      ...h.deps.store,
      readEnvelope: async () => {
        throw new Error('boom');
      },
    };
    const calls: string[] = [];
    await mountWelcome(h.deps, {create: () => calls.push('create'), import: () => calls.push('import')}).show();
    expect(visible(el('wel-terms'))).toBe(false);
    expect(visible(el('wel-actions'))).toBe(false);
    expect(text(el('wel-notice-line'))).toBe("This wallet's stored data could not be read. Reload this page.");
    // Fix round 1 item 4: the empty help line is hidden, not rendered empty — it takes no gap.
    expect(visible(el('wel-notice-help'))).toBe(false);
    expect(text(el('wel-notice-help'))).toBe('');
    expect(h.sent).toEqual([]);
    click(el('wel-create'));
    click(el('wel-import'));
    expect(calls).toEqual([]);
  });
});

describe('#2 security-intro (spec §3.2)', () => {
  it('the three layers with the adapted copy (D7, D9), the step "1 / 5", the exact footer, back and Continue', () => {
    const calls: string[] = [];
    mountIntro({back: () => calls.push('back'), continue: () => calls.push('continue')}).show();
    const screen = el('v-intro');
    expect(visible(screen)).toBe(true);
    expect(text(screen.querySelector('.top-bar .title'))).toBe('Onboarding');
    expect(text(screen.querySelector('.top-bar .step'))).toBe('1 / 5');
    expect(text(screen.querySelector('h1'))).toBe('Three layers protect your wallet');
    expect(text(screen.querySelector('h1 + p'))).toBe('You hold the keys. We never can.');
    expect([...screen.querySelectorAll('.layer-card')].map(c => [text(c.querySelector('h3')), text(c.querySelector('p'))])).toEqual([
      ['Password', 'At least 12 characters you choose. It unlocks the wallet in this browser and is asked again before sends to new addresses or large amounts.'],
      ['Passkey (optional)', 'A fingerprint, face or security key as a shortcut. Your password still works for everything.'],
      ['Recovery seed', "24 words. Written offline. The only way back if this browser's data is lost."],
    ]);
    // Fix round 1 item 5: the exact footer, not a substring match.
    expect(text(screen.querySelector('.scroll-area .vlt-muted'))).toBe("If you lose all three, no one — not Noctura, not a Solana validator — can recover your funds. That's the point.");
    expect(text(screen)).not.toMatch(/PIN|Six digits|Biometric/);
    click(el('int-back'));
    click(el('int-continue'));
    expect(calls).toEqual(['back', 'continue']);
    expect(unstyled('v-intro')).toEqual([]);
  });
});
