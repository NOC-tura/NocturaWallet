/**
 * The deployed A0 shielded pool on DEVNET — facts from the program side (spec 2026-11-08
 * shielded A0 M1 §1; their docs/zk-contract/devnet-a0-deployed-contract.json, the IDL
 * target/idl/shielded_pool.json sha256 cfd37078…, and programs/shielded-pool/src/lib.rs
 * `DepositCtx` at their HEAD).
 *
 * THE BOUNDARY (§1: "the facts are theirs, the values are ours"). The names, ids, layouts and
 * discriminators below are facts. The four addresses that are VALUES of a derivation — the pool
 * PDA and its bump, the tree PDA, the vault ATA — are written here as literals so the app never
 * derives them at run time, and `__tests__/depositIx.golden.test.ts` derives each one with the
 * real @solana/web3.js and compares it with this literal AND with the landed deposit 3DR6F7oW….
 *
 * Devnet only (R8): shielded ships only in the devnet build. These replace the v1 program
 * NPkc… constants of `src/constants/programs.ts`, which M1b's removal task deletes (§12).
 * Strings, not PublicKeys: a module-load PublicKey would be a side effect for every importer.
 */

export const A0 = {
  cluster: 'devnet',
  /** devnet's genesis hash — the chain identity these addresses belong to. */
  genesisHash: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
  programId: 'FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH',
  /** PDA(["pool", mint], programId) — value, compared in the golden test. */
  pool: '8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT',
  poolBump: 253,
  /** The pool's mint (classic SPL Token program). */
  mint: 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs',
  mintDecimals: 9,
  /** PDA(["merkle", pool], programId) — value. */
  merkleTree: '5URdh1uLKXPh28AbcXBK1oWYGpQjVbMSjrKiAkt1q1Gc',
  /** ATA(pool, mint), an off-curve owner — value. The program checks it equals pool.vault. */
  vault: '3A7JjFg4ZbZrEsvAZReSaWxjCvi5NZUTAyAZaLfQjuYC',
} as const;

export const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';

/** Anchor instruction discriminators, sha256("global:<name>")[0..8], hex. */
export const A0_IX_DISCRIMINATOR = {
  deposit: 'f223c68952e1f2b6',
  withdrawWithChange: '6cf44379ecf67997',
  transfer: 'a334c8e78c0345ba',
} as const;

/** Anchor event discriminators, sha256("event:<Name>")[0..8], hex (the `Program data:` prefix). */
export const A0_EVENT_DISCRIMINATOR = {
  leafInserted: '59f3d408d7bfbb98',
  noteCiphertext: '6c50afa0eadfd292',
  transfer: '19121707ac74821c',
  withdraw: 'c0f1c9d946965af7',
} as const;

/**
 * `deposit`'s accounts, in the IDL's order (= DepositCtx). Flags: pool r; merkle_tree w; vault w;
 * depositor signer + w (pays the rho marker's rent); depositor_token_account w;
 * rho_marker w (init, PDA ["rho", rho]); token_program; system_program.
 */
export const A0_DEPOSIT_ACCOUNTS = [
  'pool',
  'merkle_tree',
  'vault',
  'depositor',
  'depositor_token_account',
  'rho_marker',
  'token_program',
  'system_program',
] as const;

/** The global rho-marker PDA seed: ["rho", rho] (rho = 32 bytes, canonical BE field element). */
export const A0_RHO_SEED = 'rho';

/** Groth16 proof bytes as the program reads them (A.y negated). */
export const A0_PROOF_BYTES = 256;
/** deposit args after the discriminator: amount 8 + commitment 32 + rho 32 + (4 + proof 256). */
export const A0_DEPOSIT_ARGS_BYTES = 8 + 32 + 32 + 4 + A0_PROOF_BYTES;

/**
 * Compute-unit limits the wallet sets (spec §1, §5 step 5, §6). Measured by the program side:
 * deposit 139,135 / 140,627; the landed 3DR6F7oW… consumed 142,287 for the whole tx.
 */
export const A0_CU = {deposit: 200_000, withdrawChange: 200_000} as const;
