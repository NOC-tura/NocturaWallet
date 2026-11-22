/**
 * post-M1d spec §5 (R9, R11, R12): one parsed transaction → what #27 shows. Pure: the RPC response and
 * the symbol source are handed in. Best effort — a field the response does not carry stays null; it is
 * never filled with a guess (a token account is never called the wallet; a base-unit amount is never
 * shown as a human one).
 *
 * R11: the mint, decimals and owner of an SPL transfer are read from `meta.postTokenBalances` (the pre
 * entry only when an account has no post one), matched by the token account's index in `accountKeys`.
 * A plain `transfer` carries no mint; `transferChecked` carries it, and the instruction's own values win
 * when present.
 * R12 (as corrected by plan review r1-10): "from" is the wallet the funds left — `info.source` (SOL); the
 * OWNER of the source token account, from the token balances (SPL). `info.authority` is kept apart as
 * `authority`: it is the owner in an ordinary send and a delegate in a delegated one. Never the fee payer,
 * which is a relayer for a relayed transaction. A failed transaction has no direction (r1-2).
 */
import {NOCTURA_FEE_TREASURY} from '../../constants/programs';
import {formatTokenAmount} from '../../utils/parseTokenAmount';

export interface TxTransfer {
  /** 'native' for SOL, else the mint; null when neither the instruction nor the token balances name one */
  mint: string | null;
  /** 'SOL', a symbol from a trusted source, or the short mint; '' only when `mint` is null */
  symbol: string;
  /** human, exact (BigInt-formatted); null when the decimals are not known — never a raw base-unit figure */
  amount: string | null;
  /** the WALLET the funds left (R12, review r1-10): `info.source` for SOL; for SPL the OWNER of the source token
   *  account, read from the token balances (post, then pre). Never the fee payer, and never `info.authority` — a
   *  delegate can move tokens it does not own. null when the response names no owner. */
  from: string | null;
  /** SPL only: who authorised the transfer (`info.authority`, else `info.multisigAuthority`); null for SOL or
   *  when absent. Equal to `from` for an ordinary send; different for a delegated one. */
  authority: string | null;
  /** SPL only: the source token account */
  fromTokenAccount: string | null;
  /** the recipient WALLET when the response names it; otherwise the destination token account */
  to: string;
  /** true when `to` is a token account (the response named no owner): the screen labels it "token account" */
  toIsTokenAccount: boolean;
  /** SPL only: the destination token account */
  toTokenAccount: string | null;
}

export interface TxDetail {
  signature: string;
  status: 'confirmed' | 'finalized' | 'failed';
  /** the first SOL or SPL transfer that is not the Noctura fee markup; null when the transaction has none */
  transfer: TxTransfer | null;
  /** accountKeys[0] — shown as "Fee payer" only when there is no transfer; never as "From" */
  feePayer: string;
  /** every account key that signed */
  signers: string[];
  feeLamports: bigint;
  slot: number;
  blockTime: number | null;
  memo: string | null;
}

export type TxDirection = 'sent' | 'received' | 'none';

export interface RawTokenBalance {
  accountIndex?: number;
  mint?: string;
  owner?: string;
  uiTokenAmount?: {decimals?: number};
}

export interface RawParsedTx {
  slot?: number;
  blockTime?: number | null;
  meta?: {
    fee?: number;
    err?: unknown;
    preTokenBalances?: RawTokenBalance[] | null;
    postTokenBalances?: RawTokenBalance[] | null;
  } | null;
  transaction?: {
    message?: {
      accountKeys?: Array<{pubkey?: unknown; signer?: boolean; writable?: boolean}>;
      instructions?: unknown[];
    };
  };
}

interface RawInstruction {
  program?: string;
  parsed?: {type?: string; info?: Record<string, unknown>} | string;
}

const SOL_DECIMALS = 9;

function keyString(k: unknown): string {
  if (typeof k === 'string') {
    return k;
  }
  if (k !== null && typeof k === 'object' && typeof (k as {toString?: unknown}).toString === 'function') {
    return (k as {toString: () => string}).toString();
  }
  return '';
}

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/** A base-unit amount as BigInt: a decimal string or a safe non-negative integer; anything else is not an amount. */
function toBaseUnits(v: unknown): bigint | null {
  if (typeof v === 'string' && /^\d+$/.test(v)) {
    return BigInt(v);
  }
  if (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0) {
    return BigInt(v);
  }
  return null;
}

export function parseTxDetail(tx: RawParsedTx, signature: string, symbolOf: (mint: string) => string): TxDetail {
  const meta = tx.meta ?? {};
  const keys = (tx.transaction?.message?.accountKeys ?? []).map(k => ({address: keyString(k.pubkey), signer: k.signer === true}));
  const postBalances = meta.postTokenBalances ?? [];
  const preBalances = meta.preTokenBalances ?? [];
  /**
   * R11: a token account's balance entry, matched by its index among the account keys. The POST entry
   * first; the PRE entry only when there is no post one (an account closed in this transaction) — its
   * mint, decimals and owner are the same account's (review r1-10).
   */
  const balanceOf = (tokenAccount: string | null): RawTokenBalance | undefined => {
    if (tokenAccount === null) {
      return undefined;
    }
    const index = keys.findIndex(k => k.address === tokenAccount);
    if (index < 0) {
      return undefined;
    }
    return postBalances.find(b => b.accountIndex === index) ?? preBalances.find(b => b.accountIndex === index);
  };

  let transfer: TxTransfer | null = null;
  let memo: string | null = null;

  for (const ix of (tx.transaction?.message?.instructions ?? []) as RawInstruction[]) {
    if (ix.program === 'spl-memo') {
      memo = typeof ix.parsed === 'string' ? ix.parsed : memo;
      continue;
    }
    if (transfer !== null) {
      continue;
    }
    const parsed = typeof ix.parsed === 'object' && ix.parsed !== null ? ix.parsed : undefined;
    const info = parsed?.info ?? {};
    const destination = str(info.destination);
    if (destination === null || destination === NOCTURA_FEE_TREASURY) {
      continue;
    }
    if (ix.program === 'system' && parsed?.type === 'transfer') {
      const lamports = toBaseUnits(info.lamports);
      transfer = {
        mint: 'native',
        symbol: symbolOf('native'),
        amount: lamports !== null ? formatTokenAmount(lamports, SOL_DECIMALS) : null,
        from: str(info.source),
        authority: null,
        fromTokenAccount: null,
        to: destination,
        toIsTokenAccount: false,
        toTokenAccount: null,
      };
    } else if (ix.program === 'spl-token' && (parsed?.type === 'transferChecked' || parsed?.type === 'transfer')) {
      const source = str(info.source);
      const dest = balanceOf(destination);
      const src = balanceOf(source);
      const tokenAmount =
        info.tokenAmount !== null && typeof info.tokenAmount === 'object'
          ? (info.tokenAmount as {amount?: unknown; decimals?: unknown})
          : undefined;
      const mint = str(info.mint) ?? str(dest?.mint) ?? str(src?.mint);
      const decimalsRaw = tokenAmount?.decimals ?? dest?.uiTokenAmount?.decimals ?? src?.uiTokenAmount?.decimals;
      const decimals = typeof decimalsRaw === 'number' && Number.isInteger(decimalsRaw) && decimalsRaw >= 0 ? decimalsRaw : null;
      const baseUnits = toBaseUnits(tokenAmount?.amount ?? info.amount);
      const owner = str(dest?.owner);
      transfer = {
        mint,
        symbol: mint !== null ? symbolOf(mint) : '',
        // never a raw figure: without the decimals there is no human amount
        amount: baseUnits !== null && decimals !== null ? formatTokenAmount(baseUnits, decimals) : null,
        // review r1-10: the funds' OWNER — never `info.authority`, which is a delegate in a delegated transfer.
        // With no owner in the response the sender wallet is not known: null, and the authority is shown apart.
        from: str(src?.owner),
        authority: str(info.authority) ?? str(info.multisigAuthority),
        fromTokenAccount: source,
        to: owner ?? destination,
        toIsTokenAccount: owner === null,
        toTokenAccount: destination,
      };
    }
  }

  return {
    signature,
    status: meta.err ? 'failed' : 'confirmed',
    transfer,
    feePayer: keys[0]?.address ?? '',
    signers: keys.filter(k => k.signer && k.address !== '').map(k => k.address),
    feeLamports: BigInt(meta.fee ?? 0),
    slot: tx.slot ?? 0,
    blockTime: tx.blockTime ?? null,
    memo,
  };
}

/** §5 / R9: judged against ONE address — the account whose history or #21 the detail was opened from. */
export function txDirection(detail: TxDetail, account: string | null): TxDirection {
  const t = detail.transfer;
  // review r1-2: a failed transaction moved nothing — no direction is claimed, whoever looks at it
  if (detail.status === 'failed' || account === null || t === null) {
    return 'none';
  }
  // review r1-10: `from` is the owner of the funds; it must also have signed (a delegate's move is not "sent")
  if (t.from === account && detail.signers.includes(account)) {
    return 'sent';
  }
  if ((t.to === account && !t.toIsTokenAccount) || t.toTokenAccount === account) {
    return 'received';
  }
  return 'none';
}
