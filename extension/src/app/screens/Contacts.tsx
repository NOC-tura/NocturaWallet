import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {useWallet} from '../WalletContext';
import {useNow} from '../useNow';
import {shortAddress} from '../format';
import {avatarOf, clampName, initialOf, isAddressShaped, markParts, resultsLine, searchContacts, whenText} from '../addressBook';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {ExtIcon} from '../ui/ExtIcon';
import {LockedButton} from '../ui/LockedButton';
import {CONTACT_TEXT, ContactSheet, type ContactSheetMode} from '../ui/ContactSheet';
import {MAINNET_FEE_TREASURY} from '../../../../core/fees/transferMarkup';
import type {Contact, ContactList} from '../engine';

/**
 * #15's copy (B1b-2b §6.1): the design's strings, adapted where marked there, O71–O74 and 2a's "Try again". "Add contact"
 * and O72 have one home, the contact sheet's CONTACT_TEXT (pre-flight R9): reused here, never written twice.
 */
export const CONTACTS_TEXT = {
  title: 'Address book',
  add: CONTACT_TEXT.addTitle,
  search: 'Search contacts',
  clear: 'Clear search',
  emptyTitle: 'No saved contacts yet',
  emptyBody: 'Save aliases for the wallets you send to most often. Each one shows up here with the truncated address and last-sent date.',
  addFirst: 'Add first contact',
  /** ix:7456 → adapted: the screen number is not user copy. */
  emptyHint: "Or save one from a transaction's details.",
  noMore: 'No more matches.',
  addNew: (q: string): string => `Add new contact "${q}" →`,
  noMatch: (q: string): string => `No contacts match "${q}".`,
  neverSent: CONTACT_TEXT.neverSent,
  /** 2a's labels (#12, #20, #27): the precedence own > treasury > contact (E17; Task 2 carry). */
  own: (name: string): string => `Your account: ${name}`,
  treasury: 'Noctura treasury',
  full: 'The address book is full (200 contacts).',
  loadFailed: 'Could not load your contacts. Try again.',
  tryAgain: 'Try again',
} as const;

/** The name with the query's first match in `<mark>` (ix:7483). */
function Name({name, query}: {name: string; query: string}): ReactNode {
  const parts = markParts(name, query);
  if (parts === null) return name;
  return (
    <>
      {parts[0]}
      <mark>{parts[1]}</mark>
      {parts[2]}
    </>
  );
}

/**
 * #15 address book (spec B1b-2b §6.1; D18, D21, C12; review H3). Standalone (from #31): the drawn rows — avatar, name,
 * "first 4 … last 4", when — and a row tap opens the edit sheet (D21). `pick` (from #12's contact icon): the pick is a
 * check, not a shortcut — every row shows the FULL address in groups of four, and a contact this wallet never sent to
 * says O72 (the never-sent line) in place of the date; a row tap hands the address back to #12,
 * which treats it exactly as a paste (App's reset, review M4); a contact saved here is picked at once. Search by name or
 * address; `full` (200) disables every add; `load failed` offers Try again. The list is local: no pull-to-refresh.
 * Rule 6: the `+` and every add button are LockedButtons. An answer that lands after the screen went is dropped.
 */
export function Contacts({pick, onBack, onPick}: {pick: boolean; onBack: () => void; onPick: (address: string) => void}) {
  const m = useWallet();
  const {engine, reload} = m;
  const now = useNow(30_000, m.now);
  const [list, setList] = useState<ContactList | 'failed' | null>(null);
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState<ContactSheetMode | null>(null);
  /** Only the newest read counts, and none after the screen went. */
  const reads = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const n = ++reads.current;
    const r = await engine.contacts();
    if (!alive.current || n !== reads.current) return;
    if (r.ok) {
      // Fix round 1, M3: a book that became empty shows the empty state's search — empty and disabled, no stale query.
      if (r.data.contacts.length === 0) setQuery('');
      return setList(r.data);
    }
    if (r.error === 'locked') return void reload();
    setList('failed');
  }, [engine, reload]);
  useEffect(() => {
    void load();
  }, [load]);

  const top = (canAdd: boolean) => (
    <div className="top-bar">
      <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
        <ExtIcon name="back" size={22} />
      </button>
      <div className="title noc-h1">{CONTACTS_TEXT.title}</div>
      <LockedButton className="icon-btn app-abook-add" label={CONTACTS_TEXT.add} disabled={!canAdd} onPress={() => setSheet({kind: 'add', address: null})}>
        <ExtIcon name="plus" size={22} />
      </LockedButton>
    </div>
  );

  if (list === null) {
    return (
      <div className="screen s-abook" aria-busy="true">
        {top(false)}
      </div>
    );
  }
  if (list === 'failed') {
    return (
      <div className="screen s-abook">
        {top(false)}
        <div className="scroll">
          <p className="noc-body app-muted app-abook-failed">{CONTACTS_TEXT.loadFailed}</p>
          <LockedButton className="btn btn-secondary" onPress={load}>
            {CONTACTS_TEXT.tryAgain}
          </LockedButton>
        </div>
      </div>
    );
  }

  const full = list.contacts.length >= list.max;
  const empty = list.contacts.length === 0;
  const q = query.trim();
  const shown = searchContacts(list.contacts, q);
  // Review L1: a query that is an address seeds the address field (the name stays empty); any other query is the name.
  // Final code review L2: "an address" is the search's own test (an address-shaped near-miss lands in the address
  // field, where it reads invalid), and the name is cut to what a name may be (C19).
  const addNew = () => setSheet(isAddressShaped(q) ? {kind: 'add', address: null, typed: q} : {kind: 'add', address: null, name: clampName(q)});
  /** Final review I1: a query that IS a saved address (exactly) is that contact, shown as its row — never offered as an add. */
  const saved = list.contacts.some(c => c.address === q);
  /**
   * A pick row's label in the date's place, by the precedence own > treasury > contact (E17; Task 2 carry): a saved
   * address that is one of this wallet's accounts says "Your account: <name>" (2a's; review L5), the fee treasury "Noctura
   * treasury" — both exact matches, never the contact's name. Only for a `known` address: a label never replaces or
   * hides O72 (§6.3, D36; fix round 1, I1). Otherwise null: the row says when.
   */
  const labelOf = (address: string): string | null => {
    const own = m.wallet?.accounts.find(a => a.publicKey === address);
    if (own !== undefined) return CONTACTS_TEXT.own(own.name);
    return address === MAINNET_FEE_TREASURY ? CONTACTS_TEXT.treasury : null;
  };
  /**
   * When, for a known contact (fix round 1, M4): "never" means only "not known". A known address whose last send has no
   * time (an own account, or a B1b-1 entry stored without one) shows no date text rather than "never".
   */
  const when = (c: Contact): string => (!c.known ? 'never' : c.lastSentAt === null ? '' : whenText(c.lastSentAt, now));
  const row = (c: Contact) =>
    pick ? (
      <button type="button" key={c.address} className="row app-abook-pick" onClick={() => onPick(c.address)}>
        <span className={`ava ${avatarOf(c.address)}`} aria-hidden="true">
          {initialOf(c.name)}
        </span>
        <span className="meta">
          <span className="name noc-body-lg">
            <Name name={c.name} query={q} />
          </span>
          <span className="addr noc-body-sm noc-mono">
            <AddressGroups address={c.address} />
          </span>
        </span>
        {!c.known ? (
          <span className="when noc-caption noc-warning">{CONTACTS_TEXT.neverSent}</span>
        ) : (
          <span className="when noc-body-sm">{labelOf(c.address) ?? when(c)}</span>
        )}
      </button>
    ) : (
      <button type="button" key={c.address} className="row" onClick={() => setSheet({kind: 'edit', address: c.address, name: c.name})}>
        <span className={`ava ${avatarOf(c.address)}`} aria-hidden="true">
          {initialOf(c.name)}
        </span>
        <span className="meta">
          <span className="name noc-body-lg">
            <Name name={c.name} query={q} />
          </span>
          <span className="addr noc-body-sm noc-mono">{shortAddress(c.address)}</span>
        </span>
        <span className="when noc-body-sm">{when(c)}</span>
      </button>
    );

  let body: ReactNode;
  if (empty) {
    body = (
      <div className="empty">
        <div className="ic">
          <ExtIcon name="users" size={32} />
        </div>
        <h3 className="noc-h3">{CONTACTS_TEXT.emptyTitle}</h3>
        <p className="noc-body-sm">{CONTACTS_TEXT.emptyBody}</p>
        <LockedButton className="btn btn-primary app-abook-first" disabled={full} onPress={() => setSheet({kind: 'add', address: null})}>
          <ExtIcon name="plus" size={18} />
          &nbsp;{CONTACTS_TEXT.addFirst}
        </LockedButton>
        <span className="noc-caption app-dim">{CONTACTS_TEXT.emptyHint}</span>
      </div>
    );
  } else {
    body = (
      <div className="scroll app-abook-list">
        {full ? <p className="noc-caption app-warning app-abook-full">{CONTACTS_TEXT.full}</p> : null}
        {q === '' ? null : shown.length > 0 ? <div className={`noc-overline app-abook-count${isAddressShaped(q) ? ' app-abook-count-addr' : ''}`}>{resultsLine(shown.length, q)}</div> : null}
        {shown.map(row)}
        {q === '' ? null : (
          <div className="app-abook-foot">
            <div className="noc-body-sm">{shown.length > 0 ? CONTACTS_TEXT.noMore : CONTACTS_TEXT.noMatch(q)}</div>
            {saved ? null : (
              <LockedButton className="btn btn-tertiary" disabled={full} onPress={addNew}>
                {CONTACTS_TEXT.addNew(q)}
              </LockedButton>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="screen s-abook">
        {top(!full)}
        <div className="search">
          <span className="ic">
            <ExtIcon name="search" size={18} />
          </span>
          <input type="text" placeholder={CONTACTS_TEXT.search} aria-label={CONTACTS_TEXT.search} autoComplete="off" spellCheck={false} disabled={empty} value={query} onChange={e => setQuery(e.target.value)} />
          {query === '' ? null : (
            <button type="button" className="clear" aria-label={CONTACTS_TEXT.clear} onClick={() => setQuery('')}>
              <ExtIcon name="close" size={14} />
            </button>
          )}
        </div>
        {body}
      </div>
      {/* Beside `.s-abook`, not inside: `.s-abook .row` would style the sheet's rows (as #43 beside #12). */}
      {sheet === null ? null : (
        <ContactSheet
          mode={sheet}
          book={list.contacts}
          onClose={() => setSheet(null)}
          onSaved={(c, kind) => {
            setSheet(null);
            // A contact added from #12's pick is the one the user wanted: picked at once (§6.1). An add sheet that became a
            // saved contact's edit sheet (final review I1) saved an edit: it is not picked; the list is read again.
            if (pick && kind === 'add') return onPick(c.address);
            void load();
          }}
          onDeleted={() => void load()}
        />
      )}
    </>
  );
}
