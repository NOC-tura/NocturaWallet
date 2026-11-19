/**
 * The post-landing verifier (spec 2026-11-08 shielded A0 M1 §6 step 8, I13, S10, m-2; §14 JS
 * "post-landing verification refusing …"). A PURE function over ONE `SyncedTx` (the record the tree
 * sync built, §9 — never a transaction fetched by its signature, I3) and what the wallet itself
 * holds: the quote, the native authorization's `{owner, ata, amount, fee}`, the seed's public-key
 * set (`a0SeedPublicKeys`, Task 2), the change commitment Rust proved, and `matchSpent`'s answer.
 * It makes no request, reads no store and holds no secret. Only an `ok: true` verdict lets the flow
 * (Task 7) mark the note spent, store the change note and promote a `fresh-pending` destination.
 *
 * The rules, each a refusal code of its own (a test names the rule that fired):
 *   - SIGNERS: no signer is a key of this seed (`E_A0_VERIFY_SEED_SIGNER`, checked first), and the
 *     signers are exactly `[the quote's feePayer]` (`E_A0_VERIFY_SIGNERS`);
 *   - FEE PAYER: the tx's fee payer (static key 0) and the instruction's `fee_payer` account are the
 *     quote's, which is the pinned relayer key (controller ruling 9);
 *   - SHAPE: the top-level programs are only ComputeBudget, the ATA program, the System program and
 *     FeGSS…; exactly one FeGSS… instruction, and it is a `withdraw_with_change` on pool 8VMe… /
 *     tree 5URd… (the record holds only those, §9); every top-level System instruction is a decoded
 *     `transfer` and every ATA instruction a decoded create-idempotent (none hides from the rules
 *     below);
 *   - NULLIFIER: exactly one admitted `Withdraw` event, equal to the instruction's nullifier (two
 *     CHAIN values), and `matchSpent` was asked about exactly this tx's nullifiers and attributed
 *     them to the note being spent (`[0]` for `ownRhos = [that note's rho]`) — never a JS compare
 *     with a nullifier the wallet holds (R12);
 *   - CHANGE LEAF: exactly one admitted `LeafInserted`; it and the instruction's change commitment
 *     equal Rust's change commitment (m-4: the only independent check JS has of it);
 *   - FEE DESTINATION = ATA(feePayer, mint) (derived here); FEE = ours; DESTINATION = our ATA, which
 *     is ATA(owner, mint) derived here; AMOUNT: the instruction's amount is ours, the destination's
 *     token delta is exactly ours and the vault's is exactly −(amount + fee);
 *   - CREATE-ATA: exactly one create-ATA-idempotent, `(payer feePayer, ata, owner, mint)` — the
 *     uniform shape is REQUIRED now P2 is live (controller ruling 3; a relayed tx without it refuses);
 *   - SEED KEYS: the only key of this seed the tx lists at all is the destination owner;
 *   - THE GRANT (S10, m-2): on top-level `SystemProgram.transfer`s only, never on balance deltas (the
 *     inner system calls of the ATA program and FeGSS… are not in the record, §9): at most one; if
 *     one, the quote carries a grant and the transfer is exactly `gasGrantLamports`, from the fee
 *     payer to the owner, whose pre-balance in this tx was 0 and who is on the Ed25519 curve.
 * Accepted without a grant: an owner holding 0 lamports (off curve, or withheld by P1's per-owner
 * marker). For a `fresh-pending` destination that is REPORTED (`destinationWithoutSol`): the exit is
 * ours, the account holds no SOL, and the wallet still never funds it (§6 step 10).
 */
import {PublicKey} from '@solana/web3.js';
import {A0, A0_RELAYER, ASSOCIATED_TOKEN_PROGRAM_ID, SYSTEM_PROGRAM_ID} from './constants';
import type {A0AccountRole} from './accountRegistry';
import {a0AtaOf} from './relayerClient';
import type {A0RelayerQuote} from './relayerClient';
import type {A0LeafInserted, A0SyncedTx} from './syncedTx';

/** The Compute Budget program: the relayer sets the CU limit (200,000) with it. */
export const COMPUTE_BUDGET_PROGRAM_ID = 'ComputeBudget111111111111111111111111111111';

/** The only programs a relayed withdraw may call at the top level. */
export const A0_RELAYED_TOP_LEVEL_PROGRAMS: readonly string[] = [
  COMPUTE_BUDGET_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  A0.programId,
];

export type A0VerifyRefusal =
  /** the wallet's own inputs are not usable (owner not a canonical key, ata ≠ ATA(owner), quote fee payer not pinned) */
  | 'E_A0_VERIFY_ARGS'
  /** the tx is not the one the relayer said it landed */
  | 'E_A0_VERIFY_SIGNATURE'
  /** a signer is a key of this seed */
  | 'E_A0_VERIFY_SEED_SIGNER'
  /** the signers are not exactly [the quote's fee payer] */
  | 'E_A0_VERIFY_SIGNERS'
  /** the tx's or the instruction's fee payer is not the quote's */
  | 'E_A0_VERIFY_FEE_PAYER'
  /** a top-level program outside the relayed shape, or an undecoded System / ATA instruction */
  | 'E_A0_VERIFY_PROGRAMS'
  /** not exactly one withdraw_with_change on pool 8VMe… / tree 5URd… */
  | 'E_A0_VERIFY_WITHDRAW'
  /** the Withdraw event / matchSpent do not attribute the spend to the note being spent */
  | 'E_A0_VERIFY_NULLIFIER'
  /** the change leaf is not exactly one LeafInserted carrying Rust's change commitment */
  | 'E_A0_VERIFY_CHANGE_LEAF'
  | 'E_A0_VERIFY_FEE_DESTINATION'
  | 'E_A0_VERIFY_FEE'
  | 'E_A0_VERIFY_DESTINATION'
  /** the instruction's amount, the destination's token delta or the vault's is not ours */
  | 'E_A0_VERIFY_AMOUNT'
  /** not exactly one create-ATA-idempotent (feePayer, ata, owner, mint) */
  | 'E_A0_VERIFY_CREATE_ATA'
  /** a key of this seed other than the destination owner appears in the tx */
  | 'E_A0_VERIFY_SEED_KEY'
  /** more than one top-level transfer */
  | 'E_A0_VERIFY_GRANT_COUNT'
  /** the transfer is not exactly the quote's grant from the fee payer to the owner (or the quote has none) */
  | 'E_A0_VERIFY_GRANT_TERMS'
  /** a grant to an owner whose pre-balance in the tx was not 0 */
  | 'E_A0_VERIFY_GRANT_PRE_BALANCE'
  /** a grant to an owner off the Ed25519 curve */
  | 'E_A0_VERIFY_GRANT_OFF_CURVE';

/** The destination's kind: a registry role, or an address outside this seed. */
export type A0DestinationKind = A0AccountRole | 'external';

export interface A0LandedUnshieldExpectation {
  /** the signature the relayer returned; null when the tx was found by matchSpent (reconcile) */
  txSignature: string | null;
  quote: Pick<A0RelayerQuote, 'feePayer' | 'gasGrantLamports'>;
  /** the native authorization's values (§4), and the fee the user approved */
  authorization: {owner: string; ata: string; amount: bigint; fee: bigint};
  destinationKind: A0DestinationKind;
  /** `a0SeedPublicKeys(seed)`: every registry entry, the seed's `cli` key and `slip10:0` */
  seedPublicKeys: readonly string[];
  /** the change commitment Rust proved (the proof's public input), 64 lowercase hex */
  changeCommitment: string;
  /** `a0MatchSpent(handle, chainNullifiers, [rho of the note being spent])`: what was asked and the answer */
  noteMatch: {chainNullifiers: readonly string[]; answer: readonly number[]};
}

export type A0LandedUnshieldVerdict =
  | {
      ok: true;
      signature: string;
      /** the change note's leaf (its commitment is Rust's) */
      changeLeaf: A0LeafInserted;
      /** the grant the owner received in this tx, or null */
      grantLamports: bigint | null;
      /** the owner's lamports before this tx */
      ownerPreLamports: bigint;
      /** a `fresh-pending` destination that got no grant and holds 0 lamports: shown as "no SOL" */
      destinationWithoutSol: boolean;
    }
  | {ok: false; code: A0VerifyRefusal; detail: string};

const refuse = (code: A0VerifyRefusal, detail: string): A0LandedUnshieldVerdict => ({ok: false, code, detail});

function canonicalKey(s: string): PublicKey | null {
  try {
    const k = new PublicKey(s);
    return k.toBase58() === s ? k : null;
  } catch {
    return null;
  }
}

/** §6 step 8: may the wallet believe this landed unshield? Pure; see the module comment. */
export function verifyLandedUnshield(
  tx: A0SyncedTx,
  expect: A0LandedUnshieldExpectation,
): A0LandedUnshieldVerdict {
  const {quote, authorization: auth} = expect;
  const owner = canonicalKey(auth.owner);
  if (!owner) {
    return refuse('E_A0_VERIFY_ARGS', 'the owner is not a canonical public key');
  }
  if (a0AtaOf(owner).toBase58() !== auth.ata) {
    return refuse('E_A0_VERIFY_ARGS', 'the authorization\'s ata is not ATA(owner, mint)');
  }
  if (quote.feePayer !== A0_RELAYER.feePayer) {
    return refuse('E_A0_VERIFY_ARGS', 'the quote\'s fee payer is not the pinned relayer key');
  }
  if (auth.amount <= 0n || auth.fee < 0n) {
    return refuse('E_A0_VERIFY_ARGS', 'amount must be positive and fee not negative');
  }
  if (expect.txSignature !== null && tx.signature !== expect.txSignature) {
    return refuse('E_A0_VERIFY_SIGNATURE', `${tx.signature} is not the relayed ${expect.txSignature}`);
  }
  const seed = new Set(expect.seedPublicKeys);

  // signers and fee payer
  const seedSigner = tx.signers.find(s => seed.has(s));
  if (seedSigner !== undefined) {
    return refuse('E_A0_VERIFY_SEED_SIGNER', `${seedSigner} is a key of this seed and signed the tx`);
  }
  if (tx.signers.length !== 1 || tx.signers[0] !== quote.feePayer) {
    return refuse('E_A0_VERIFY_SIGNERS', `signers ${tx.signers.join(',')} are not [${quote.feePayer}]`);
  }
  if (tx.feePayer !== quote.feePayer) {
    return refuse('E_A0_VERIFY_FEE_PAYER', `the tx's fee payer ${tx.feePayer} is not the quote's`);
  }

  // shape
  const foreign = tx.topLevelPrograms.find(p => !A0_RELAYED_TOP_LEVEL_PROGRAMS.includes(p));
  if (foreign !== undefined) {
    return refuse('E_A0_VERIFY_PROGRAMS', `top-level program ${foreign} is not in the relayed shape`);
  }
  const count = (p: string) => tx.topLevelPrograms.filter(x => x === p).length;
  if (count(A0.programId) !== 1) {
    return refuse('E_A0_VERIFY_PROGRAMS', `${count(A0.programId)} top-level FeGSS… instructions`);
  }
  if (count(SYSTEM_PROGRAM_ID) !== tx.systemTransfers.length) {
    return refuse('E_A0_VERIFY_PROGRAMS', 'a top-level System instruction is not a transfer');
  }
  if (count(ASSOCIATED_TOKEN_PROGRAM_ID) !== tx.createAtaIdempotent.length) {
    return refuse('E_A0_VERIFY_PROGRAMS', 'a top-level ATA instruction is not a create-idempotent');
  }
  if (tx.withdrawals.length !== 1 || tx.deposits.length !== 0) {
    return refuse(
      'E_A0_VERIFY_WITHDRAW',
      `${tx.withdrawals.length} withdraw_with_change and ${tx.deposits.length} deposits on pool ${A0.pool}`,
    );
  }
  const w = tx.withdrawals[0]!;
  if (w.feePayer !== quote.feePayer) {
    return refuse('E_A0_VERIFY_FEE_PAYER', `the instruction's fee_payer ${w.feePayer} is not the quote's`);
  }

  // the spend: chain values and matchSpent's attribution
  if (tx.withdrawNullifiers.length !== 1 || tx.withdrawNullifiers[0] !== w.nullifier) {
    return refuse('E_A0_VERIFY_NULLIFIER', `${tx.withdrawNullifiers.length} Withdraw events, or one that is not the instruction's`);
  }
  const asked = expect.noteMatch.chainNullifiers;
  if (asked.length !== 1 || asked[0] !== tx.withdrawNullifiers[0]) {
    return refuse('E_A0_VERIFY_NULLIFIER', 'matchSpent was not asked about this tx\'s Withdraw nullifier');
  }
  const answer = expect.noteMatch.answer;
  if (answer.length !== 1 || answer[0] !== 0) {
    return refuse('E_A0_VERIFY_NULLIFIER', `matchSpent answered ${JSON.stringify(answer)}: the spend is not the note's`);
  }

  // the change leaf
  if (tx.leafInserted.length !== 1) {
    return refuse('E_A0_VERIFY_CHANGE_LEAF', `${tx.leafInserted.length} LeafInserted events`);
  }
  const leaf = tx.leafInserted[0]!;
  if (leaf.commitment !== expect.changeCommitment || w.changeCommitment !== expect.changeCommitment) {
    return refuse('E_A0_VERIFY_CHANGE_LEAF', 'the change leaf is not the commitment Rust proved');
  }

  // fee, destination, amount
  if (w.feeDestination !== a0AtaOf(new PublicKey(quote.feePayer)).toBase58()) {
    return refuse('E_A0_VERIFY_FEE_DESTINATION', `${w.feeDestination} is not ATA(feePayer, mint)`);
  }
  if (w.fee !== auth.fee) {
    return refuse('E_A0_VERIFY_FEE', `fee ${w.fee} is not ${auth.fee}`);
  }
  if (w.destination !== auth.ata) {
    return refuse('E_A0_VERIFY_DESTINATION', `destination ${w.destination} is not our ${auth.ata}`);
  }
  if (w.amount !== auth.amount) {
    return refuse('E_A0_VERIFY_AMOUNT', `instruction amount ${w.amount} is not ${auth.amount}`);
  }
  if (w.destinationTokenDelta !== auth.amount) {
    return refuse('E_A0_VERIFY_AMOUNT', `the destination received ${String(w.destinationTokenDelta)}, not ${auth.amount}`);
  }
  if (tx.vaultTokenDelta !== -(auth.amount + auth.fee)) {
    return refuse('E_A0_VERIFY_AMOUNT', `the vault moved ${tx.vaultTokenDelta}, not −${auth.amount + auth.fee}`);
  }

  // create-ATA-idempotent: required, exactly ours
  if (tx.createAtaIdempotent.length !== 1) {
    return refuse('E_A0_VERIFY_CREATE_ATA', `${tx.createAtaIdempotent.length} create-ATA-idempotent instructions, not 1`);
  }
  const c = tx.createAtaIdempotent[0]!;
  if (c.payer !== quote.feePayer || c.ata !== auth.ata || c.owner !== auth.owner || c.mint !== A0.mint) {
    return refuse('E_A0_VERIFY_CREATE_ATA', 'the create-ATA is not (feePayer, ata, owner, mint)');
  }

  // the seed: only the destination owner may appear
  const seedKey = tx.preBalances.find(p => seed.has(p.address) && p.address !== auth.owner);
  if (seedKey !== undefined) {
    return refuse('E_A0_VERIFY_SEED_KEY', `${seedKey.address}, a key of this seed, appears in the tx`);
  }

  // the grant (S10, m-2): top-level transfers only
  const ownerPre = tx.preBalances.find(p => p.address === auth.owner)?.lamports;
  if (ownerPre === undefined) {
    return refuse('E_A0_VERIFY_DESTINATION', 'the owner is not listed by the tx');
  }
  if (tx.systemTransfers.length > 1) {
    return refuse('E_A0_VERIFY_GRANT_COUNT', `${tx.systemTransfers.length} top-level transfers`);
  }
  let grantLamports: bigint | null = null;
  if (tx.systemTransfers.length === 1) {
    const g = tx.systemTransfers[0]!;
    // a quote without a grant (null) matches no transfer's lamports: refused here too
    if (g.lamports !== quote.gasGrantLamports || g.from !== quote.feePayer || g.to !== auth.owner) {
      return refuse(
        'E_A0_VERIFY_GRANT_TERMS',
        `transfer ${g.lamports} ${g.from} → ${g.to} is not the quote's ${String(quote.gasGrantLamports)} feePayer → owner`,
      );
    }
    if (ownerPre !== 0n) {
      return refuse('E_A0_VERIFY_GRANT_PRE_BALANCE', `the owner held ${ownerPre} lamports before the grant`);
    }
    if (!PublicKey.isOnCurve(owner.toBytes())) {
      return refuse('E_A0_VERIFY_GRANT_OFF_CURVE', 'a grant to an owner off the Ed25519 curve');
    }
    grantLamports = g.lamports;
  }

  return {
    ok: true,
    signature: tx.signature,
    changeLeaf: leaf,
    grantLamports,
    ownerPreLamports: ownerPre,
    destinationWithoutSol: expect.destinationKind === 'fresh-pending' && grantLamports === null && ownerPre === 0n,
  };
}
