// @vitest-environment happy-dom
import {createEnvelope} from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import {CHALLENGE_TTL_MS, issueChallenge} from '../../background/reauthChallenges';
import {clearSession, setSession} from '../../background/session';
import type {KindAbout} from '../../background/intents';
import {PRESALE_BUY_KIND} from '../../background/presale/buy';
import {MAINNET_SOL_TREASURY} from '../../../../core/presale/addresses';
import {mountReauth} from '../screens/reauth';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible} from './pageHarness';

// B1d §4.2 (D38, E7; B1d-1b Task 5): #10 for a purchase in the build with presale — the background's PurchaseAbout,
// described by the presale entry (src/unlock/presale.ts) and drawn by #10's own screen: Q18 as its eyebrow and headline,
// #20's rows, Q17 and B1b's reason lines. Proven, the SAME tab goes to the resume route (where #20's purchase variant
// signs with no second proof — presale/__tests__/resume.test.tsx); nothing is signed or sent from here. Cancel discards
// the purchase (B1b's wallet.discardPrepared drops every kind) and says Q56.
const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const PW = 'correct horse battery';
const ABOUT: KindAbout = {
  kind: PRESALE_BUY_KIND,
  account: K0,
  currency: 'SOL',
  amount: '2000000000',
  stage: 0,
  priceTicks: '1501',
  nocBase: '2643837441705',
  spentCents: '39684',
  destination: MAINNET_SOL_TREASURY,
  networkLamports: '11000',
  priorityLamports: '6000',
  rentLamports: '2189480',
  reasons: ['first-purchase', 'over-5-percent', 'over-usd-threshold'],
  thresholdCents: 10_000,
};

beforeEach(() => loadPage());

async function shown(about: KindAbout = ABOUT) {
  const env = await createEnvelope({mnemonic: M, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: K0}], kdf: testKdf});
  const h = await harness({vault: env});
  const broadcasts: Uint8Array[] = [];
  h.wallet.broadcast = async wire => {
    broadcasts.push(wire);
    throw new Error('#10 must not broadcast');
  };
  await setSession(h.ext, await deriveSessionAccounts(M, 'slip10', [0]));
  const id = await issueChallenge(h.ext, h.wallet, 'digest', about);
  await mountReauth(h.deps).show(id);
  return {h, id, broadcasts};
}
const rows = () => [...el('ra-rows').querySelectorAll('.intent-row')].map(r => [text(r.querySelector('.label')), text(r.querySelector('.value'))]);

describe('#10 for a purchase (§4.2)', () => {
  it('described: Q18 (eyebrow and headline), #20’s rows — the recipient whole after Q10 — the fees with Q09, one reason line per reason; [Cancel]', async () => {
    await shown();
    expect(text(el('ra-about'))).toBe('Confirm buying NOC with');
    expect([text(el('ra-amount')), text(el('ra-symbol'))]).toEqual(['2.0000', 'SOL']);
    expect(visible(el('ra-amount-row'))).toBe(true);
    expect(rows()).toEqual([
      ['You receive (est.)', '2,643.83 NOC'],
      ['Stage', '1 of 10'],
      ['Price', '$ 0.1501 / NOC'],
      ['To', `Noctura presale · ${MAINNET_SOL_TREASURY}`],
      ['Network fee', '0.000005 SOL'],
      ['Priority', '0.000006 SOL'],
      ['Account setup (first purchase)', '0.00218948 SOL'],
    ]);
    expect([...el('ra-reasons').children].map(p => text(p))).toEqual([
      'Re-auth required for your first presale purchase from this account.',
      'Re-auth required for transactions over 5 % of balance.',
      'Re-auth required for transactions over $100.',
    ]);
    // The address in groups of four (the stylesheet's gap, not a space: a copy yields it exact).
    expect([...el('ra-rows').querySelectorAll('.addr-groups > span')].map(g => g.textContent)).toEqual(MAINNET_SOL_TREASURY.match(/.{1,4}/g));
    expect(text(el('ra-cancel'))).toBe('Cancel');
    expect(visible(el('ra-confirm'))).toBe(true);
    expect(text(el('v-reauth'))).not.toMatch(/\bsend/i);
    expect(unstyled('v-reauth')).toEqual([]);
  });

  it('B1d-2 (Q47): a purchase that registers its referrer — "Referred by" with the whole address in groups of four after "To", then Q47’s note', async () => {
    const referrer = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
    await shown({...ABOUT, referrer: {address: referrer, registers: true}});
    expect(rows().slice(3, 6)).toEqual([
      ['To', `Noctura presale · ${MAINNET_SOL_TREASURY}`],
      ['Referred by', referrer],
      ["Saved to your presale account with this purchase. It can't be changed later.", ''],
    ]);
    const groups = [...el('ra-rows').querySelectorAll('.intent-row')][4]?.querySelectorAll('.addr-groups > span') ?? [];
    expect([...groups].map(g => g.textContent)).toEqual(referrer.match(/.{1,4}/g));
    // B1d-2 Task 7 (visual pass): a row naming an address keeps its label on one line ("Referred by" wrapped beside the
    // groups); the note row, label only, still wraps.
    expect([...el('ra-rows').querySelectorAll('.intent-row .label')].slice(3, 6).map(l => l.classList.contains('vlt-keep'))).toEqual([true, true, false]);
    expect(unstyled('v-reauth')).toEqual([]);
  });

  it('confirmed: the challenge satisfied and the SAME tab to the resume route — nothing signed or sent from here (D38)', async () => {
    const {h, broadcasts} = await shown();
    type(el<HTMLInputElement>('ra-password'), PW);
    click(el('ra-confirm'));
    await h.until(() => h.went.length > 0);
    expect(h.went).toEqual([`wallet.html#/send/resume?account=${K0}`]);
    expect(h.sent.map(m => m.type)).toEqual(['vault.challengeInfo', 'vault.status', 'vault.reauthOk']);
    expect(broadcasts).toEqual([]);
  });

  it('Cancel: wallet.discardPrepared for the purchase’s account, then Q56 and the tab closes — never B1b’s "Send cancelled"', async () => {
    const {h} = await shown();
    click(el('ra-cancel'));
    await h.until(() => h.closed > 0);
    expect(h.sent.find(m => m.type === 'wallet.discardPrepared')).toEqual({type: 'wallet.discardPrepared', account: K0});
    expect(text(el('ra-notice-line'))).toBe('Purchase cancelled. Nothing was sent.');
  });

  it('expired while typing: the request’s line, not the send’s', async () => {
    const {h} = await shown();
    h.wallet.clock.t += CHALLENGE_TTL_MS + 1;
    type(el<HTMLInputElement>('ra-password'), PW);
    click(el('ra-confirm'));
    await h.until(() => visible(el('ra-notice')));
    expect(text(el('ra-notice-line'))).toBe('This confirmation has expired. Start again from where you began.');
  });

  it('locked while confirming: the request’s line with [Unlock], not the send’s', async () => {
    const {h} = await shown();
    await clearSession(h.ext);
    type(el<HTMLInputElement>('ra-password'), PW);
    click(el('ra-confirm'));
    await h.until(() => visible(el('ra-notice')));
    expect(text(el('ra-notice-line'))).toBe('Noctura is locked. Unlock it from the Noctura icon and start again.');
    expect(visible(el('ra-unlock'))).toBe(true);
  });

  it('a stored purchase description the page refuses (the priority above the fee): not described — only [Close], nothing to confirm (negative control)', async () => {
    const env = await createEnvelope({mnemonic: M, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: K0}], kdf: testKdf});
    const h = await harness({vault: env, send: inner => async m => ((m as {type: string}).type === 'vault.challengeInfo' ? {ok: true, data: {...ABOUT, priorityLamports: '11001'}} : inner(m))});
    await setSession(h.ext, await deriveSessionAccounts(M, 'slip10', [0]));
    await mountReauth(h.deps).show('cd'.repeat(16));
    expect(text(el('ra-notice-line'))).toBe('This request could not be shown. Nothing was approved.');
    expect(visible(el('ra-confirm'))).toBe(false);
    expect(text(el('ra-cancel'))).toBe('Close');
  });
});
