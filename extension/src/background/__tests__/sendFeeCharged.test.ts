import {sendPrepared} from '../send';
import {prepareSend} from '../prepare';
import {KNOWN_RECIPIENTS_KEY} from '../knownRecipients';
import {readPending} from '../pendingStore';
import {firstSignature} from '../../../../core/solana/broadcast';
import {MAINNET_FEE_TREASURY, TRANSFER_MARKUP_LAMPORTS} from '../../../../core/fees/transferMarkup';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT, chargedByWire, sendReader, unlocked} from './fixtures';

// Plan 3: the fee a pending record says it pays includes the Noctura fee when one is charged. The extension's
// policy inputs are 'unknown' today (feePolicy.ts: nothing is charged), so this file swaps them for a charging
// policy — the only way to tell "network fee" from "network fee + Noctura fee" apart.
vi.mock('../feePolicy', () => ({EXTENSION_FEE_INPUTS: {tgeStatus: 'claimable', isZeroFeeEligible: false, stakingDiscount: 0}}));

it('a charged Noctura fee is the pending record’s fee.markupLamports, apart from the network fee', async () => {
  const ext = fakeExt();
  await unlocked(ext);
  await ext.local.set(KNOWN_RECIPIENTS_KEY, [RECIPIENT]);
  const deps = fakeDeps({reader: sendReader()});
  deps.broadcast = async wire => firstSignature(wire);
  const prepared = await prepareSend(ext, deps, ACCOUNT.publicKey, {token: 'SOL', recipient: RECIPIENT, amount: '1000000'});
  expect(prepared.fees).toMatchObject({markupLamports: TRANSFER_MARKUP_LAMPORTS.toString(), markupReason: 'charged'});
  const view = await sendPrepared(ext, deps, prepared.id);
  expect(view.fee).toEqual({networkLamports: prepared.fees.networkLamports, markupLamports: TRANSFER_MARKUP_LAMPORTS.toString()});
  expect((await readPending(ext))[0]?.fee).toEqual(view.fee);
});

it('the charged fee is what the broadcast bytes charge: network = signatures × 5 000 + signed priority fee, markup = the transfer to the treasury', async () => {
  const ext = fakeExt();
  await unlocked(ext);
  await ext.local.set(KNOWN_RECIPIENTS_KEY, [RECIPIENT]);
  const deps = fakeDeps({reader: sendReader()});
  deps.broadcast = async wire => {
    deps.broadcasts.push(wire);
    return firstSignature(wire);
  };
  const prepared = await prepareSend(ext, deps, ACCOUNT.publicKey, {token: 'SOL', recipient: RECIPIENT, amount: '1000000'});
  const view = await sendPrepared(ext, deps, prepared.id);
  const wire = deps.broadcasts[0]!;
  // The treasury transfer is really in the signed bytes (not only in the shown fees) …
  const {network, markup} = chargedByWire(wire, MAINNET_FEE_TREASURY);
  expect(markup).toBe(TRANSFER_MARKUP_LAMPORTS);
  // … and the record says exactly what the bytes charge, part by part.
  expect(view.fee).toEqual({networkLamports: network.toString(), markupLamports: markup.toString()});
});
