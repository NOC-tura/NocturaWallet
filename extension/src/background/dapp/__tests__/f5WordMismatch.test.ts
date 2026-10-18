import {PublicKey} from '@solana/web3.js';
import {MAINNET_USDC_MINT} from '../../../../../core/presale/addresses';
import {ACCOUNT} from '../../__tests__/fixtures';
import {TOKEN_PROGRAM} from '../decode/decode';
import {U64_MAX, tokenAccountBytes, usdcLikeMint} from './tokenBytes';
import {tokenApprove, txScene, v0} from './txHarness';

// Final review M1, the forced mismatch: the challenge store's F5 list (derived from redFlags' APPROVAL_SYMBOLS) without
// USDC, while redFlagsOf (its own symbolOf, from the wallet's table) still names a USDC approve 'USDC' — the shape of a
// token added to one list and not the other.
vi.mock('../redFlags', async importOriginal => ({...(await importOriginal<typeof import('../redFlags')>()), APPROVAL_SYMBOLS: ['NOC', 'USDT']}));

describe('a word the challenge store does not accept (final review M1)', () => {
  it('dapp.decide answers a refusal — malformed, no challenge issued, nothing answered to the page — never an exception escaping it', async () => {
    const SRC = new PublicKey(new Uint8Array(32).fill(81));
    const DELEGATE = new PublicKey(new Uint8Array(32).fill(82));
    const c = await txScene();
    c.chain.accounts.set(SRC.toBase58(), {lamports: 2_039_280n, owner: TOKEN_PROGRAM, data: tokenAccountBytes({mint: MAINNET_USDC_MINT, owner: ACCOUNT.publicKey, amount: 250_000_000n})});
    c.chain.accounts.set(MAINNET_USDC_MINT, {lamports: 1_461_600n, owner: TOKEN_PROGRAM, data: usdcLikeMint()});
    const requestId = String((await c.signTx('t', [v0([tokenApprove(SRC, DELEGATE, U64_MAX)])]))?.requestId);
    const view = await c.simulated();
    const stored = (await c.entry(requestId))?.sim;
    expect(stored?.status === 'ok' ? stored.sim.flags[0]?.map(f => [f.kind, f.word]) : null).toEqual([['unlimited-approve', 'USDC']]);
    const simulation = String(view.request?.tx?.simulation.id);
    const decide = () => c.decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, simulation, overrides: [{tx: 0, word: 'USDC'}]});
    await expect(decide()).resolves.toEqual({ok: false, error: 'malformed'});
    // Again (no challenge was stored half-way): the same refusal, the request still queued, the page unanswered.
    await expect(decide()).resolves.toEqual({ok: false, error: 'malformed'});
    const e = await c.entry(requestId);
    expect([e?.state, e?.challengeId]).toEqual(['queued', null]);
    expect(c.page.answersFor(requestId)).toEqual([]);
  });
});
