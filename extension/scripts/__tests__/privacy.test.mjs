import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PRIVACY_SENTENCES} from '../../release/privacySentences.mjs';
import {claimViolations, markdownUnits, unusedAllowances} from '../claims.mjs';
import {CONTACT, LIVE_PAGES, foldText, pageProblems} from '../live-check.mjs';
import {REQUIRED_CONNECT_SRC} from '../check-permissions.mjs';
import {FRESH_ROWS} from '../../src/app/useAccountBalances';
import {SLIP10_ACCOUNTS_TO_SCAN} from '../../src/unlock/onboarding';
import {SIM_REFRESH_MS, SIM_RETRY_MS} from '../../src/background/dapp/signTx';
import {GEO_LIST_CACHE_MS} from '../../src/background/geo/gate';
import {RP_ID} from '../../src/vault/passkey';
import {PRICE_PATH} from '../../../core/portfolio/prices';
import {NOCTURA_PAGES} from '../../src/shared/links';
import {PublicKey} from '@solana/web3.js';
import {prepareSend} from '../../src/background/prepare';
import {KNOWN_RECIPIENTS_KEY} from '../../src/background/knownRecipients';
import {fakeDeps} from '../../src/background/__tests__/fakeDeps';
import {fakeExt} from '../../src/background/__tests__/fakeExt';
import {ACCOUNT, HOLDING_LARGE, RECIPIENT, sendReader, unlocked} from '../../src/background/__tests__/fixtures';
import {WALLET_TOKENS} from '../../../core/solana/balances';
import {findAssociatedTokenAddress} from '../../../core/solana/encoding';

// B1e §6.1, §6.2, §6.5: the privacy policy's required sentences — the list, privacy.md carrying each verbatim, and
// the facts in them pinned to the code they describe (a constant that changes turns this red, so the published
// sentence cannot silently stop being true).

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = rel => readFileSync(resolve(ROOT, rel), 'utf8');
const PRIVACY_MD = read('release/privacy.md');
const RETENTION_MD = read('release/ico-retention.md');
const text = id => PRIVACY_SENTENCES.find(s => s.id === id)?.text ?? '';
/** The sentences whose text is not, character for character, in `md`. */
const notVerbatim = (md, sentences = PRIVACY_SENTENCES) => sentences.filter(s => !md.includes(s.text)).map(s => s.id);
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/** privacy.md as a site would publish it: each paragraph a <p>, headings <h1>–<h3>, the text HTML-escaped. */
function asHtml(md) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return md
    .split(/\n{2,}/)
    .map(block => {
      const h = /^(#{1,3}) (.*)$/.exec(block);
      return h ? `<h${h[1].length}>${esc(h[2])}</h${h[1].length}>` : `<p>${esc(block)}</p>`;
    })
    .join('\n');
}

describe('the privacy policy (B1e §6.1, §6.2)', () => {
  it('the list: P1–P16 (§6.1) with L1 after P9, then R1–R21 (§6.2), each with a text and a source, no text twice', () => {
    const ids = PRIVACY_SENTENCES.map(s => s.id);
    const p = Array.from({length: 16}, (_, i) => `P${i + 1}`);
    expect(ids).toEqual([...p.slice(0, 9), 'L1', ...p.slice(9), ...Array.from({length: 21}, (_, i) => `R${i + 1}`)]);
    for (const s of PRIVACY_SENTENCES) {
      expect(Object.keys(s).sort(), s.id).toEqual(['id', 'source', 'text']);
      expect(s.text.length, s.id).toBeGreaterThan(20);
      expect(s.source.length, s.id).toBeGreaterThan(5);
    }
    expect(new Set(PRIVACY_SENTENCES.map(s => s.text)).size).toBe(PRIVACY_SENTENCES.length);
    expect(Object.isFrozen(PRIVACY_SENTENCES) && PRIVACY_SENTENCES.every(s => Object.isFrozen(s))).toBe(true);
  });

  it('each sentence is already in the live check\'s folded form (straight quotes, single spaces, NFC) and ends a sentence', () => {
    for (const s of PRIVACY_SENTENCES) {
      expect(foldText(s.text), s.id).toBe(s.text);
      expect(s.text, s.id).toMatch(/^[A-Z].*[.]$/);
      expect(s.text, s.id).not.toMatch(/[\u2018\u2019\u201c\u201d\u00a0]|\s{2}|^\s|\s$/);
    }
  });

  it('privacy.md carries every sentence verbatim — control: one word changed or one sentence dropped is found', () => {
    expect(notVerbatim(PRIVACY_MD)).toEqual([]);
    expect(notVerbatim(PRIVACY_MD.replace('one-minute window', 'one-hour window'))).toEqual(['R11']);
    expect(notVerbatim(PRIVACY_MD.replace(`${text('R21')}`, ''))).toEqual(['R21']);
  });

  it('privacy.md, published as plain HTML, passes the live check\'s comparison', () => {
    const privacy = LIVE_PAGES.find(p => p.name === 'privacy');
    expect(pageProblems(privacy, asHtml(PRIVACY_MD))).toEqual([]);
    expect(PRIVACY_MD.startsWith(`# ${privacy.title}\n`)).toBe(true);
  });

  it('privacy.md makes no claim the build does not keep: scripts/claims.mjs on its policy tier, every policy allowance needed; "private" only in "private keys" — controls: a planted claim, a source-tier sentence', () => {
    const used = new Set();
    expect(claimViolations(markdownUnits(PRIVACY_MD, 'privacy.md'), {tier: 'policy', used})).toEqual([]);
    expect(unusedAllowances(used, 'policy')).toEqual([]);
    // This check's own addition: the one "private" is P11's "private keys".
    expect([...PRIVACY_MD.toLowerCase().matchAll(/\bprivate\b(.{0,5})/g)].map(m => m[1])).toEqual([' keys']);
    const planted = md => claimViolations(markdownUnits(md, 'privacy.md'), {tier: 'policy'});
    expect(planted(`${PRIVACY_MD}\n\nYour transactions are confidential and encrypted in transit.\n`)).toEqual([
      'privacy.md: "confidential" in “Your transactions are confidential and encrypted in transit.”',
      'privacy.md: "encrypted in transit" in “Your transactions are confidential and encrypted in transit.”',
    ]);
    expect(planted(`${PRIVACY_MD}\n\nYour keys stay on this device.\n`)).toEqual(['privacy.md: "stays on this device" in “Your keys stay on this device.”']);
  });

  it('the facts in the sentences are the code\'s: the one host, the counts, the intervals, the RP ID, the tokens, the contact', () => {
    expect(REQUIRED_CONNECT_SRC).toEqual(['https://api.noc-tura.io']);
    expect(text('P1')).toContain(`one server only: ${new URL(REQUIRED_CONNECT_SRC[0]).host}`);
    expect(text('P3')).toContain(`the first ${WORDS[FRESH_ROWS]} accounts in your account list`);
    // MAX_PROBE is module-private: its declaration is pinned as text, beside the candidates it must cover.
    expect(read('src/background/walletApi.ts')).toContain('const MAX_PROBE = 6;');
    expect(text('P4')).toContain(`up to ${WORDS[SLIP10_ACCOUNTS_TO_SCAN + 1]} accounts derived from it`);
    expect(text('P5')).toContain(`again every ${SIM_REFRESH_MS / 1000} seconds while the approval window shows it`);
    expect(text('P5')).toContain(`every ${SIM_RETRY_MS / 1000} seconds after a simulation that fails`);
    expect(text('P8')).toContain(`keeping a copy for up to ${GEO_LIST_CACHE_MS / 60_000} minutes`);
    expect(text('P12')).toContain(`listed under the name ${RP_ID}.`);
    expect(text('P13')).toContain(`Nothing is served at ${RP_ID}`);
    expect(PRICE_PATH).toBe('/wallet/prices?ids=solana,usd-coin,tether');
    expect(text('P7')).toContain('prices for SOL, USDC and USDT');
    expect(text('R19')).toContain('Prices for SOL, USDC and USDT');
    expect(text('P16')).toBe(`Questions about privacy: ${CONTACT}.`);
    expect(text('R21')).toContain(CONTACT);
    // L1 names the three noc-tura.io pages the extension links to, and not the licence page (it is inside the package).
    expect(Object.keys(NOCTURA_PAGES).sort()).toEqual(['help', 'privacy', 'terms']);
    for (const url of Object.values(NOCTURA_PAGES)) expect(new URL(url).host).toBe('noc-tura.io');
    expect(text('L1')).toContain('the Terms, Privacy Policy or Help page from the extension, noc-tura.io receives');
    expect(text('L1')).not.toMatch(/licen[cs]e/i);
  });

  it('P5\'s recipient lookup is prepareSend\'s: the address sent to (its kind) and, for a token, its token account — both asked before the simulation', async () => {
    const NOC = WALLET_TOKENS.NOC.mint;
    const LOOKUPS = ['getAccountKind', 'getAccountExists', 'simulateTransaction'];
    /** The reader calls one prepareSend makes that P5 speaks of, in order, each with its first argument. */
    const lookups = async intent => {
      const calls = [];
      const base = sendReader({getTokenAccountsByOwner: async () => [{pubkey: HOLDING_LARGE, mint: NOC, owner: ACCOUNT.publicKey, amount: 13_399_619n, decimals: 9}]});
      const reader = Object.fromEntries(Object.entries(base).map(([k, f]) => [k, (...a) => (calls.push([k, a[0]]), f(...a))]));
      const ext = fakeExt();
      await unlocked(ext);
      await ext.local.set(KNOWN_RECIPIENTS_KEY, [RECIPIENT]);
      await prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, intent);
      return calls.filter(([k]) => LOOKUPS.includes(k)).map(([k, a]) => [k, k === 'simulateTransaction' ? 'tx' : a]);
    };
    expect(await lookups({token: 'SOL', recipient: RECIPIENT, amount: '1000000'})).toEqual([['getAccountKind', RECIPIENT], ['simulateTransaction', 'tx']]);
    const ata = findAssociatedTokenAddress(new PublicKey(RECIPIENT), new PublicKey(NOC)).toBase58();
    expect(await lookups({token: 'NOC', recipient: RECIPIENT, amount: '1000000'})).toEqual([
      ['getAccountKind', RECIPIENT],
      ['getAccountExists', ata],
      ['simulateTransaction', 'tx'],
    ]);
    expect(text('P5')).toContain(
      'When you review one of your sends, the coordinator is also asked, before the simulation, about the address you are sending to: what kind of account it is and, for a token, whether that address already has an account for that token.',
    );
  });

  it('every R-sentence is ICO\'s answer except R2 and R8, which say they are the extension\'s own measurement', () => {
    const r = PRIVACY_SENTENCES.filter(s => s.id.startsWith('R'));
    expect(r.filter(s => s.source.startsWith('measured, not ICO:')).map(s => s.id)).toEqual(['R2', 'R8']);
    for (const s of r.filter(x => !['R2', 'R8'].includes(x.id))) expect(s.source, s.id).toMatch(/^ICO §6\.2 answer [1-6]/);
    for (const s of r.filter(x => ['R2', 'R8'].includes(x.id))) expect(s.source, s.id).toContain('e2e/requestHeaders.spec.ts');
  });

  it('ico-retention.md records the answer: its date, ICO\'s three commits, the six numbered parts', () => {
    expect(RETENTION_MD).toContain('**Received:** 2026-11-01');
    for (const c of ['67bcec0', '6c68431', 'c803bc1']) expect(RETENTION_MD).toContain(c);
    for (const part of ['1–2 Recorded / where:', '3 Retention:', '4 Outside recipients:', '5 Use:', '6 Deletion requests: privacy@noc-tura.io.']) {
      expect(RETENTION_MD).toContain(`\n${part}`);
    }
  });
});
