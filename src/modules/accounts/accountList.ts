/**
 * M1d spec §3.1 (M1 spec §10): the accounts of this wallet the app shows — the registry's `main`
 * entry and every `fresh-exit`, read WITHOUT the seed (`loadA0AccountRegistry`, the stored
 * addresses). A `fresh-pending` reservation is never listed, but it is in `seed` (every address of
 * this seed the registry knows), which the linking warning reads (plan A2).
 *
 * Fail closed: any registry read failure, and a registry whose main is not this wallet's (plan A3),
 * lists the main account only with `unreadable: true` — never an empty list, never another
 * wallet's accounts. Pure: the registry read is handed in.
 */
import {schemeToString} from '../keyDerivation/transparent';
import type {TransparentScheme} from '../keyDerivation/transparent';
import {parseA0Scheme} from '../shielded/a0/accountRegistry';
import type {A0AccountEntry, A0AccountRole} from '../shielded/a0/accountRegistry';

export interface WalletAccount {
  /** `slip10:n` | `cli` */
  scheme: string;
  /** base58; for the main account, walletStore.publicKey */
  address: string;
  /** "Account N+1" */
  label: string;
  /** N+1 — the avatar shows it */
  number: number;
  role: 'main' | 'fresh-exit';
  isMain: boolean;
  /** a fresh exit a key of this seed signed (M1c Task 7): the sheet tags it "linked" */
  linked: boolean;
}

export interface SeedAccount {
  address: string;
  role: A0AccountRole;
}

export interface AccountList {
  /** the main account first, then every fresh-exit by ascending index */
  accounts: readonly WalletAccount[];
  /** every address of this seed the registry knows (fresh-pending included) — for the linking warning */
  seed: readonly SeedAccount[];
  walletKind: 'slip10' | 'cli';
  /** the registry could not be read (or is not this wallet's): main only, and the sheet says so */
  unreadable: boolean;
}

export function accountNumber(scheme: TransparentScheme): number {
  return scheme.kind === 'cli' ? 1 : scheme.account + 1;
}

/** The extension's rule (`addAccount` names it `Account ${index + 1}`): slip10:N → "Account N+1", cli → "Account 1". */
export function accountLabel(scheme: TransparentScheme): string {
  return `Account ${accountNumber(scheme)}`;
}

/** first 6 … last 6 (screen.md §0, the checksum convention) */
export function shortAccountAddress(address: string): string {
  return address.length <= 13 ? address : `${address.slice(0, 6)}…${address.slice(-6)}`;
}

export function buildAccountList(
  mainAddress: string,
  mainScheme: TransparentScheme,
  readRegistry: () => readonly A0AccountEntry[] | null,
): AccountList {
  const main: WalletAccount = {
    scheme: schemeToString(mainScheme),
    address: mainAddress,
    label: accountLabel(mainScheme),
    number: accountNumber(mainScheme),
    role: 'main',
    isMain: true,
    linked: false,
  };
  const walletKind = mainScheme.kind;
  const mainOnly = (unreadable: boolean): AccountList => ({
    accounts: [main],
    seed: [{address: mainAddress, role: 'main'}],
    walletKind,
    unreadable,
  });
  let entries: readonly A0AccountEntry[] | null;
  try {
    entries = readRegistry();
  } catch {
    return mainOnly(true);
  }
  if (entries === null) {
    return mainOnly(false);
  }
  const registryMain = entries.find(x => x.role === 'main');
  if (!registryMain || registryMain.scheme !== main.scheme || registryMain.address !== mainAddress) {
    return mainOnly(true);
  }
  const exits: {index: number; account: WalletAccount}[] = [];
  for (const x of entries) {
    if (x.role !== 'fresh-exit') {
      continue;
    }
    const s = parseA0Scheme(x.scheme);
    if (s === null || s.kind !== 'slip10') {
      continue;
    }
    exits.push({
      index: s.account,
      account: {
        scheme: x.scheme,
        address: x.address,
        label: accountLabel(s),
        number: accountNumber(s),
        role: 'fresh-exit',
        isMain: false,
        linked: x.linked === true,
      },
    });
  }
  exits.sort((a, b) => a.index - b.index);
  return {
    accounts: [main, ...exits.map(x => x.account)],
    seed: entries.map(x => ({address: x.address, role: x.role})),
    walletKind,
    unreadable: false,
  };
}
