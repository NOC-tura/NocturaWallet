import {API_BASE} from '../../constants/programs';
import {pinnedFetch} from '../sslPinning/pinnedFetch';
import {zkProver} from '../zkProver/zkProverModule';
import {feeEngine} from '../fees/feeEngine';
import {
  getNotes,
  selectNotes,
  addNote,
  markSpent,
} from './noteStore';
import {isValidShieldedAddress} from './shieldedAddressCodec';
import type {
  CircuitConfig,
  ConsolidationProgress,
  DepositParams,
  ShieldedNote,
  ShieldedTransferParams,
  ShieldedTxResult,
  WithdrawParams,
} from './types';
import type {ZKProof} from '../zkProver/types';

// ---- In-memory cache for circuit config ----------------------------------------

let cachedConfig: CircuitConfig | null = null;

export function _resetConfigCache(): void {
  cachedConfig = null;
}

/**
 * Fetch circuit configuration from the API.
 * Result is cached in memory for the lifetime of the JS runtime.
 */
export async function fetchCircuitConfig(): Promise<CircuitConfig> {
  if (cachedConfig !== null) {
    return cachedConfig;
  }

  const resp = await pinnedFetch(`${API_BASE}/v1/config/circuit`);
  if (resp.status !== 200) {
    throw new Error(`Circuit config fetch returned HTTP ${resp.status}`);
  }

  const data = (await resp.json()) as CircuitConfig;
  cachedConfig = data;
  return data;
}

// ---- Relayer -------------------------------------------------------------------

/**
 * Submit a proof to the relayer.
 * Returns the on-chain transaction signature.
 */
export async function submitToRelayer(proof: ZKProof): Promise<string> {
  const resp = await pinnedFetch(`${API_BASE}/v1/relayer/submit`, {
    method: 'POST',
    body: JSON.stringify(proof),
  });

  if (resp.status !== 200) {
    throw new Error(`Relayer returned HTTP ${resp.status}`);
  }

  const data = (await resp.json()) as {txSignature: string};
  return data.txSignature;
}

// ---- Witness helpers -----------------------------------------------------------

/**
 * Build a stub witness for a single note.
 * Real witness construction requires Merkle paths from the Merkle module
 * (not yet wired). Placeholders are filled with zeros.
 *
 * SECURITY: noteSecret is a stub — real implementation will derive from
 * sk_view via a deterministic PRF once the Merkle module is available.
 */
function buildWitnessForNote(
  note: ShieldedNote,
  treeDepth: number,
  recipientAddress?: string,
): Parameters<typeof zkProver.prove>[1] {
  const zeroPad = '0'.repeat(64);
  return {
    noteCommitment: note.commitment,
    merklePath: Array.from({length: treeDepth}, () => zeroPad),
    merklePathIndices: Array.from({length: treeDepth}, () => 0),
    nullifier: note.nullifier,
    amount: note.amount.toString(),
    recipientAddress,
    noteSecret: zeroPad,
  };
}

// ---- Note factory for results --------------------------------------------------

let _noteIndex = 0;

/**
 * Create a result note after a deposit/transfer/withdraw.
 * Uses a deterministic-but-unique commitment/nullifier so tests can verify
 * note creation without needing real circuit outputs.
 * Index is bumped on each call to avoid commitment collisions.
 */
function makeResultNote(
  mint: string,
  amount: bigint,
): ShieldedNote {
  const idx = _noteIndex++;
  const padded = idx.toString(16).padStart(60, '0');
  return {
    commitment: `result_commitment_${padded}`,
    nullifier: `result_nullifier_${padded}`,
    mint,
    amount,
    index: idx,
    spent: false,
    createdAt: Date.now(),
  };
}

// ---- Consolidation helper ------------------------------------------------------

/**
 * Consolidate notes when the selected count exceeds config.maxInputs.
 * Batches notes into groups of maxInputs, proves + submits each batch,
 * and replaces the batch with a single merged note.
 * Returns a new list of merged notes ready for the final transfer.
 */
async function consolidateNotes(
  notes: ShieldedNote[],
  mint: string,
  treeDepth: number,
  maxInputs: number,
  onProgress?: (progress: ConsolidationProgress) => void,
): Promise<ShieldedNote[]> {
  const batches: ShieldedNote[][] = [];
  for (let i = 0; i < notes.length; i += maxInputs) {
    batches.push(notes.slice(i, i + maxInputs));
  }

  const totalSteps = batches.length;
  const mergedNotes: ShieldedNote[] = [];

  for (let step = 0; step < batches.length; step++) {
    const batch = batches[step]!;
    onProgress?.({currentStep: step + 1, totalSteps});

    const batchTotal = batch.reduce((sum, n) => sum + n.amount, 0n);
    const primaryNote = batch[0]!;
    const witness = buildWitnessForNote(primaryNote, treeDepth);
    // Override amount to be the consolidated total for the batch
    witness.amount = batchTotal.toString();

    const proof = await zkProver.prove('transfer', witness);
    const txSig = await submitToRelayer(proof);
    // Mark all batch notes spent
    markSpent(
      mint,
      batch.map(n => n.nullifier),
    );

    // Create a merged note representing this batch
    const mergedNote = makeResultNote(mint, batchTotal);
    addNote(mergedNote);
    mergedNotes.push(mergedNote);

    // Suppress unused variable warning — txSig confirms submission
    void txSig;
  }

  return mergedNotes;
}

// ---- Deposit -------------------------------------------------------------------

/**
 * Deposit tokens into the shielded pool.
 *
 * Flow: prove('deposit') → relayer → addNote
 *
 * The deposit witness is constructed from the deposit params.
 * After successful submission the resulting note is added to the store.
 */
export async function deposit(
  params: DepositParams,
  stakingDiscount: number = 0,
): Promise<ShieldedTxResult> {
  const fee = feeEngine.getEffectiveFee('crossModeDeposit', stakingDiscount);
  const config = await fetchCircuitConfig();

  // Build a stub commitment/nullifier for the deposit note
  const zeroPad = '0'.repeat(64);
  const witness = {
    noteCommitment: zeroPad,
    merklePath: Array.from({length: config.treeDepth}, () => zeroPad),
    merklePathIndices: Array.from({length: config.treeDepth}, () => 0),
    nullifier: zeroPad,
    amount: params.amount.toString(),
    recipientAddress: params.senderPubkey,
    noteSecret: zeroPad,
  };

  const proof = await zkProver.prove('deposit', witness);
  const txSignature = await submitToRelayer(proof);

  // Record the resulting note in the shielded note store
  const resultNote = makeResultNote(params.mint, params.amount - fee);
  addNote(resultNote);

  return {
    txSignature,
    proofType: 'deposit',
    amount: params.amount,
    timestamp: Date.now(),
  };
}

// ---- Transfer ------------------------------------------------------------------

/**
 * Transfer tokens within the shielded pool.
 *
 * Flow:
 *  1. Validate recipient shielded address
 *  2. Select notes covering amount + fee
 *  3. Consolidate if selected.length > config.maxInputs
 *  4. prove('transfer') → relayer → markSpent → addNote(change)
 */
export async function transfer(
  params: ShieldedTransferParams,
  stakingDiscount: number = 0,
  onConsolidationProgress?: (progress: ConsolidationProgress) => void,
): Promise<ShieldedTxResult> {
  if (!isValidShieldedAddress(params.recipientAddress)) {
    throw new Error('Invalid shielded recipient address');
  }

  const fee = feeEngine.getEffectiveFee('privateTransfer', stakingDiscount);
  const config = await fetchCircuitConfig();

  let selected = selectNotes(params.mint, params.amount, fee);

  // Consolidate if too many notes
  if (selected.length > config.maxInputs) {
    const merged = await consolidateNotes(
      selected,
      params.mint,
      config.treeDepth,
      config.maxInputs,
      onConsolidationProgress,
    );
    // Re-select from merged notes
    selected = selectNotes(params.mint, params.amount, fee);
    void merged;
  }

  const inputTotal = selected.reduce((sum, n) => sum + n.amount, 0n);
  const primaryNote = selected[0]!;
  const witness = buildWitnessForNote(
    primaryNote,
    config.treeDepth,
    params.recipientAddress,
  );

  const proof = await zkProver.prove('transfer', witness);
  const txSignature = await submitToRelayer(proof);

  markSpent(
    params.mint,
    selected.map(n => n.nullifier),
  );

  const change = inputTotal - params.amount - fee;
  if (change > 0n) {
    const changeNote = makeResultNote(params.mint, change);
    addNote(changeNote);
  }

  return {
    txSignature,
    proofType: 'transfer',
    amount: params.amount,
    timestamp: Date.now(),
  };
}

// ---- Withdraw ------------------------------------------------------------------

/**
 * Withdraw tokens from the shielded pool back to a transparent address.
 *
 * Flow: selectNotes → prove('withdraw') → relayer → markSpent → addNote(change)
 */
export async function withdraw(
  params: WithdrawParams,
  stakingDiscount: number = 0,
): Promise<ShieldedTxResult> {
  const fee = feeEngine.getEffectiveFee('crossModeWithdraw', stakingDiscount);
  const config = await fetchCircuitConfig();

  const selected = selectNotes(params.mint, params.amount, fee);
  const inputTotal = selected.reduce((sum, n) => sum + n.amount, 0n);

  const primaryNote = selected[0]!;
  const witness = buildWitnessForNote(primaryNote, config.treeDepth);

  const proof = await zkProver.prove('withdraw', witness);
  const txSignature = await submitToRelayer(proof);

  markSpent(
    params.mint,
    selected.map(n => n.nullifier),
  );

  const change = inputTotal - params.amount - fee;
  if (change > 0n) {
    const changeNote = makeResultNote(params.mint, change);
    addNote(changeNote);
  }

  return {
    txSignature,
    proofType: 'withdraw',
    amount: params.amount,
    timestamp: Date.now(),
  };
}
