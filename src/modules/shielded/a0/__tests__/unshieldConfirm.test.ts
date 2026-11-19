/**
 * The JS half of the native confirmation (spec §4 step 4): the approval's owner must be the one
 * asked for, and its token account must equal JS's OWN ATA(owner, mint) — else the unshield aborts.
 * Owners and ATAs come from the OFFLINE vectors (scripts/a0-vectors/gen-ata-vectors.mjs, web3.js),
 * never from the code under test; the real web3.js derives (a PDA under the app-wide mock is vacuous).
 */
import {readFileSync} from 'fs';
import {join} from 'path';

jest.mock('@solana/web3.js', () =>
  jest.requireActual<typeof import('../__testing__/realWeb3')>('../__testing__/realWeb3').loadRealWeb3(),
);

import type {A0Handle, A0UnshieldApproval} from '../../../zkProver/nativeProverBridge';
import {A0ConfirmMismatchError, confirmA0Unshield} from '../unshieldConfirm';

interface OwnerVector {
  owner: string;
  ata: string;
  verdict: string;
}
const VECTORS = JSON.parse(
  readFileSync(join(__dirname, '../../../../../native/noctura-prover/tests/fixtures/a0-ata-vectors.json'), 'utf8'),
) as {owners: OwnerVector[]};
const OK = VECTORS.owners.filter(o => o.verdict === 'ok');
const H = '7' as A0Handle;
const AUTH = '0123456789abcdef0123456789abcdef';

function nativeAnswering(answer: A0UnshieldApproval) {
  return jest.fn(async () => answer);
}

describe('confirmA0Unshield — the approval is held to the request (§4 step 4)', () => {
  it('reads at least five on-curve owners from the offline vectors (non-vacuous)', () => {
    expect(OK.length).toBeGreaterThanOrEqual(5);
  });

  it.each(OK.map(o => [o.owner, o] as const))('accepts %s with its own ATA (positive control)', async (_n, o) => {
    const confirm = nativeAnswering({authId: AUTH, owner: o.owner, ata: o.ata});
    await expect(confirmA0Unshield(H, {owner: o.owner, amount: 5n, fee: 10_000n}, {confirm})).resolves.toEqual({
      authId: AUTH,
      owner: o.owner,
      ata: o.ata,
    });
    expect(confirm).toHaveBeenCalledWith(H, o.owner, 5n, 10_000n);
  });

  it('aborts when the token account is another owner’s ATA', async () => {
    const [a, b] = OK;
    const confirm = nativeAnswering({authId: AUTH, owner: a!.owner, ata: b!.ata});
    await expect(confirmA0Unshield(H, {owner: a!.owner, amount: 5n, fee: 0n}, {confirm})).rejects.toMatchObject({
      code: 'E_A0_CONFIRM_MISMATCH',
      message: 'the approved token account is not ATA(owner, mint)',
    });
  });

  it('aborts when the token account is the owner itself (a token account is never the owner)', async () => {
    const [a] = OK;
    const confirm = nativeAnswering({authId: AUTH, owner: a!.owner, ata: a!.owner});
    await expect(confirmA0Unshield(H, {owner: a!.owner, amount: 5n, fee: 0n}, {confirm})).rejects.toBeInstanceOf(
      A0ConfirmMismatchError,
    );
  });

  it('aborts when the approved owner is not the requested one, even with that owner’s correct ATA', async () => {
    const [a, b] = OK;
    const confirm = nativeAnswering({authId: AUTH, owner: b!.owner, ata: b!.ata});
    await expect(confirmA0Unshield(H, {owner: a!.owner, amount: 5n, fee: 0n}, {confirm})).rejects.toMatchObject({
      code: 'E_A0_CONFIRM_MISMATCH',
      message: 'the approved owner is not the requested one',
    });
  });

  it('passes a native refusal through with its code', async () => {
    const confirm = jest.fn(async () => {
      throw Object.assign(new Error('the confirmation was cancelled'), {code: 'E_A0_CONFIRM_CANCELLED'});
    });
    await expect(confirmA0Unshield(H, {owner: OK[0]!.owner, amount: 1n, fee: 0n}, {confirm})).rejects.toMatchObject({
      code: 'E_A0_CONFIRM_CANCELLED',
    });
  });
});
