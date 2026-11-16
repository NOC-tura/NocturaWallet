/**
 * The A0 deposit (spec §5 steps 2–7): shield `amount` of the pool's mint from the main transparent
 * account into an own note, and reconcile a deposit the app did not see land.
 *
 * THE SHAPE FOLLOWS THE SCREENS (#16 → #18 → #19 → #20 → #21, wired in Task 5 (screens)):
 *   - `prepareA0Deposit` (#18, its stages reported through `onStage`) — steps 2–4: the counter and
 *     the rho-PDA pre-check, Rust's commitment, the on-device proof and the public-input compare.
 *     It writes NOTHING to the store except what a pre-check hit imports (step 2), and nothing at
 *     all when the proof's public inputs disagree;
 *   - `simulateA0Deposit` (#19) — the exact instructions, simulated on chain (which runs the
 *     program's proof verification without paying) and inspected by `checkInstructions`;
 *   - `submitA0Deposit` (#21, after #20's re-auth) — step 5 (the pending note + counter in ONE write,
 *     BEFORE the send), the send, the existing polling confirm (`pollConfirmation`), step 6 (the
 *     note becomes `unspent` at the leaf of its synced `LeafInserted`);
 *   - `reconcileA0PendingDeposits` (startup, `a0/startup.ts`, and "Check again" on a pending
 *     deposit, `useA0Shielded`) — step 7.
 *
 * TWO SETTLERS, ONE NOTE (the Task 5 ruling). "Check again" can run a reconcile while a submit's
 * settle loop is still in flight for the same note. Each side re-reads the note (through its
 * binding) after its awaits and before it writes: a submit finding its note already `unspent` with
 * the same commitment at the same leaf returns that outcome; a reconcile skips a note that is no
 * longer `pending`. Anything else (the note dropped, another leaf) still refuses in the store.
 *
 * WHAT THE RPC SEES (§2 "Who sees what"). A deposit is public by nature: its signer, amount and
 * rho are on chain once it lands. The requests this module makes beyond the sync everyone runs:
 *   - the pre-check `getAccountInfo(PDA(["rho", rho(i)]))` — the ONE lookup of an own value; it
 *     names our NEXT rho before it is public (step 2 needs it: a counter whose PDA exists would
 *     make a paid, rejected tx). The RPC can link that lookup to the deposit that follows from the
 *     same address moments later — it sees that deposit's submission anyway;
 *   - the depositor's token accounts, the latest blockhash, the simulation, the send and the
 *     signature-status polls of our own tx (what any transparent send does);
 *   - at startup, the same PDA lookup for each PENDING deposit — a rho that was broadcast (public
 *     on chain if it landed), and the block height.
 * The note's leaf is read from the tree sync (`syncA0Tree`), never from a `getTransaction` of our
 * own signature (Task 2's rule, §6.8).
 *
 * NO HOSTED PROVING, NO AUTHORIZATION. The proof is made by the Rust core with the pinned A0 key
 * files (`keyAssets.ts`); no witness leaves the device. A deposit needs no native confirmation:
 * the circuit binds the note to the user's own `nk`, so a deposit cannot pay anyone else (§5.5).
 *
 * BOUND TO ONE WALLET (R3-N5): `prepareA0Deposit`, `submitA0Deposit` and
 * `reconcileA0PendingDeposits` each capture the encrypted instance at their own entry
 * (`options.bound ?? mmkvSecure()`) and pass it to every note-store call, so a flow still in
 * flight across an in-app wipe + import refuses with `E_A0_STORE_CHANGED` before it writes
 * anything of the old wallet into the new one (or creates the new one's record).
 *
 * THE TRANSACTION: [ComputeBudget.setComputeUnitLimit(200,000), deposit] in a LEGACY message
 * signed by the depositor alone (the fee payer) — the format of the landed deposit `3DR6F7oW…`,
 * whose whole signed message our builder reproduces byte for byte (`depositTx.golden.test.ts`).
 */
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import type {Commitment, Connection, TransactionInstruction} from '@solana/web3.js';
import {base58} from '@scure/base';
import {mmkvSecure} from '../../../store/mmkv/instances';
import {A0, A0_CU} from './constants';
import {a0RhoMarkerPda, buildA0DepositIx} from './depositIx';
import {FIELD_MODULUS, toBe32Hex} from './fieldEquations';
import {ensureA0KeyFiles, A0_NPUBLIC} from './keyAssets';
import {
  A0NoteStoreError,
  addA0PendingDeposit,
  confirmA0Deposit,
  dropA0PendingDeposit,
  hasA0NoteRecord,
  loadA0NoteStore,
  mergeA0RecoveredNotes,
} from './noteStore';
import type {A0Note, A0StoreBinding} from './noteStore';
import {recoverA0Deposits} from './recovery';
import {syncA0Tree} from './treeSync';
import type {A0SyncOptions, A0VerifiedTree} from './treeSync';
import {
  a0Commitment,
  a0DepositRho,
  a0KeysClose,
  a0KeysOpen,
  a0Prove,
  isProverSupported,
} from '../../zkProver/nativeProverBridge';
import type {A0Handle} from '../../zkProver/nativeProverBridge';
import type {AssetIO} from '../../zkProver/provingAssets';
import {rnfsAssetIO} from '../../zkProver/rnfsAssetIO';
import {deriveTransparentKeypair} from '../../keyDerivation/transparent';
import {loadTransparentScheme} from '../../keyDerivation/derivationScheme';
import {resolveSourceTokenAccount} from '../../solana/transactionBuilder';
import {simulateTransaction} from '../../solana/simulation';
import {checkInstructions} from '../../solana/instructionChecks';
import type {TransferCheck} from '../../solana/simulationChecks';
import type {SimulationResult} from '../../solana/types';
import {readA0DepositOutcome, readA0DepositSubmitted} from './checkpointReadout';
import {pollConfirmation} from '../../solana/signAndSend';
import {zeroize} from '../../session/zeroize';

const U64_MAX = 2n ** 64n - 1n;
const PROOF_HEX = /^[0-9a-f]{512}$/;

/** How many pre-check hits one deposit follows before refusing (each costs a tree sync). */
export const A0_PRECHECK_MAX_HITS = 4;

/** `mintHash = be_mod_r(mint)` of the pool's mint (§1 public inputs), 64 lowercase hex. */
export const A0_MINT_HASH: string = toBe32Hex(
  BigInt(`0x${Buffer.from(base58.decode(A0.mint)).toString('hex')}`) % FIELD_MODULUS,
);

export type A0DepositErrorCode =
  /** the amount is not 1..2^64-1 base units */
  | 'E_A0_DEPOSIT_AMOUNT'
  /** the Rust prover is not available on this device (non-arm64, production build) */
  | 'E_A0_DEPOSIT_UNSUPPORTED'
  /** the RPC is not devnet (genesis hash) */
  | 'E_A0_DEPOSIT_CLUSTER'
  /** no A0 record yet: the startup restore has not run (a deposit before it could skip a note) */
  | 'E_A0_DEPOSIT_NOT_READY'
  /** the depositor holds no token account of the pool's mint */
  | 'E_A0_DEPOSIT_NO_TOKEN_ACCOUNT'
  /** a rho PDA exists but the synced history does not show its deposit yet (RPC lag): retry later */
  | 'E_A0_DEPOSIT_PRECHECK_UNSYNCED'
  /** the synced deposit of a found rho lies past the restore's gap limit: recovery did not reach it */
  | 'E_A0_DEPOSIT_PRECHECK_GAP'
  /** more than A0_PRECHECK_MAX_HITS consecutive hits */
  | 'E_A0_DEPOSIT_PRECHECK_LIMIT'
  /** the proof's public inputs are not [commitment, amount, mintHash, rho] as computed here */
  | 'E_A0_DEPOSIT_PUBLIC_INPUTS'
  /** the proof is not 256 bytes of lowercase hex */
  | 'E_A0_DEPOSIT_PROOF_SHAPE'
  /** the seed handed to submit is not the depositor's */
  | 'E_A0_DEPOSIT_SIGNER'
  /** the synced history shows a found deposit without its LeafInserted, or one rho twice */
  | 'E_A0_DEPOSIT_LEAF';

export class A0DepositError extends Error {
  readonly code: A0DepositErrorCode;
  constructor(code: A0DepositErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'A0DepositError';
    this.code = code;
  }
}

/** #18's stages, in order (a hit repeats `precheck`). */
export type A0PrepareStage = 'checking' | 'keyFiles' | 'precheck' | 'commitment' | 'proving' | 'verifying';
/** #21's stages, in order. */
export type A0SubmitStage = 'signing' | 'recorded' | 'submitted' | 'confirming' | 'settling';

export interface A0PreparedDeposit {
  readonly amount: bigint;
  readonly depositIndex: bigint;
  /** 64 lowercase hex: rho(depositIndex), Rust's */
  readonly rho: string;
  /** 64 lowercase hex: Rust's commitment(amount, rho) = the proof's public input [0] */
  readonly commitment: string;
  /** 256 bytes */
  readonly proof: Uint8Array;
  /** base58: the main transparent account (signer and fee payer) */
  readonly depositor: string;
  /** base58: its token account of the pool's mint holding the largest balance */
  readonly depositorTokenAccount: string;
  /** own notes the pre-check imported (step 2) and foreign hits it moved past */
  readonly importedNotes: number;
  readonly foreignRhoHits: number;
}

export interface A0PrepareOptions {
  io?: AssetIO;
  sync?: A0SyncOptions;
  onStage?: (stage: A0PrepareStage) => void;
  /** the encrypted instance to stay on (default: the one open at entry) — R3-N5 */
  bound?: A0StoreBinding;
}

const bytesOfHex = (h: string): Uint8Array => Uint8Array.from(Buffer.from(h, 'hex'));

/** `PDA(["rho", rho])` exists AS A POOL ACCOUNT. A system-owned account at that address (lamports
 *  someone sent there) is not a rho marker: Anchor's `init` takes a pre-funded address. */
async function rhoMarkerExists(connection: Connection, rho: string, commitment: Commitment): Promise<boolean> {
  const info = await connection.getAccountInfo(a0RhoMarkerPda(bytesOfHex(rho)), commitment);
  return info !== null && info.owner.toBase58() === A0.programId;
}

async function assertDevnet(connection: Connection): Promise<void> {
  const genesis = await connection.getGenesisHash();
  if (genesis !== A0.genesisHash) {
    throw new A0DepositError('E_A0_DEPOSIT_CLUSTER', `the RPC's genesis hash is ${genesis}, not devnet's`);
  }
}

/** The main account's public key from `seed` (the secret key is wiped before returning). */
function depositorOf(seed: Uint8Array): PublicKey {
  const {publicKey, secretKey} = deriveTransparentKeypair(seed, loadTransparentScheme());
  zeroize(secretKey);
  return new PublicKey(publicKey);
}

/**
 * Step 2: the counter and the pre-check. Returns the first counter whose rho PDA is absent. A
 * present one is imported "exactly as recovery does" (the ledger's ruling (1)): one sync, then
 * `recoverA0Deposits` under this handle — own notes (Rust's commitment matches) are merged into
 * the store, a FOREIGN hit (somebody's deposit under our public rho, commitment not ours) is NOT
 * imported and never thrown on — either way the counter moves past it — then the next counter is
 * checked.
 */
async function precheck(
  connection: Connection,
  handle: A0Handle,
  options: A0PrepareOptions,
  bound: A0StoreBinding,
): Promise<{depositIndex: bigint; rho: string; importedNotes: number; foreignRhoHits: number}> {
  let importedNotes = 0;
  let foreignRhoHits = 0;
  for (let hits = 0; ; hits++) {
    options.onStage?.('precheck');
    const depositIndex = loadA0NoteStore(bound).nextDepositIndex;
    const rho = await a0DepositRho(handle, depositIndex);
    if (!(await rhoMarkerExists(connection, rho, 'confirmed'))) {
      return {depositIndex, rho, importedNotes, foreignRhoHits};
    }
    if (hits >= A0_PRECHECK_MAX_HITS) {
      throw new A0DepositError('E_A0_DEPOSIT_PRECHECK_LIMIT', `${hits + 1} consecutive rho PDAs exist`);
    }
    const {tree} = await syncA0Tree(connection, options.sync);
    if (!tree.txs.some(t => t.deposits.some(d => d.rho === rho))) {
      throw new A0DepositError(
        'E_A0_DEPOSIT_PRECHECK_UNSYNCED',
        `counter ${depositIndex}: its rho PDA exists, the synced history does not show its deposit yet`,
      );
    }
    const rec = await recoverA0Deposits(handle, tree);
    if (rec.nextDepositIndex <= depositIndex) {
      throw new A0DepositError(
        'E_A0_DEPOSIT_PRECHECK_GAP',
        `counter ${depositIndex} is past recovery's gap limit (recovered next = ${rec.nextDepositIndex})`,
      );
    }
    const before = new Set(loadA0NoteStore(bound).notes.map(n => n.rho));
    mergeA0RecoveredNotes(rec.notes, rec.nextDepositIndex, bound);
    importedNotes += rec.notes.filter(n => !before.has(n.rho)).length;
    foreignRhoHits = rec.foreignRhoHits;
  }
}

/**
 * Steps 2–4 (#18). `seed` (64 bytes) is CONSUMED — zero-filled on every path. Refuses before any
 * key is opened when the amount, the build, the cluster, the store or the token account is wrong.
 */
export async function prepareA0Deposit(
  connection: Connection,
  seed: Uint8Array,
  amount: bigint,
  options: A0PrepareOptions = {},
): Promise<A0PreparedDeposit> {
  const bound = options.bound ?? mmkvSecure();
  try {
    options.onStage?.('checking');
    if (typeof amount !== 'bigint' || amount < 1n || amount > U64_MAX) {
      throw new A0DepositError('E_A0_DEPOSIT_AMOUNT', `amount ${String(amount)} is not 1..2^64-1 base units`);
    }
    if (!isProverSupported()) {
      throw new A0DepositError('E_A0_DEPOSIT_UNSUPPORTED', 'the on-device prover is not available');
    }
    if (!hasA0NoteRecord(bound)) {
      throw new A0DepositError('E_A0_DEPOSIT_NOT_READY', 'no A0 note record yet: the startup restore has not run');
    }
    loadA0NoteStore(bound); // CORRUPT throws here, before any request
    await assertDevnet(connection);
    const depositor = depositorOf(seed);
    const tokenAccount = await resolveSourceTokenAccount(connection, depositor, new PublicKey(A0.mint), amount);
    if (!tokenAccount) {
      throw new A0DepositError('E_A0_DEPOSIT_NO_TOKEN_ACCOUNT', `${depositor.toBase58()} holds no ${A0.mint} account`);
    }
    options.onStage?.('keyFiles');
    const {zkeyPath, wasmPath} = await ensureA0KeyFiles('deposit', options.io ?? rnfsAssetIO);

    const handle = await a0KeysOpen(seed);
    try {
      const pre = await precheck(connection, handle, options, bound);
      options.onStage?.('commitment');
      const commitment = await a0Commitment(handle, amount, pre.rho);
      options.onStage?.('proving');
      const witness = JSON.stringify({amount: amount.toString(), depositIndex: pre.depositIndex.toString()});
      const proof = await a0Prove(handle, 'deposit', witness, null, zkeyPath, wasmPath);
      options.onStage?.('verifying');
      // Step 4: the circuit's Poseidon against Rust's, and the rest against values computed here.
      const expected = [commitment, toBe32Hex(amount), A0_MINT_HASH, pre.rho];
      const names = ['commitment', 'amount', 'mintHash', 'rho'];
      if (proof.publicInputs.length !== A0_NPUBLIC.deposit) {
        throw new A0DepositError(
          'E_A0_DEPOSIT_PUBLIC_INPUTS',
          `${proof.publicInputs.length} public inputs, the deposit circuit has ${A0_NPUBLIC.deposit}`,
        );
      }
      expected.forEach((v, k) => {
        if (proof.publicInputs[k] !== v) {
          throw new A0DepositError('E_A0_DEPOSIT_PUBLIC_INPUTS', `public input ${k} (${names[k]}) is not this deposit's`);
        }
      });
      if (!PROOF_HEX.test(proof.proofBytes)) {
        throw new A0DepositError('E_A0_DEPOSIT_PROOF_SHAPE', 'the proof is not 256 bytes of lowercase hex');
      }
      return {
        amount,
        depositIndex: pre.depositIndex,
        rho: pre.rho,
        commitment,
        proof: bytesOfHex(proof.proofBytes),
        depositor: depositor.toBase58(),
        depositorTokenAccount: tokenAccount.toBase58(),
        importedNotes: pre.importedNotes,
        foreignRhoHits: pre.foreignRhoHits,
      };
    } finally {
      await a0KeysClose(handle);
    }
  } finally {
    seed.fill(0);
  }
}

/** The deposit's two instructions: [setComputeUnitLimit(units), deposit]. */
function a0DepositInstructions(p: A0PreparedDeposit, units: number): TransactionInstruction[] {
  return [
    ComputeBudgetProgram.setComputeUnitLimit({units}),
    buildA0DepositIx(
      {amount: p.amount, commitment: bytesOfHex(p.commitment), rho: bytesOfHex(p.rho), proof: p.proof},
      {depositor: new PublicKey(p.depositor), depositorTokenAccount: new PublicKey(p.depositorTokenAccount)},
    ),
  ];
}

/**
 * The unsigned deposit tx (legacy message, payer = depositor) over `blockhash`, with the CU limit
 * `units` — A0_CU.deposit (200,000) in the app; the golden test passes the landed tx's own limit
 * (1,400,000) to rebuild its message. Compiled by
 * `Transaction#compileMessage` — the compiler (and so the account order) of the landed deposit
 * `3DR6F7oW…`, whose message this reproduces byte for byte. (`TransactionMessage
 * #compileToLegacyMessage` orders the accounts differently: a valid tx, but not the shape the tree
 * sync's parser was proven on.)
 */
export function buildA0DepositTransaction(
  p: A0PreparedDeposit,
  blockhash: string,
  units: number = A0_CU.deposit,
): VersionedTransaction {
  const message = new Transaction({feePayer: new PublicKey(p.depositor), recentBlockhash: blockhash})
    .add(...a0DepositInstructions(p, units))
    .compileMessage();
  return new VersionedTransaction(message);
}

/** The instructions as the risk rows inspect them, read back from the compiled message. */
function inspectable(tx: VersionedTransaction): {programId: string; data: Uint8Array}[] {
  const keys = tx.message.staticAccountKeys;
  return tx.message.compiledInstructions.map(i => ({
    programId: keys[i.programIdIndex]?.toBase58() ?? '',
    data: Uint8Array.from(i.data),
  }));
}

/** #19: simulate the exact deposit (unsigned; the chain verifies the proof in the simulation) and
 *  derive the contract / approval rows from its compiled instructions. */
export async function simulateA0Deposit(
  connection: Connection,
  p: A0PreparedDeposit,
): Promise<{simulation: SimulationResult; checks: TransferCheck[]}> {
  const {blockhash} = await connection.getLatestBlockhash('confirmed');
  const tx = buildA0DepositTransaction(p, blockhash);
  const simulation = await simulateTransaction(connection, tx);
  return {simulation, checks: checkInstructions(inspectable(tx))};
}

// ------------------------------------------------------------------ steps 5–7

/** What the synced history says about a pending deposit's rho. */
type Settled =
  | {kind: 'ours'; signature: string; leafIndex: number; root: string}
  | {kind: 'foreign'; signature: string}
  | {kind: 'absent'};

/**
 * Our pending note against the synced history: the deposit carrying its rho is OURS when its
 * commitment and amount are the note's (Rust computed that commitment for this amount and rho —
 * the ruling's `commitment(amount, rho)` check), whatever its signature (an exact copy of our
 * instruction landed by someone else pays into our note). Any other deposit with that rho is
 * foreign (our tx failed at the rho PDA's `init`).
 */
function settle(tree: A0VerifiedTree, note: Pick<A0Note, 'rho' | 'commitment' | 'amount'>): Settled {
  const hits = tree.txs.flatMap(t => t.deposits.filter(d => d.rho === note.rho).map(d => ({t, d})));
  if (hits.length === 0) {
    return {kind: 'absent'};
  }
  if (hits.length > 1) {
    throw new A0DepositError('E_A0_DEPOSIT_LEAF', `rho ${note.rho} is deposited ${hits.length} times`);
  }
  const {t, d} = hits[0]!;
  if (d.commitment !== note.commitment || d.amount !== note.amount) {
    return {kind: 'foreign', signature: t.signature};
  }
  const leaves = t.leafInserted.filter(l => l.commitment === note.commitment);
  if (leaves.length !== 1) {
    throw new A0DepositError('E_A0_DEPOSIT_LEAF', `${t.signature}: ${leaves.length} LeafInserted of ${note.commitment}`);
  }
  return {kind: 'ours', signature: t.signature, leafIndex: leaves[0]!.leafIndex, root: leaves[0]!.root};
}

export type A0DepositOutcome =
  | {status: 'unspent'; signature: string; leafIndex: number; root: string}
  /** the note stays `pending`; the startup reconciliation decides it (§5 step 7) */
  | {status: 'pending'; signature: string; reason: 'send-failed' | 'not-confirmed' | 'not-in-sync'; detail?: string}
  /** our tx did not land: a foreign deposit holds our rho; the pending note was dropped (counter kept) */
  | {status: 'dropped'; signature: string; reason: 'foreign'; foreignSignature: string};

export interface A0SubmitOptions {
  sync?: A0SyncOptions;
  /** sync rounds after the confirmation before leaving the note pending (default 3) */
  settleAttempts?: number;
  /** pause between them (default 1500 ms) */
  settleDelayMs?: number;
  onStage?: (stage: A0SubmitStage, signature?: string) => void;
  /** the encrypted instance to stay on (default: the one open at entry) — R3-N5 */
  bound?: A0StoreBinding;
}

/** The settle loop's pending pauses (R1-m7: a test's teardown clears them; RN's setTimeout
 *  returns a number, so there is no `unref`). */
const settleTimers = new Set<ReturnType<typeof setTimeout>>();

const sleep = (ms: number): Promise<void> =>
  new Promise(r => {
    const t = setTimeout(() => {
      settleTimers.delete(t);
      r();
    }, ms);
    settleTimers.add(t);
  });

/** TEST-ONLY teardown (R1-m7): clear every pending settle-loop pause; a flow waiting on one never
 *  resumes (it is abandoned with its test). */
export function clearA0SettleTimersForTests(): void {
  for (const t of settleTimers) {
    clearTimeout(t);
  }
  settleTimers.clear();
}

/**
 * Steps 5–6 (#21). `seed` is CONSUMED (the depositor's key is derived from it, checked against
 * the prepared depositor, and wiped). The pending note and `nextDepositIndex = i + 1` are ONE store
 * write made BEFORE the send — a refusal there (another deposit took the counter) sends nothing.
 * After the send nothing throws on the chain's behalf: an unconfirmed or unsynced deposit — also
 * one whose settle sync fails or reads an ambiguous history — stays `pending` (`not-in-sync`, with
 * the error as `detail`) for the startup reconciliation, the single authority on pending deposits.
 * Only an `A0NoteStoreError` (e.g. `E_A0_STORE_CHANGED`) still rejects after the send.
 */
export async function submitA0Deposit(
  connection: Connection,
  p: A0PreparedDeposit,
  seed: Uint8Array,
  options: A0SubmitOptions = {},
): Promise<A0DepositOutcome> {
  // The M1b checkpoint's readout (devnet build only; public values only — checkpointReadout.ts):
  // the send accepted (the kill window opens), then the outcome.
  const pub = {depositor: p.depositor, amount: p.amount, commitment: p.commitment};
  const outcome = await submitOnce(connection, p, seed, {
    ...options,
    onStage: (stage, signature) => {
      if (stage === 'submitted' && signature) {
        readA0DepositSubmitted({...pub, signature});
      }
      options.onStage?.(stage, signature);
    },
  });
  readA0DepositOutcome(pub, outcome);
  return outcome;
}

async function submitOnce(
  connection: Connection,
  p: A0PreparedDeposit,
  seed: Uint8Array,
  options: A0SubmitOptions,
): Promise<A0DepositOutcome> {
  const bound = options.bound ?? mmkvSecure();
  options.onStage?.('signing');
  let secretKey: Uint8Array | null = null;
  let tx: VersionedTransaction;
  let lastValidBlockHeight: number;
  try {
    secretKey = deriveTransparentKeypair(seed, loadTransparentScheme()).secretKey;
    const signer = Keypair.fromSecretKey(secretKey);
    if (signer.publicKey.toBase58() !== p.depositor) {
      throw new A0DepositError('E_A0_DEPOSIT_SIGNER', `the seed's main account is not the depositor ${p.depositor}`);
    }
    const latest = await connection.getLatestBlockhash('confirmed');
    lastValidBlockHeight = latest.lastValidBlockHeight;
    tx = buildA0DepositTransaction(p, latest.blockhash);
    tx.sign([signer]);
  } finally {
    seed.fill(0);
    zeroize(secretKey);
  }
  const signature = base58.encode(tx.signatures[0]!);

  // Step 5: pending before submitting, counter in the same write.
  addA0PendingDeposit({
    commitment: p.commitment,
    amount: p.amount,
    rho: p.rho,
    depositIndex: p.depositIndex,
    lastValidBlockHeight,
  }, bound);
  options.onStage?.('recorded', signature);

  try {
    // preflight ON: the RPC simulates once more and refuses before forwarding a failing deposit
    // (its fee would be paid on chain even when it fails).
    await connection.sendRawTransaction(tx.serialize(), {skipPreflight: false, preflightCommitment: 'confirmed'});
  } catch (e) {
    return {status: 'pending', signature, reason: 'send-failed', detail: e instanceof Error ? e.message : String(e)};
  }
  options.onStage?.('submitted', signature);

  try {
    options.onStage?.('confirming', signature);
    await pollConfirmation(connection, signature, lastValidBlockHeight);
  } catch (e) {
    return {status: 'pending', signature, reason: 'not-confirmed', detail: e instanceof Error ? e.message : String(e)};
  }

  // Step 6: the leaf from the synced history (never a getTransaction of our own signature).
  options.onStage?.('settling', signature);
  // After a sent + confirmed deposit nothing throws on the chain's or the RPC's behalf: a failing
  // sync (E_A0_TREE_*, a timeout), an ambiguous history (E_A0_DEPOSIT_LEAF) leaves the note
  // `pending` for the startup reconciliation, the single authority on pending deposits. Only the
  // note store's own refusals propagate (E_A0_STORE_CHANGED after a wipe + import, LOCKED, …):
  // they say the store this flow wrote to is no longer the one to write.
  const attempts = options.settleAttempts ?? 3;
  try {
    for (let k = 0; k < attempts; k++) {
      if (k > 0) {
        await sleep(options.settleDelayMs ?? 1500);
      }
      const {tree} = await syncA0Tree(connection, options.sync);
      const s = settle(tree, p);
      if (s.kind === 'ours') {
        // a reconcile ("Check again") may have settled it meanwhile: the same leaf is this outcome
        const now = noteNow(p.rho, bound);
        if (now?.status === 'unspent' && now.commitment === p.commitment && now.leafIndex === s.leafIndex) {
          return {status: 'unspent', signature, leafIndex: s.leafIndex, root: s.root};
        }
        confirmA0Deposit(p.rho, {leafIndex: s.leafIndex, commitment: p.commitment}, bound);
        return {status: 'unspent', signature, leafIndex: s.leafIndex, root: s.root};
      }
      if (s.kind === 'foreign') {
        dropA0PendingDeposit(p.rho, bound);
        return {status: 'dropped', signature, reason: 'foreign', foreignSignature: s.signature};
      }
    }
  } catch (e) {
    if (e instanceof A0NoteStoreError) {
      throw e;
    }
    return {status: 'pending', signature, reason: 'not-in-sync', detail: e instanceof Error ? e.message : String(e)};
  }
  return {status: 'pending', signature, reason: 'not-in-sync'};
}

/** The note with `rho` as the bound store holds it now, without the first-run write (no record → none). */
function noteNow(rho: string, bound: A0StoreBinding): A0Note | undefined {
  if (!hasA0NoteRecord(bound)) {
    return undefined;
  }
  return loadA0NoteStore(bound).notes.find(n => n.rho === rho);
}

const stillPendingDeposit = (rho: string, bound: A0StoreBinding): boolean => {
  const n = noteNow(rho, bound);
  return n !== undefined && n.status === 'pending' && n.lastValidBlockHeight !== undefined;
};

/**
 * A note settled by another flow while this run reached it is in none of the lists; `skipped`
 * counts those (Task 7: the checkpoint readout reports it, so a note missing from all three lists
 * is accounted for).
 */
export interface A0ReconcileReport {
  confirmed: {rho: string; leafIndex: number; signature: string}[];
  dropped: {rho: string; reason: 'expired' | 'foreign'}[];
  stillPending: {rho: string; reason: 'not-expired' | 'not-in-sync'}[];
  skipped: number;
}

/**
 * Step 7, at startup: every pending DEPOSIT (a pending unshield is M1c's) by its rho PDA —
 *   - present (a pool account, `confirmed`) → its deposit from the synced history: ours →
 *     `unspent` at its leaf; foreign → dropped (our tx failed at `init`); not synced yet → kept;
 *   - absent → dropped only once the FINALIZED block height is past the note's
 *     `lastValidBlockHeight` AND a `finalized` read of the PDA, made after that height was seen,
 *     is still absent: a tx can only land in a block at or below its lastValidBlockHeight, and
 *     every block up to a finalized height is final, so the drop is exact; otherwise kept.
 * `nextDepositIndex` is never lowered (the store refuses it; a drop keeps the counter used).
 * No pending deposit → no request at all. A note that is no longer `pending` when its turn comes
 * — or when its reads return (a submit's settle loop, another "Check again") — is skipped, never a
 * rejection of the whole run (Task 5 ruling).
 */
export async function reconcileA0PendingDeposits(
  connection: Connection,
  options: {sync?: A0SyncOptions; bound?: A0StoreBinding} = {},
): Promise<A0ReconcileReport> {
  const bound = options.bound ?? mmkvSecure();
  const report: A0ReconcileReport = {confirmed: [], dropped: [], stillPending: [], skipped: 0};
  const pending = loadA0NoteStore(bound).notes.filter(n => n.status === 'pending' && n.lastValidBlockHeight !== undefined);
  let tree: A0VerifiedTree | null = null;
  let finalizedHeight: number | null = null;
  for (const n of pending) {
    if (!stillPendingDeposit(n.rho, bound)) {
      report.skipped += 1;
      continue; // settled elsewhere before its turn
    }
    if (await rhoMarkerExists(connection, n.rho, 'confirmed')) {
      tree ??= (await syncA0Tree(connection, options.sync)).tree;
      const s = settle(tree, n);
      if (!stillPendingDeposit(n.rho, bound)) {
        report.skipped += 1;
        continue; // settled elsewhere while this run read the chain
      }
      if (s.kind === 'ours') {
        confirmA0Deposit(n.rho, {leafIndex: s.leafIndex, commitment: n.commitment}, bound);
        report.confirmed.push({rho: n.rho, leafIndex: s.leafIndex, signature: s.signature});
      } else if (s.kind === 'foreign') {
        dropA0PendingDeposit(n.rho, bound);
        report.dropped.push({rho: n.rho, reason: 'foreign'});
      } else {
        report.stillPending.push({rho: n.rho, reason: 'not-in-sync'});
      }
      continue;
    }
    finalizedHeight ??= await connection.getBlockHeight('finalized');
    if (finalizedHeight <= n.lastValidBlockHeight!) {
      report.stillPending.push({rho: n.rho, reason: 'not-expired'});
      continue;
    }
    if (await rhoMarkerExists(connection, n.rho, 'finalized')) {
      // landed between the two reads: the next start finds it present
      report.stillPending.push({rho: n.rho, reason: 'not-in-sync'});
      continue;
    }
    if (!stillPendingDeposit(n.rho, bound)) {
      report.skipped += 1;
      continue; // settled elsewhere while this run read the chain
    }
    dropA0PendingDeposit(n.rho, bound);
    report.dropped.push({rho: n.rho, reason: 'expired'});
  }
  return report;
}
