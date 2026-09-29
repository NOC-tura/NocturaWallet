import {PublicKey, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
import type {Connection, TransactionInstruction} from '@solana/web3.js';
import {getConnection} from './connection';
import {getAccountInfo} from './queries';
import {NOCTURA_FEE_TREASURY} from '../../constants/programs';
import {feeEngine} from '../fees/feeEngine';
import {
  buildSolTransferInstructions,
  buildSplTransferInstructions,
  findAssociatedTokenAddress,
  selectSourceTokenAccount,
  type Markup,
} from '../../../core/solana/transfer';
import type {TransferParams, SPLTransferParams} from './types';

// The pure builders moved to core/solana/transfer.ts, shared with the browser extension. This file
// keeps what binds them to the app: the markup from the fee store, and the Connection reads.
export * from '../../../core/solana/transfer';

/**
 * True ONLY when the recipient's ATA for `mint` does not exist yet — sending to a recipient who
 * already holds the token must not prepend a create (it fails with "account already in use").
 */
export async function resolveCreateAta(connection: Connection, recipient: PublicKey, mint: PublicKey): Promise<boolean> {
  const ata = findAssociatedTokenAddress(recipient, mint);
  const info = await getAccountInfo(connection, ata);
  return !info.exists;
}

/**
 * The sender's source token account for `mint`: the owned account with the largest balance (the
 * wallet may hold the mint in a non-canonical account), or null. Throws when no single account
 * covers `requiredAmount` — see selectSourceTokenAccount.
 */
export async function resolveSourceTokenAccount(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
  requiredAmount?: bigint,
): Promise<PublicKey | null> {
  const response = await connection.getParsedTokenAccountsByOwner(owner, {mint});
  const accounts = response.value.map(({pubkey, account}) => {
    const parsed = account.data.parsed as {info?: {tokenAmount?: {amount?: string}}};
    return {pubkey, amount: BigInt(parsed.info?.tokenAmount?.amount ?? '0')};
  });
  return selectSourceTokenAccount(accounts, requiredAmount);
}

/**
 * The Noctura markup actually charged on a transparent transfer, in lamports — THE single source
 * for the builders and the send screen's fee/MAX math. Delegates to the fee engine (and through it
 * to core/fees), so pre-TGE this is 0n.
 */
export function getTransferMarkupLamports(): bigint {
  return feeEngine.getEffectiveFee('transferMarkup');
}

function appMarkup(): Markup | null {
  const lamports = getTransferMarkupLamports();
  return lamports > 0n ? {lamports, treasury: new PublicKey(NOCTURA_FEE_TREASURY)} : null;
}

/** Native SOL transfer: optional budget, the transfer, and the markup only when non-zero. */
export function buildTransferInstructions(params: TransferParams): TransactionInstruction[] {
  return buildSolTransferInstructions({...params, markup: appMarkup()});
}

export async function buildTransferTx(params: TransferParams): Promise<VersionedTransaction> {
  const {blockhash} = await getConnection().getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: params.sender,
    recentBlockhash: blockhash,
    instructions: buildTransferInstructions(params),
  }).compileToV0Message();
  return new VersionedTransaction(message);
}

/** SPL transfer: optional budget, optional recipient ATA creation, TransferChecked, markup when non-zero. */
export function buildSPLTransferInstructions(params: SPLTransferParams): TransactionInstruction[] {
  return buildSplTransferInstructions({...params, markup: appMarkup()});
}

export async function buildSPLTransferTx(params: SPLTransferParams): Promise<VersionedTransaction> {
  const {blockhash} = await getConnection().getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: params.sender,
    recentBlockhash: blockhash,
    instructions: buildSPLTransferInstructions(params),
  }).compileToV0Message();
  return new VersionedTransaction(message);
}
