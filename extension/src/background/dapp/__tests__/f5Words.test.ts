import {PublicKey} from '@solana/web3.js';
import {MAINNET_USDC_MINT} from '../../../../../core/presale/addresses';
import {WALLET_TOKENS} from '../../../../../core/solana/balances';
import {APPROVAL_SYMBOLS as WINDOW_SYMBOLS} from '../../../approve/client';
import {F5_WORDS as VAULT_F5_WORDS} from '../../../unlock/challenge';
import {ACCOUNT} from '../../__tests__/fixtures';
import {F5_WORDS} from '../../reauthChallenges';
import {TOKEN_PROGRAM} from '../decode/decode';
import {ALLOWANCE_WORD, APPROVAL_SYMBOLS, OVERRIDE_WORDS} from '../redFlags';
import {U64_MAX, tokenAccountBytes, usdcLikeMint} from './tokenBytes';
import {tokenApprove, txScene, v0} from './txHarness';

/**
 * Final review M1: F5's word list lives in three places — the background (derived from the wallet's own token table),
 * the approval window and the vault page (#10), which import nothing from the background. This file is the pin: the
 * two copies equal the derived list, so a token added to WALLET_TOKENS is either in all three or fails here.
 */
describe('F5’s words — one list, three copies', () => {
  it('the background derives its symbols from WALLET_TOKENS without SOL; its F5 words are those, UNLIMITED and ALLOWANCE', () => {
    expect([...APPROVAL_SYMBOLS]).toEqual(Object.keys(WALLET_TOKENS).filter(t => t !== 'SOL'));
    expect([...APPROVAL_SYMBOLS]).not.toContain('SOL');
    expect([...F5_WORDS]).toEqual([...APPROVAL_SYMBOLS, OVERRIDE_WORDS.unlimited, ALLOWANCE_WORD]);
  });

  it('the approval window’s symbols and the vault page’s F5 words are exactly the background’s', () => {
    expect([...WINDOW_SYMBOLS]).toEqual([...APPROVAL_SYMBOLS]);
    expect([...VAULT_F5_WORDS]).toEqual([...F5_WORDS]);
  });

  it('positive control for the forced mismatch (f5WordMismatch.test.ts): with the lists agreeing, the same USDC approve reaches #10 (reauth-required) and issues a challenge', async () => {
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
    expect(await c.decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, simulation, overrides: [{tx: 0, word: 'USDC'}]})).toEqual({ok: false, error: 'reauth-required'});
    expect((await c.entry(requestId))?.challengeId).not.toBeNull();
  });
});
