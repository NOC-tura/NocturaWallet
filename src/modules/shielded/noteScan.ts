import {PublicKey} from '@solana/web3.js';
import {getConnection} from '../solana/connection';
import {poolPda, merkleTreePda} from './poolPdas';
import {parseDepositEvents} from './depositEvents';
import {parseNoteCiphertextEvents} from './noteCiphertextEvents';
import {tryDecryptNote} from './noteEncryption';
import {noteCommitment, mintHash} from './noteCrypto';
import {getShieldedViewSession} from './shieldedViewSession';
import {getNotes, addNote} from './noteStore';
import {decToHex64} from './fieldCodec';
import {mmkvPublic} from '../../store/mmkv/instances';

// The scan cursor (newest signature already scanned) is per-mint and lives in the
// unencrypted public MMKV — it is a Solana signature, not secret. Mirrors the
// `shielded.syncCache.<mint>` idiom in merkleSync.ts.
const CURSOR_PREFIX = 'noctura.noteScanCursor.';

// Mirror merkleSync's tx-fetch concurrency + commitment so both walk pool history
// identically.
const FETCH_CONCURRENCY = 20;

function loadCursor(mint: string): string | undefined {
  return mmkvPublic.getString(CURSOR_PREFIX + mint);
}

function saveCursor(mint: string, sig: string): void {
  mmkvPublic.set(CURSOR_PREFIX + mint, sig);
}

/**
 * Scan the pool for private transfers received by THIS wallet and store the
 * discovered notes. For each `NoteCiphertext` event, trial-decrypt with the
 * session view key; on success recompute the note commitment and confirm it
 * equals the on-chain `LeafInserted` commitment at that leaf_index (proving the
 * ciphertext is not spoofed) before storing. Deduplicates against known notes.
 *
 * Best-effort: NEVER throws to the caller (the dashboard calls this
 * fire-and-forget). A transient RPC failure stops the scan early and returns the
 * count discovered so far; the cursor only advances after a fully-processed batch,
 * so a failed scan is retried from the same position next time.
 *
 * @returns the number of NEWLY-discovered notes.
 */
export async function scanIncomingNotes(mint: string): Promise<number> {
  const session = getShieldedViewSession();
  if (!session) return 0; // locked → nothing to scan

  const connection = getConnection();
  const mintPubkey = new PublicKey(mint);
  const tree = merkleTreePda(poolPda(mintPubkey));
  const myMintHash = mintHash(mintPubkey.toBytes());

  const cursor = loadCursor(mint);

  // Collect signatures newer than the cursor (full history on first scan),
  // newest-first across pages. The newest signature overall becomes the new cursor.
  const newSigs: string[] = [];
  let newestSig: string | undefined;
  let before: string | undefined;
  try {
    for (;;) {
      const page = await connection.getSignaturesForAddress(tree, {
        before,
        until: cursor,
        limit: 1000,
      });
      if (page.length === 0) break;
      if (newestSig === undefined) newestSig = page[0]!.signature;
      for (const s of page) if (!s.err) newSigs.push(s.signature);
      before = page[page.length - 1]!.signature;
      if (page.length < 1000) break;
    }
  } catch {
    // Transient RPC failure — stop early, nothing processed yet.
    return 0;
  }

  if (newSigs.length === 0) return 0; // no new activity; leave cursor untouched

  let discovered = 0;
  try {
    for (let i = 0; i < newSigs.length; i += FETCH_CONCURRENCY) {
      const chunk = newSigs.slice(i, i + FETCH_CONCURRENCY);
      const txs = await Promise.all(
        chunk.map(sig =>
          connection.getTransaction(sig, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed',
          }),
        ),
      );
      for (const tx of txs) {
        const logs = tx?.meta?.logMessages ?? [];
        if (logs.length === 0) continue;

        // leaf_index → on-chain commitment (64-char HEX, from parseDepositEvents).
        const leafCommitments = new Map<number, string>();
        for (const ev of parseDepositEvents(logs)) {
          leafCommitments.set(ev.leafIndex, ev.commitment);
        }

        for (const entry of parseNoteCiphertextEvents(logs)) {
          const dec = tryDecryptNote(session.skView, entry.ciphertext);
          if (dec === null) continue; // not ours

          // Recompute the commitment and compare it, in HEX, to the on-chain leaf.
          // A ciphertext can decrypt to garbage; only one whose contents reproduce
          // the actual leaf commitment is a genuine note (defense-in-depth).
          const recomputedDec = noteCommitment({
            pkRecipientHash: session.pkH,
            amount: dec.amount,
            mintHash: myMintHash,
            noteSecret: dec.noteSecret,
          }).toString();
          const onChainHex = leafCommitments.get(entry.leafIndex);
          if (onChainHex === undefined) continue; // no leaf at this index
          if (decToHex64(recomputedDec) !== onChainHex) continue; // spoofed/tampered

          // Dedup: stored commitments are DECIMAL strings (see transferFlow /
          // withdrawFlow addNote). Compare like-for-like.
          const known = getNotes(mint).some(n => n.commitment === recomputedDec);
          if (known) continue;

          addNote({
            commitment: recomputedDec,
            nullifier: '',
            mint,
            amount: dec.amount,
            index: entry.leafIndex,
            spent: false,
            createdAt: Date.now(),
            noteSecret: dec.noteSecret.toString(),
          });
          discovered++;
        }
      }
    }
  } catch {
    // Transient failure mid-batch — return what we found; do NOT advance the
    // cursor, so the unscanned tail is retried next time.
    return discovered;
  }

  // Whole batch processed — advance the cursor.
  if (newestSig !== undefined) saveCursor(mint, newestSig);
  return discovered;
}
