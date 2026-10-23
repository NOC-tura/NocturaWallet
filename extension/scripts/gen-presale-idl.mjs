// B1c plan 2, Task 1 (committed: plan 2 review 1 M2): writes src/background/dapp/decode/presaleIdl.ts — the presale
// program's instruction table — and (B1d §2.1) src/background/presale/layouts.ts — the account layouts B1d reads — from
// the program's Anchor IDL. The IDL lives in the ICO repository (Solana-Multi-Currency-USDC_USDC_SOL-ICO-DApp,
// lib/idl.json at 75450df); the wallet repository has no copy.
//
//   node extension/scripts/gen-presale-idl.mjs <path to the ICO repository's lib/idl.json>
//
// Re-run it only when the presale program's IDL changes (a program upgrade that adds or changes an instruction or an
// account): pin the new IDL's sha256 in IDL_SHA256 and the new outputs' in OUTPUT_SHA256 and LAYOUTS_SHA256, in the same
// commit as the regenerated files. It refuses any other IDL file. CI never runs it (CI has no ICO repository):
// scripts/__tests__/gen-presale-idl.test.mjs checks, without the IDL, that both files are this script's output — each
// hashes to its pinned value, and presaleSource() / layoutsSource() rebuilt from the file's own content give it byte for
// byte.
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const OUT_PATH = join(here, '..', 'src', 'background', 'dapp', 'decode', 'presaleIdl.ts');
export const PROGRAM_ID = '6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt';
/** lib/idl.json at the ICO repository's 75450df (after the 2026-09-21 program upgrade). */
export const IDL_SHA256 = 'f31122758227e59673ad165aea75856d2ebb37be03a70d4c7e72c36c5e53c86a';
/** presaleIdl.ts as this script writes it from that IDL. */
export const OUTPUT_SHA256 = '48651d64226625871caa39d79b42028e0e129c0d8e1cac3b9dafcb4541512886';
export const LAYOUTS_PATH = join(here, '..', 'src', 'background', 'presale', 'layouts.ts');
/** layouts.ts as this script writes it from that IDL. */
export const LAYOUTS_SHA256 = '8ec812fc19ac6858c2ceaeb5893891506910d7eaad14a6864bcfb18de4b91e90';
/** The accounts B1d reads (§2.1), each with the name of its constant in layouts.ts. */
export const LAYOUT_ACCOUNTS = [
  ['Config', 'CONFIG_LAYOUT'],
  ['PresaleAllocation', 'PRESALE_ALLOCATION_LAYOUT'],
  ['UserAccount', 'USER_ACCOUNT_LAYOUT'],
];
/** Borsh sizes of the field types an account layout may hold; any other type throws. */
const FIELD_SIZES = {pubkey: 32, u8: 1, u32: 4, u64: 8, i64: 8, bool: 1};

const sha256 = b => createHash('sha256').update(b).digest('hex');

const typeOf = t => {
  if (typeof t === 'string') {
    if (!['u8', 'u64', 'i64', 'bool', 'pubkey'].includes(t)) throw new Error(`type ${t}`);
    return `'${t}'`;
  }
  if (t.array && t.array[0] === 'u8') return `{bytes: ${t.array[1]}}`;
  if (t.defined && t.defined.name === 'StakeTier') return `'tier'`;
  throw new Error(`type ${JSON.stringify(t)}`);
};

/** presaleIdl.ts's full text for a parsed IDL whose file hashes to `idlSha` (every discriminator checked against Anchor's rule). */
export function presaleSource(idl, idlSha) {
  if (idl.address !== PROGRAM_ID) throw new Error('another program');
  const rows = idl.instructions.map(ix => {
    const disc = ix.discriminator;
    const check = [...createHash('sha256').update(`global:${ix.name}`).digest().subarray(0, 8)];
    if (JSON.stringify(check) !== JSON.stringify(disc)) throw new Error(`discriminator of ${ix.name}`);
    const args = ix.args.map(a => `{name: '${a.name}', type: ${typeOf(a.type)}}`).join(', ');
    const accounts = ix.accounts.map(a => `'${a.name}'`).join(', ');
    return `  {name: '${ix.name}', discriminator: [${disc.join(', ')}], args: [${args}], accounts: [${accounts}]},`;
  });
  const tiers = idl.types.find(t => t.name === 'StakeTier').type.variants.map(v => `'${v.name}'`).join(', ');
  return `/**
 * The presale program's instructions (program ${idl.address}), generated from its Anchor IDL — never edited by hand
 * (spec B1c §3.3: "the presale program, by Anchor discriminator from the IDL"). The IDL lives in the ICO repository
 * (Solana-Multi-Currency-USDC_USDC_SOL-ICO-DApp, lib/idl.json at 75450df, sha256 ${idlSha}); the wallet repository has no
 * copy, so this table is the wallet's own. Each discriminator is sha256("global:" + name)[0..8], which
 * __tests__/presaleIdl.test.ts recomputes; the argument and account lists are the IDL's, in order.
 */
export type PresaleArgType = 'u8' | 'u64' | 'i64' | 'bool' | 'pubkey' | 'tier' | {bytes: number};
export interface PresaleInstruction {
  name: string;
  discriminator: readonly number[];
  args: readonly {name: string; type: PresaleArgType}[];
  accounts: readonly string[];
}

/** StakeTier's variants, by their Borsh index. */
export const STAKE_TIERS: readonly string[] = [${tiers}];

export const PRESALE_INSTRUCTIONS: readonly PresaleInstruction[] = [
${rows.join('\n')}
];
`;
}

/** layouts.ts's full text for a parsed IDL whose file hashes to `idlSha` (every account discriminator checked against Anchor's rule). */
export function layoutsSource(idl, idlSha) {
  if (idl.address !== PROGRAM_ID) throw new Error('another program');
  const blocks = LAYOUT_ACCOUNTS.map(([name, constant]) => {
    const account = idl.accounts.find(a => a.name === name);
    if (account === undefined) throw new Error(`no account ${name}`);
    const check = [...createHash('sha256').update(`account:${name}`).digest().subarray(0, 8)];
    if (JSON.stringify(check) !== JSON.stringify(account.discriminator)) throw new Error(`discriminator of account ${name}`);
    const struct = idl.types.find(t => t.name === name);
    if (struct === undefined || struct.type.kind !== 'struct') throw new Error(`no struct ${name}`);
    let offset = 8;
    const fields = struct.type.fields.map(f => {
      if (!/^[a-z][a-z0-9_]*$/.test(f.name)) throw new Error(`field name ${f.name}`);
      if (typeof f.type !== 'string' || !Object.hasOwn(FIELD_SIZES, f.type)) throw new Error(`type ${JSON.stringify(f.type)} of ${name}.${f.name}`);
      const row = `    ${f.name}: {offset: ${offset}, type: '${f.type}'},`;
      offset += FIELD_SIZES[f.type];
      return row;
    });
    return `export const ${constant} = {
  name: '${name}',
  discriminator: [${check.join(', ')}],
  length: ${offset},
  fields: {
${fields.join('\n')}
  },
} as const;
`;
  });
  return `/**
 * The presale program's account layouts (program ${idl.address}), generated from its Anchor IDL by
 * scripts/gen-presale-idl.mjs — never edited by hand (spec B1d §2.1: one source of truth). The IDL lives in the ICO
 * repository (lib/idl.json at 75450df, sha256 ${idlSha}). Each discriminator is sha256("account:" + name)[0..8], checked
 * against the IDL's by the generator; each field's offset is the 8-byte discriminator plus the Borsh sizes of the fields
 * before it, in the IDL's order; \`length\` is the whole account's data length.
 */
export type LayoutFieldType = 'pubkey' | 'u8' | 'u32' | 'u64' | 'i64' | 'bool';

${blocks.join('\n')}`;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const source = process.argv[2];
  if (source === undefined) throw new Error('usage: node extension/scripts/gen-presale-idl.mjs <lib/idl.json>');
  const text = readFileSync(source);
  const sha = sha256(text);
  if (sha !== IDL_SHA256) throw new Error(`not the pinned IDL: ${sha}`);
  const out = presaleSource(JSON.parse(text.toString('utf8')), sha);
  if (sha256(out) !== OUTPUT_SHA256) throw new Error(`the output is not the pinned one: ${sha256(out)}`);
  const layouts = layoutsSource(JSON.parse(text.toString('utf8')), sha);
  if (sha256(layouts) !== LAYOUTS_SHA256) throw new Error(`the layouts are not the pinned ones: ${sha256(layouts)}`);
  writeFileSync(OUT_PATH, out);
  writeFileSync(LAYOUTS_PATH, layouts);
  console.log(sha256(out), out.split('\n').filter(l => l.startsWith('  {name:')).length, sha256(layouts), LAYOUT_ACCOUNTS.length);
}
