// @vitest-environment happy-dom
import {createEnvelope} from '../../vault/envelope';
import {mountIntro, mountWelcome} from '../screens/welcome';
import {click, el, harness, loadPage, testKdf, text, unstyled, visible} from './pageHarness';

const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';

beforeEach(loadPage);

describe('#1 welcome (spec §3.1)', () => {
  it('idle: the design’s copy, two trust chips (no "ZK-private", D6), plain-text terms, both CTAs', async () => {
    const h = await harness();
    const calls: string[] = [];
    await mountWelcome(h.deps, {create: () => calls.push('create'), import: () => calls.push('import')}).show();
    const screen = el('v-welcome');
    expect(visible(screen)).toBe(true);
    expect(text(screen.querySelector('.wordmark'))).toBe('Noctura');
    expect(text(screen.querySelector('.tagline'))).toBe('A Solana wallet built for private, non-custodial holding.');
    expect([...screen.querySelectorAll('.trust-chip')].map(text)).toEqual(['E2E encrypted', 'Non-custodial']);
    expect(text(screen)).not.toContain('ZK-private');
    expect(text(screen.querySelector('.terms'))).toBe('By continuing you agree to the Terms and Privacy Policy.');
    // "Terms" and "Privacy Policy" are text until the privacy policy exists (release gate, B1e).
    expect(screen.querySelectorAll('a')).toHaveLength(0);
    expect(visible(el('wel-actions'))).toBe(true);
    expect(text(el('wel-create'))).toBe('Create new wallet');
    expect(text(el('wel-import'))).toBe('I have a wallet');
    expect(visible(el('wel-notice'))).toBe(false);
    click(el('wel-create'));
    click(el('wel-import'));
    expect(calls).toEqual(['create', 'import']);
    expect(text(document.body)).not.toMatch(/Screenshots disabled|auto-clears/);
    expect(unstyled('v-welcome')).toEqual([]);
  });

  it('exists: a stored wallet is never set up over — the line, "Open the Noctura icon", no CTAs', async () => {
    const env = await createEnvelope({mnemonic: M, password: 'correct horse battery', scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: K0}], kdf: testKdf});
    const h = await harness({vault: env});
    await mountWelcome(h.deps, {create: () => undefined, import: () => undefined}).show();
    expect(visible(el('wel-actions'))).toBe(false);
    expect(text(el('wel-notice-line'))).toBe('A wallet already exists in this browser. Nothing was changed.');
    expect(text(el('wel-notice-help'))).toBe('Open the Noctura icon to use it.');
  });

  it('a damaged vault (a stored null, as the background reads it) says so and offers no setup over it', async () => {
    const h = await harness({vault: null});
    await mountWelcome(h.deps, {create: () => undefined, import: () => undefined}).show();
    expect(visible(el('wel-actions'))).toBe(false);
    expect(text(el('wel-notice-line'))).toBe("This wallet's stored data is damaged.");
    expect(text(el('wel-notice-help'))).toBe('Your funds stay on Solana; your recovery phrase still controls them. To use them here, remove Noctura from this browser, install it again and import the phrase.');
    expect(h.sent).toEqual([]);
  });
});

describe('#2 security-intro (spec §3.2)', () => {
  it('the three layers with the adapted copy (D7, D9), the step "1 / 5", back and Continue', () => {
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
    expect(text(screen)).toContain("If you lose all three, no one — not Noctura, not a Solana validator — can recover your funds. That's the point.");
    expect(text(screen)).not.toMatch(/PIN|Six digits|Biometric/);
    click(el('int-back'));
    click(el('int-continue'));
    expect(calls).toEqual(['back', 'continue']);
    expect(unstyled('v-intro')).toEqual([]);
  });
});
