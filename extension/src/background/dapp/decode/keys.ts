import {base58} from '@scure/base';
import type {ParsedTx} from './wire';

/**
 * Address lookup tables (spec B1c §3.3, B1 §3): a v0 message names some of its accounts by (table, index); they are
 * resolved from the tables' own accounts, read through the proxy (`getMultipleAccounts`). A table that cannot be read,
 * is not owned by the lookup-table program, is malformed, or does not hold the index leaves that account unresolved
 * (null) — and every instruction that touches an unresolved account is shown as an unknown program (decode.ts).
 */
export const ADDRESS_LOOKUP_TABLE_PROGRAM = 'AddressLookupTab1e1111111111111111111111111';
/** The table account's fixed header (LookupTableMeta, 56 bytes); the addresses follow, 32 bytes each. */
const META_BYTES = 56;

/** A table's addresses from its account (owner checked by the caller), or null when the bytes are not a lookup table. */
export function tableAddresses(data: Uint8Array): string[] | null {
  if (data.length < META_BYTES || (data.length - META_BYTES) % 32 !== 0) return null;
  // ProgramState::LookupTable is variant 1 (u32 LE); 0 is an uninitialized account.
  if (new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(0, true) !== 1) return null;
  const out: string[] = [];
  for (let at = META_BYTES; at < data.length; at += 32) out.push(base58.encode(data.subarray(at, at + 32)));
  return out;
}

/** Every account index of the message, resolved: the static keys, then each lookup's writable, then each lookup's readonly (the runtime's order). */
export interface ResolvedKeys {
  keys: (string | null)[];
}

/** `tables`: each table's addresses as read now, or null when it could not be read or is not a lookup table. */
export function resolveKeys(p: ParsedTx, tables: ReadonlyMap<string, readonly string[] | null>): ResolvedKeys {
  const at = (table: string, i: number): string | null => tables.get(table)?.[i] ?? null;
  const writable = p.lookups.flatMap(l => l.writable.map(i => at(l.table, i)));
  const readonly = p.lookups.flatMap(l => l.readonly.map(i => at(l.table, i)));
  return {keys: [...p.staticKeys, ...writable, ...readonly]};
}

/** The tables a message needs (none for a legacy message). */
export const tablesOf = (p: ParsedTx): string[] => [...new Set(p.lookups.map(l => l.table))];
