/**
 * The M1d checkpoint desk, its pure part (spec 2026-11-08-shielded-a0-m1-design.md §16 "M1d";
 * spec 2026-11-21-shielded-m1d-accounts-design.md §6). m1d-checkpoint.mjs does the I/O.
 *
 * THE DESK NEVER HOLDS A SEED (plan A17). "Another account of the seed" is the set the app itself
 * read out at its last start (M1c's `startup-accounts` readout: the registry's addresses, the cli
 * key and slip10:0 — `seedKeys` — joined with that line's registry), collected by the M1c desk.
 * "The fresh account's history" is the signature list of the account AND of its TEST token account
 * (a stranger's dust lands on the token account). Transactions are read with
 * `getTransaction(sig, {encoding: 'json', maxSupportedTransactionVersion: 0})`: the account keys
 * are the message's static keys followed by the loaded addresses (meta.loadedAddresses), the
 * signers the first numRequiredSignatures of the static keys, and pre/postBalances follow the keys.
 * A value that was not read never passes a line.
 */
import { ataOf, RELAYER_FEE_PAYER } from '../m1c-checkpoint/chain.mjs';

/** The seed's key set from the LAST `startup-accounts` readout that carries one. */
export function seedFromReadouts(lines) {
  const all = lines.filter(l => l && l.readout && l.readout.event === 'startup-accounts');
  const withKeys = all.filter(l => Array.isArray(l.readout.seedKeys) && Array.isArray(l.readout.accounts));
  if (withKeys.length === 0) {
    return null;
  }
  const lastLine = withKeys[withKeys.length - 1];
  const last = lastLine.readout;
  const main = last.accounts.find(a => a.role === 'main');
  if (!main) {
    return null;
  }
  return { seedKeys: [...new Set([...last.seedKeys, ...last.accounts.map(a => a.address)])], main: main.address, registry: last.accounts, seenAt: lastLine.seenAt ?? null, isLatest: all[all.length - 1] === lastLine };
}

/** The signature of THE spent unshield to `fresh` the readouts name (one distinct signature), else null. */
export function freshUnshieldOf(lines, fresh) {
  const sigs = lines
    .map(l => l && l.readout)
    .filter(r => r && r.event === 'unshield-outcome' && r.status === 'spent' && r.owner === fresh)
    .map(r => r.signature);
  const distinct = [...new Set(sigs)];
  return distinct.length === 1 ? distinct[0] : null;
}

/** A `getTransaction` (json) result as keys, signers, fee payer, status and balances; null for none. */
export function txKeys(result) {
  if (!result || !result.transaction || !result.transaction.message) {
    return null;
  }
  const msg = result.transaction.message;
  const statics = msg.accountKeys.map(k => (typeof k === 'string' ? k : k.pubkey));
  const loaded = (result.meta && result.meta.loadedAddresses) || { writable: [], readonly: [] };
  const keys = [...statics, ...loaded.writable, ...loaded.readonly];
  return {
    signature: result.transaction.signatures[0],
    keys,
    signers: statics.slice(0, msg.header.numRequiredSignatures),
    feePayer: statics[0],
    ok: result.meta !== null && typeof result.meta === 'object' && result.meta.err === null,
    pre: (result.meta && result.meta.preBalances) || [],
    post: (result.meta && result.meta.postBalances) || [],
    // owners of every token account the transaction touched (json encoding): any token account of a seed key, canonical or not
    tokenOwners: [...((result.meta && result.meta.preTokenBalances) || []), ...((result.meta && result.meta.postTokenBalances) || [])].map(b => b.owner).filter(Boolean),
  };
}

/** Every §16 M1d desk line; `pass` only when every line passed. */
export function judgeM1d({ fresh, external, unshieldSig, sendSig, seed, history, txs }) {
  const lines = [];
  const line = (id, text, pass, detail) => lines.push({ id, text, pass: Boolean(pass), detail });
  const u = txKeys(txs.unshield);
  const s = txKeys(txs.send);
  const others = seed.seedKeys.filter(k => k !== fresh);
  const forbidden = new Set([...others, ...others.map(k => ataOf(k))]);

  line(
    'M1d.D0',
    'the inputs: the fresh account is a key of this seed and not its main; the recipient is outside the seed; two signatures',
    seed.seedKeys.includes(fresh) && fresh !== seed.main && !seed.seedKeys.includes(external) && unshieldSig !== sendSig,
    `fresh ${fresh} (${seed.seedKeys.includes(fresh) ? 'in' : 'NOT in'} the seed set), main ${seed.main}, recipient ${external} (${seed.seedKeys.includes(external) ? 'IN the seed set' : 'outside'})`,
  );

  const listed = [...new Set([...history.owner, ...history.ata].map(x => x.signature))].sort();
  const expected = [unshieldSig, sendSig].sort();
  line(
    'M1d.D1',
    "the fresh account's history (the account and its TEST token account) is exactly {the relayed unshield, this send}",
    listed.length === 2 && listed[0] === expected[0] && listed[1] === expected[1],
    `listed: ${listed.join(', ') || '(none)'}`,
  );

  const iu = u ? u.keys.indexOf(fresh) : -1;
  line(
    'M1d.D2',
    'the unshield: landed, signed by the relayer fee payer only, funding the fresh account from 0 lamports',
    u !== null && u.ok && u.signature === unshieldSig && u.signers.length === 1 && u.signers[0] === RELAYER_FEE_PAYER && iu >= 0 && u.pre[iu] === 0,
    u ? `signers ${u.signers.join(',')}; the fresh account ${u.pre[iu]} → ${u.post[iu]} lamports` : 'not read',
  );

  const is = s ? s.keys.indexOf(fresh) : -1;
  line(
    'M1d.D3',
    'the send: landed, the fresh account its only signer and its fee payer, the recipient (or its TEST token account) in it',
    s !== null && s.ok && s.signature === sendSig && s.signers.length === 1 && s.signers[0] === fresh && s.feePayer === fresh && (s.keys.includes(external) || s.keys.includes(ataOf(external))),
    s ? `signers ${s.signers.join(',')}; fee payer ${s.feePayer}` : 'not read',
  );

  line(
    'M1d.D4',
    'paid only from the granted SOL: at the send the fresh account held exactly what the unshield left it',
    u !== null && s !== null && iu >= 0 && is >= 0 && s.pre[is] === u.post[iu] && s.pre[is] > 0,
    u && s ? `after the unshield ${u.post[iu]}, before the send ${s.pre[is]} lamports` : 'not read',
  );

  const read = [u, s].filter(t => t !== null);
  const touching = read.flatMap(t => [
    ...t.keys.filter(k => forbidden.has(k)).map(k => `${t.signature.slice(0, 8)}…: ${k}`),
    ...t.tokenOwners.filter(o => others.includes(o)).map(o => `${t.signature.slice(0, 8)}…: a token account owned by ${o}`),
  ]);
  line(
    'M1d.D5',
    'nothing connects it to another account of this seed: no other seed key, nor a token account of one, in either transaction',
    u !== null && s !== null && touching.length === 0,
    touching.length ? touching.join('; ') : `checked ${others.length} seed keys and their token accounts`,
  );

  const mainAta = ataOf(seed.main);
  const mainHit = read.some(t => t.keys.includes(seed.main) || t.keys.includes(mainAta));
  line(
    'M1d.D6',
    'the send to the main account was cancelled, not sent: nothing in the fresh account\'s history names the main account',
    u !== null && s !== null && !mainHit && listed.length === 2,
    mainHit
      ? 'the main account (or its token account) appears'
      : listed.length !== 2
        ? `the history holds ${listed.length} transactions, so "not sent" is not shown`
        : 'the main account appears in neither transaction',
  );
  return { lines, pass: lines.every(l => l.pass) };
}
