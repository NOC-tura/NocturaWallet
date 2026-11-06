import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ALLOWED, CLAIMS, TIERS, claimViolations, markdownUnits, unusedAllowances} from '../claims.mjs';

// B1e §6.1, §6.4 (B1e-2 Task 6, review 1 I3): the one list of claims the extension does not keep — every pattern
// refuses its planted sentence, the names pass, each allowance holds a claim, passes on the tiers it lists and only
// there, and the three checks that read words (the UI guard, the store texts, the privacy policy) all import it.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const at = (where, text) => ({where, text});
const on = (tier, text, o = {}) => claimViolations([at('p', text)], {tier, ...o});

describe('the claims list (scripts/claims.mjs)', () => {
  it('its claims, in order; each pattern case-insensitive and not global (a /g pattern would carry lastIndex from one unit to the next)', () => {
    expect(CLAIMS.map(c => c.id)).toEqual([
      'private',
      'privacy',
      'anonymous',
      'untraceable',
      'unlinkable',
      'confidential',
      'e2e',
      'end-to-end',
      'encrypted in transit',
      'zero-knowledge',
      'shielded',
      'incognito',
      'hidden',
      'never see',
      "can't see",
      'no one can see',
      "we don't see",
      'never receive',
      'never send',
      'never leave',
      'nothing leaves',
      'stays on this device',
      'only on this device',
      'local-only',
      'offline-only',
      'offline',
      'no server',
      'no tracking',
      'bank-grade',
    ]);
    for (const c of CLAIMS) expect([c.id, c.pattern.flags]).toEqual([c.id, 'i']);
    expect(TIERS).toEqual(['source', 'built', 'store', 'policy']);
  });

  it('refuses every claim on its own, on every tier: a planted sentence each, exactly that claim', () => {
    const planted = {
      private: 'Your balance stays private.',
      privacy: 'Built for privacy.',
      anonymous: 'Send anonymously.',
      untraceable: 'Untraceable transfers.',
      unlinkable: 'Unlinkable accounts.',
      confidential: 'Confidential transfers.',
      e2e: 'E2E-encrypted vault',
      'end-to-end': 'End to end encryption',
      'encrypted in transit': 'Your data is encrypted in transit.',
      'zero-knowledge': 'Zero-knowledge proofs keep it safe.',
      shielded: 'Shielded balance',
      incognito: 'Browse incognito.',
      hidden: 'Your balance is hidden.',
      'never see': 'Noctura never sees your address.',
      "can't see": 'Sites can’t see your balance.',
      'no one can see': 'No one knows what you hold.',
      "we don't see": "We don't see your balance.",
      'never receive': 'The coordinator never receives your address.',
      'never send': 'The wallet never sends your phrase anywhere.',
      'never leave': 'Your address never leaves this device.',
      'nothing leaves': 'Nothing is sent to anyone.',
      'stays on this device': 'Your activity stays on this device.',
      'only on this device': 'Your history is saved only on this device.',
      'local-only': 'A local-only wallet.',
      'offline-only': 'An offline only flow.',
      offline: 'The wallet works offline.',
      'no server': 'No server is involved.',
      'no tracking': 'No tracking.',
      'bank-grade': 'Bank-grade security.',
    };
    expect(Object.keys(planted)).toEqual(CLAIMS.map(c => c.id));
    for (const tier of TIERS) for (const [id, text] of Object.entries(planted)) expect(on(tier, text), `${tier}: ${id}`).toEqual([`p: "${id}" in “${text}”`]);
    // A non-breaking hyphen (&#8209;) or an en dash is still a hyphen.
    expect(on('source', 'End\u2011to\u2011end encrypted, offline\u2013only, local\u2010only').length).toBe(3);
  });

  it('the blind spots review 1 named (I3), each refused by the claim that reads it', () => {
    const ids = text => on('source', text).map(v => /"(.+)" in/.exec(v)[1]);
    expect(ids('Your address never leaves this device.')).toEqual(['never leave']);
    expect(ids('We do not see your transactions.')).toEqual(["we don't see"]);
    expect(ids('Noctura cannot see your balance.')).toEqual(["can't see", "we don't see"]);
    expect(ids('We never receive your address.')).toEqual(["we don't see", 'never receive']);
    expect(ids('No one knows your balance.')).toEqual(['no one can see']);
    expect(ids('No tracking, no logs.')).toEqual(['no tracking']);
    expect(ids('Local-only by design.')).toEqual(['local-only']);
    expect(ids('Your addresses are stored only on this device.')).toEqual(['only on this device']);
    expect(ids('Your addresses stay on this device.')).toEqual(['stays on this device']);
    expect(ids('Your data stays local.')).toEqual(['stays on this device']);
    expect(ids('Transfers are confidential.')).toEqual(['confidential']);
    expect(ids('Your sends are hidden from the coordinator.')).toEqual(['hidden']);
    expect(ids('Incognito mode.')).toEqual(['incognito']);
    expect(ids('No servers — just you and Solana.')).toEqual(['no server']);
    expect(ids('Your keys never leave your browser and nothing is logged.')).toEqual(['never leave', 'nothing leaves']);
    expect(ids('Secure as a bank, military-grade encryption.')).toEqual(['bank-grade']);
  });

  it('fix round 1 (task review I1): the passive and past-participle privacy claims are refused on every tier; #40\'s account history passes', () => {
    const ids = (tier, text) => on(tier, text).map(v => /"(.+)" in/.exec(v)[1]);
    for (const tier of TIERS) {
      // The review's planted rows, verbatim.
      expect(ids(tier, 'Your IP address is never logged.'), tier).toEqual(['never receive']);
      expect(ids(tier, 'Your keys are never stored on our servers.'), tier).toEqual(['never receive']);
      expect(ids(tier, 'Your activity is never tracked.'), tier).toEqual(['never receive']);
      expect(ids(tier, 'Your data is never collected.'), tier).toEqual(['never receive']);
      expect(ids(tier, 'Never stored, never logged.'), tier).toEqual(['never receive']);
      expect(ids(tier, 'Nothing is transmitted.'), tier).toEqual(['nothing leaves']);
      expect(ids(tier, 'No data leaves your browser.'), tier).toEqual(['nothing leaves']);
      // Their neighbours: each alternative of the two patterns.
      expect(ids(tier, 'Your balance is never seen by anyone.'), tier).toEqual(['never receive']);
      expect(ids(tier, 'Your address will never be received by Noctura.'), tier).toEqual(['never receive']);
      expect(ids(tier, 'Your history was never recorded.'), tier).toEqual(['never receive']);
      expect(ids(tier, 'No personal information is ever stored.'), tier).toEqual(['nothing leaves']);
      // True text with the words: the account's own history (#40) passes.
      expect(on(tier, 'This is a fresh seed — never received any tokens'), tier).toEqual([]);
    }
  });

  it('review 2 M1: a sending claim with no subject is refused, on every tier — the ruling\'s two planted controls and their forms', () => {
    const ids = (tier, text) => on(tier, text).map(v => /"(.+)" in/.exec(v)[1]);
    for (const tier of TIERS) {
      // The ruling's planted controls, verbatim.
      expect(ids(tier, 'The wallet never sends your phrase anywhere'), tier).toEqual(['never send']);
      expect(ids(tier, 'is never uploaded'), tier).toEqual(['never send']);
      expect(ids(tier, 'The extension never transmits your keys.'), tier).toEqual(['never send']);
      expect(ids(tier, 'Your recovery phrase is never sent.'), tier).toEqual(['never send']);
      expect(ids(tier, 'Your data is never shared.'), tier).toEqual(['never send']);
      expect(ids(tier, 'Your keys will never be transmitted.'), tier).toEqual(['never send']);
      expect(ids(tier, 'It never uploads anything.'), tier).toEqual(['never send']);
      // With a subject the "we don't see" claim reads it too: its verbs now include send, transmit and upload.
      expect(ids(tier, 'We never send your address.'), tier).toEqual(["we don't see"]);
      expect(ids(tier, "Noctura doesn't upload your phrase."), tier).toEqual(["we don't see"]);
      // True text that holds the words: the imperative advice and the user's own history pass.
      for (const text of ['Never send your recovery phrase or your password — Noctura never asks for them.', 'Never sent here before', 'You have never sent to this address.', "You've never sent to this address"]) {
        expect(on(tier, text), `${tier}: ${text}`).toEqual([]);
      }
      // P11's "never leave this device" stays the one allowed form, on the tiers it is true on.
      if (tier === 'store' || tier === 'policy') expect(on(tier, 'Your recovery phrase, private keys, password and anti-phishing phrase never leave this device through the extension.')).toEqual([]);
    }
  });

  it('names and true states pass on every tier: private key(s), the Privacy Policy, its URL and contact, connectivity, a hidden balance', () => {
    for (const tier of TIERS) {
      for (const text of [
        'Export private key',
        'never your seed or private keys',
        'Privacy Policy',
        'Terms and Privacy Policy.',
        'https://noc-tura.io/extension/privacy',
        'write to privacy@noc-tura.io',
        'release/privacy.md',
        "You're offline",
        'What you can still do offline:',
        '24 words. Written offline. The only way back if this browser\'s data is lost.',
        'balance hidden',
        'confidentialTransferMint',
        'This transaction is no longer tracked.',
        "This address has no presale allocation, so it can't receive a referral bonus",
        "Receiving works — your address is on this device.",
      ]) {
        expect(on(tier, text), `${tier}: ${text}`).toEqual([]);
      }
    }
  });

  it('each allowance holds a claim (else it is not needed), passes on each tier it lists, and is refused on every other tier', () => {
    expect(ALLOWED.length).toBe(26);
    for (const a of ALLOWED) {
      expect(a.verdict.length, a.text).toBeGreaterThan(10);
      expect(a.tiers.length, a.text).toBeGreaterThan(0);
      expect(a.tiers.every(t => TIERS.includes(t)), a.text).toBe(true);
      for (const tier of TIERS) {
        // The negative control: the same words with no allowance at all are refused.
        expect(on(tier, a.text, {allowed: []}).length, `${tier} without allowances: ${a.text}`).toBeGreaterThan(0);
        if (a.tiers.includes(tier)) expect(on(tier, a.text), `${tier}: ${a.text}`).toEqual([]);
        else expect(on(tier, a.text).length, `${tier} (not listed): ${a.text}`).toBeGreaterThan(0);
      }
    }
    expect(Object.fromEntries(TIERS.map(t => [t, ALLOWED.filter(a => a.tiers.includes(t)).length]))).toEqual({source: 7, built: 17, store: 6, policy: 6});
  });

  it('an allowance removes exactly its own words: the same word elsewhere in the unit is still refused', () => {
    expect(on('source', 'Move to a private place. Anyone who sees these 24 words can spend everything.')).toEqual([]);
    expect(on('source', 'Move to a private place. Your balance is private.')).toEqual(['p: "private" in “Move to a private place. Your balance is private.”']);
    // Whitespace is collapsed before an allowance is matched (the BIP-39 list's words are separated by newlines).
    expect(on('built', 'priority\nprison\nprivate\nprize\nproblem')).toEqual([]);
    expect(on('built', 'priority\nprivate\nproblem')).toEqual(['p: "private" in “priority private problem”']);
  });

  it('reports an allowance no text used (a stale entry), per tier; refuses a tier it does not know', () => {
    const allowed = [...ALLOWED, {text: 'A planted private sentence.', tiers: ['store'], verdict: 'test'}];
    const used = new Set();
    claimViolations([at('s', 'Nothing here.')], {tier: 'store', allowed, used});
    expect(unusedAllowances(used, 'store', allowed)).toEqual([...ALLOWED, allowed.at(-1)].filter(a => a.tiers.includes('store')).map(a => `allowance not used by any store text: “${a.text}”`));
    claimViolations([at('s', 'A planted private sentence.')], {tier: 'store', allowed, used});
    expect(unusedAllowances(used, 'store', allowed)).not.toContain('allowance not used by any store text: “A planted private sentence.”');
    expect(() => claimViolations([], {})).toThrow('tier must be one of source, built, store, policy');
    expect(() => unusedAllowances(new Set(), 'listing')).toThrow('tier must be one of');
  });

  it('markdown is read a paragraph at a time, whitespace collapsed', () => {
    expect(markdownUnits('# Title\n\nOne line\nwrapped.\n\n\n- a\n- b\n', 'm')).toEqual([at('m', '# Title'), at('m', 'One line wrapped.'), at('m', '- a - b')]);
  });

  it('the three checks that read words import this list — none keeps a list of its own', () => {
    const src = rel => readFileSync(resolve(ROOT, rel), 'utf8');
    expect(src('scripts/check-ui-claims.mjs')).toContain("from './claims.mjs';");
    for (const rel of ['scripts/__tests__/storeTexts.test.mjs', 'scripts/__tests__/privacy.test.mjs', 'scripts/__tests__/check-ui-claims.test.mjs']) {
      expect(src(rel), rel).toContain("from '../claims.mjs';");
    }
  });
});
