/* eslint-disable no-bitwise -- byte-level decoding is what this file is about */
/**
 * One transaction of the A0 tree's history as the wallet keeps it: the `SyncedTx` record (spec
 * §9, I-2), decoded from a `getTransaction` answer. M1b builds every field so that M1c's
 * post-landing verifier (§6 step 8) and recovery (§7) never re-open the sync.
 *
 * What is admitted (§9, m8):
 *   - only successful transactions (`meta.err === null`); a failed one yields `null`;
 *   - event blobs only from a TOP-LEVEL instruction of the pool program FeGSS… whose accounts at
 *     the IDL positions are [pool 8VMe…, tree 5URd…] — `isOurA0Ix`, the same predicate as the
 *     instruction decode below (Fable review R1-I1: listing 5URd… elsewhere is not enough) — in
 *     a frame that succeeded (`eventLogs.poolLeafBlobs`, the per-instruction scoping); `deposit`,
 *     `withdraw_with_change` and `transfer` all hold pool at 0 and merkle_tree at 1 in the IDL,
 *     so every legitimate leaf is admitted — and of those only `LeafInserted` (8 + exactly 80 bytes) and
 *     `Withdraw` (8 + exactly 32). The v1 `depositLegacy` discriminator is not one of them. A
 *     `LeafInserted` / `Withdraw` of another length from the pool's own frame is a refusal of
 *     the whole sync (the program cannot have emitted it; something is wrong upstream).
 *     `NoteCiphertext` / `Transfer` (M2) and unknown discriminators are not admitted;
 *   - `deposit` / `withdraw_with_change` arguments only from a top-level FeGSS… instruction
 *     whose accounts are [pool 8VMe…, tree 5URd…, …] in IDL order — decoded exactly (§1 layout)
 *     or the sync refuses.
 *
 * Everything else a transaction carries is decoded leniently and never throws: anyone can land
 * a successful transaction that merely LISTS the tree, so a decoder that throws on a stranger's
 * instruction would be a pool-wide denial of service. Only the pool program's own data on this
 * tree — which only the program can make succeed — is decoded strictly.
 *
 * All 32-byte values are 64-char lowercase big-endian hex (the bridge's convention); amounts and
 * lamports are BigInt; keys are base58.
 */
import type {VersionedTransactionResponse} from '@solana/web3.js';
import {poolLeafBlobs} from '../eventLogs';
import {
  A0,
  A0_DEPOSIT_ACCOUNTS,
  A0_DEPOSIT_ARGS_BYTES,
  A0_EVENT_DISCRIMINATOR,
  A0_EVENT_PAYLOAD_BYTES,
  A0_IX_DISCRIMINATOR,
  A0_PROOF_BYTES,
  A0_WITHDRAW_CHANGE_ACCOUNTS,
  A0_WITHDRAW_CHANGE_ARGS_BYTES,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
} from './constants';
import {A0SyncError} from './syncErrors';

export interface A0LeafInserted {
  commitment: string;
  leafIndex: number;
  root: string;
}

/** A top-level `deposit` on this pool (§1): its arguments and its depositor. */
export interface A0DepositRecord {
  amount: bigint;
  commitment: string;
  rho: string;
  /** account 3, the signer that paid */
  depositor: string;
  /** account 4, the token account the amount left */
  depositorTokenAccount: string;
}

/** A top-level `withdraw_with_change` on this pool (§1): its arguments and accounts. */
export interface A0WithdrawRecord {
  merkleRoot: string;
  nullifier: string;
  amount: bigint;
  changeCommitment: string;
  fee: bigint;
  /** account 3, destination_token_account */
  destination: string;
  /** account 5, the instruction's fee_payer signer */
  feePayer: string;
  /** account 6, fee_destination_token_account */
  feeDestination: string;
  /** post − pre token amount of `destination` in the pool's mint; null when the tx lists no token balance for it */
  destinationTokenDelta: bigint | null;
}

/** A top-level SystemProgram.transfer (instruction 2), decoded. */
export interface A0SystemTransfer {
  from: string;
  to: string;
  lamports: bigint;
}

/** A top-level create-ATA-idempotent (ATA program, data [1]), decoded. */
export interface A0CreateAtaIdempotent {
  payer: string;
  ata: string;
  owner: string;
  mint: string;
}

/** The §9 `SyncedTx` record. */
export interface A0SyncedTx {
  signature: string;
  slot: number;
  /** chain time (unix seconds) as the RPC reports it; null when the node has none */
  blockTime: number | null;
  /** the first `numRequiredSignatures` static keys */
  signers: string[];
  /** static key 0 */
  feePayer: string;
  /** the program id of every top-level instruction, in order (lets M1c refuse an unexpected one) */
  topLevelPrograms: string[];
  /** the admitted LeafInserted events, in emission order */
  leafInserted: A0LeafInserted[];
  /** the admitted Withdraw events' nullifiers, in emission order */
  withdrawNullifiers: string[];
  deposits: A0DepositRecord[];
  withdrawals: A0WithdrawRecord[];
  /** top-level only — the inner system calls of the ATA program and FeGSS… are not counted (§6 step 8) */
  systemTransfers: A0SystemTransfer[];
  /** top-level only */
  createAtaIdempotent: A0CreateAtaIdempotent[];
  /** every account the tx lists (static, then ALT writable, then ALT readonly) with its pre-balance */
  preBalances: {address: string; lamports: bigint}[];
  /** post − pre token amount of the vault 3A7J… in the pool's mint (0 when the tx lists none) */
  vaultTokenDelta: bigint;
}

const hex = (b: Uint8Array): string => {
  let s = '';
  for (const x of b) {
    s += x.toString(16).padStart(2, '0');
  }
  return s;
};

const readU64 = (b: Uint8Array, at: number): bigint => {
  let v = 0n;
  for (let i = 7; i >= 0; i--) {
    v = (v << 8n) | BigInt(b[at + i]!);
  }
  return v;
};

const readU32 = (b: Uint8Array, at: number): number =>
  (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0;

const b58 = (k: {toBase58(): string}): string => k.toBase58();

interface TopIx {
  programId: string;
  accounts: string[];
  data: Uint8Array;
}

/**
 * Ours = a FeGSS… instruction whose accounts at the IDL positions are [pool 8VMe…, merkle_tree
 * 5URd…]. The one predicate for both the instruction decode and the event admission (R1-I1).
 */
function isOurA0Ix(ix: {programId: string; accounts: string[]}): boolean {
  return ix.programId === A0.programId && ix.accounts[0] === A0.pool && ix.accounts[1] === A0.merkleTree;
}

function decodeDeposit(sig: string, ix: TopIx): A0DepositRecord {
  const d = ix.data;
  if (d.length !== 8 + A0_DEPOSIT_ARGS_BYTES) {
    throw new A0SyncError('E_A0_IX_DECODE', `${sig}: deposit data is ${d.length} bytes, not ${8 + A0_DEPOSIT_ARGS_BYTES}`);
  }
  if (readU32(d, 8 + 72) !== A0_PROOF_BYTES) {
    throw new A0SyncError('E_A0_IX_DECODE', `${sig}: deposit proof length prefix is not ${A0_PROOF_BYTES}`);
  }
  if (ix.accounts.length < A0_DEPOSIT_ACCOUNTS.length) {
    throw new A0SyncError('E_A0_IX_DECODE', `${sig}: deposit lists ${ix.accounts.length} accounts`);
  }
  return {
    amount: readU64(d, 8),
    commitment: hex(d.subarray(16, 48)),
    rho: hex(d.subarray(48, 80)),
    depositor: ix.accounts[A0_DEPOSIT_ACCOUNTS.indexOf('depositor')]!,
    depositorTokenAccount: ix.accounts[A0_DEPOSIT_ACCOUNTS.indexOf('depositor_token_account')]!,
  };
}

function decodeWithdraw(
  sig: string,
  ix: TopIx,
): Omit<A0WithdrawRecord, 'destinationTokenDelta'> {
  const d = ix.data;
  if (d.length !== 8 + A0_WITHDRAW_CHANGE_ARGS_BYTES) {
    throw new A0SyncError(
      'E_A0_IX_DECODE',
      `${sig}: withdraw_with_change data is ${d.length} bytes, not ${8 + A0_WITHDRAW_CHANGE_ARGS_BYTES}`,
    );
  }
  // disc 8 | merkle_root 32 | nullifier 32 | amount 8 | change_commitment 32 | fee 8 | u32 256 | proof
  if (readU32(d, 8 + 112) !== A0_PROOF_BYTES) {
    throw new A0SyncError('E_A0_IX_DECODE', `${sig}: withdraw proof length prefix is not ${A0_PROOF_BYTES}`);
  }
  if (ix.accounts.length < A0_WITHDRAW_CHANGE_ACCOUNTS.length) {
    throw new A0SyncError('E_A0_IX_DECODE', `${sig}: withdraw_with_change lists ${ix.accounts.length} accounts`);
  }
  const at = (n: (typeof A0_WITHDRAW_CHANGE_ACCOUNTS)[number]) =>
    ix.accounts[A0_WITHDRAW_CHANGE_ACCOUNTS.indexOf(n)]!;
  return {
    merkleRoot: hex(d.subarray(8, 40)),
    nullifier: hex(d.subarray(40, 72)),
    amount: readU64(d, 72),
    changeCommitment: hex(d.subarray(80, 112)),
    fee: readU64(d, 112),
    destination: at('destination_token_account'),
    feePayer: at('fee_payer'),
    feeDestination: at('fee_destination_token_account'),
  };
}

type TokenBalance = NonNullable<
  NonNullable<VersionedTransactionResponse['meta']>['preTokenBalances']
>[number];

/** post − pre of `accountIndex` in the pool's mint; null when neither side lists it. */
function tokenDelta(
  sig: string,
  pre: readonly TokenBalance[],
  post: readonly TokenBalance[],
  accountIndex: number,
): bigint | null {
  const pick = (list: readonly TokenBalance[]): bigint | null => {
    const e = list.find(t => t.accountIndex === accountIndex);
    if (!e) {
      return null;
    }
    if (e.mint !== A0.mint) {
      throw new A0SyncError('E_A0_TX_SHAPE', `${sig}: account ${accountIndex} holds mint ${e.mint}, not the pool's`);
    }
    return BigInt(e.uiTokenAmount.amount);
  };
  const a = pick(pre);
  const b = pick(post);
  if (a === null && b === null) {
    return null;
  }
  return (b ?? 0n) - (a ?? 0n);
}

/**
 * Decode one `getTransaction` answer (any version) into the §9 record, or `null` when the
 * transaction failed. Throws `A0SyncError` only for the pool's own data on this tree (above).
 */
export function parseA0SyncedTx(
  signature: string,
  tx: VersionedTransactionResponse,
): A0SyncedTx | null {
  const meta = tx.meta;
  if (!meta) {
    throw new A0SyncError('E_A0_TX_SHAPE', `${signature}: the RPC returned no meta`);
  }
  if (meta.err !== null) {
    return null;
  }
  if (tx.transaction.signatures[0] !== signature) {
    throw new A0SyncError(
      'E_A0_TX_MISSING',
      `asked for ${signature}, the RPC returned ${tx.transaction.signatures[0]}`,
    );
  }
  const msg = tx.transaction.message;
  const statics = msg.staticAccountKeys.map(b58);
  const keys = [
    ...statics,
    ...(meta.loadedAddresses?.writable ?? []).map(b58),
    ...(meta.loadedAddresses?.readonly ?? []).map(b58),
  ];
  if (meta.preBalances.length !== keys.length) {
    throw new A0SyncError(
      'E_A0_TX_SHAPE',
      `${signature}: ${meta.preBalances.length} pre-balances for ${keys.length} accounts`,
    );
  }
  const top: TopIx[] = msg.compiledInstructions.map(ci => ({
    programId: keys[ci.programIdIndex] ?? '',
    accounts: ci.accountKeyIndexes.map(i => keys[i] ?? ''),
    data: ci.data,
  }));

  const deposits: A0DepositRecord[] = [];
  const withdrawals: Omit<A0WithdrawRecord, 'destinationTokenDelta'>[] = [];
  const systemTransfers: A0SystemTransfer[] = [];
  const createAtaIdempotent: A0CreateAtaIdempotent[] = [];
  for (const ix of top) {
    if (ix.programId === A0.programId) {
      if (!isOurA0Ix(ix)) {
        continue; // another pool's instruction, or one that does not write this tree
      }
      const disc = hex(ix.data.subarray(0, 8));
      if (disc === A0_IX_DISCRIMINATOR.deposit) {
        deposits.push(decodeDeposit(signature, ix));
      } else if (disc === A0_IX_DISCRIMINATOR.withdrawWithChange) {
        withdrawals.push(decodeWithdraw(signature, ix));
      }
    } else if (ix.programId === SYSTEM_PROGRAM_ID) {
      if (ix.data.length === 12 && readU32(ix.data, 0) === 2 && ix.accounts.length >= 2) {
        systemTransfers.push({
          from: ix.accounts[0]!,
          to: ix.accounts[1]!,
          lamports: readU64(ix.data, 4),
        });
      }
    } else if (ix.programId === ASSOCIATED_TOKEN_PROGRAM_ID) {
      if (ix.data.length === 1 && ix.data[0] === 1 && ix.accounts.length >= 4) {
        createAtaIdempotent.push({
          payer: ix.accounts[0]!,
          ata: ix.accounts[1]!,
          owner: ix.accounts[2]!,
          mint: ix.accounts[3]!,
        });
      }
    }
  }

  const leafInserted: A0LeafInserted[] = [];
  const withdrawNullifiers: string[] = [];
  for (const blob of poolLeafBlobs(tx, A0.programId, isOurA0Ix)) {
    const disc = hex(blob.subarray(0, 8));
    if (disc === A0_EVENT_DISCRIMINATOR.leafInserted) {
      if (blob.length !== 8 + A0_EVENT_PAYLOAD_BYTES.leafInserted) {
        throw new A0SyncError('E_A0_EVENT_LENGTH', `${signature}: LeafInserted of ${blob.length} bytes`);
      }
      const idx = readU64(blob, 40);
      if (idx >= 1n << 20n) {
        throw new A0SyncError('E_A0_LEAF_ORDER', `${signature}: LeafInserted leaf_index ${idx} ≥ 2^20`);
      }
      leafInserted.push({
        commitment: hex(blob.subarray(8, 40)),
        leafIndex: Number(idx),
        root: hex(blob.subarray(48, 80)),
      });
    } else if (disc === A0_EVENT_DISCRIMINATOR.withdraw) {
      if (blob.length !== 8 + A0_EVENT_PAYLOAD_BYTES.withdraw) {
        throw new A0SyncError('E_A0_EVENT_LENGTH', `${signature}: Withdraw of ${blob.length} bytes`);
      }
      withdrawNullifiers.push(hex(blob.subarray(8, 40)));
    }
    // NoteCiphertext / Transfer (M2) and any other discriminator: not admitted.
  }

  const pre = meta.preTokenBalances ?? [];
  const post = meta.postTokenBalances ?? [];
  const vaultIndex = keys.indexOf(A0.vault);
  const vaultTokenDelta =
    vaultIndex < 0 ? 0n : (tokenDelta(signature, pre, post, vaultIndex) ?? 0n);

  return {
    signature,
    slot: tx.slot,
    blockTime: tx.blockTime ?? null,
    signers: statics.slice(0, msg.header.numRequiredSignatures),
    feePayer: statics[0]!,
    topLevelPrograms: top.map(i => i.programId),
    leafInserted,
    withdrawNullifiers,
    deposits,
    withdrawals: withdrawals.map(w => ({
      ...w,
      destinationTokenDelta: tokenDelta(signature, pre, post, keys.indexOf(w.destination)),
    })),
    systemTransfers,
    createAtaIdempotent,
    preBalances: keys.map((address, i) => ({address, lamports: BigInt(meta.preBalances[i]!)})),
    vaultTokenDelta,
  };
}
