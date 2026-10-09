import {useEffect, useRef, useState} from 'react';
import {useWallet} from '../WalletContext';
import {isAddressText} from '../send/rules';
import {isDust} from '../addressBook';
import {cleanName} from '../../shared/envelopeRules';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {Sheet} from './Sheet';
import {Banner} from './Banner';
import {ExtIcon} from './ExtIcon';
import {LockedButton} from './LockedButton';
import {SEND_TEXT} from '../screens/Send';
import {NAME_RULE} from '../screens/Switcher';
import type {Token} from '../engine';

/** The contact sheet's copy (B1b-2b §6.2): "Add contact" (→ adapted, ix:7388's aria), O72, O75–O87, and 2a's strings. */
export const CONTACT_TEXT = {
  addTitle: 'Add contact',
  editTitle: 'Edit contact',
  address: 'Address',
  name: 'Name',
  placeholder: 'Solana address',
  paste: 'Paste',
  neverSent: 'You have never sent to this address.',
  onlySentToYou: 'You have never sent to this address — it only sent to you.',
  dust: 'Tiny transfer — a common way to plant a look-alike address. Compare every character with an address you trust before saving.',
  save: 'Save',
  saveAnyway: 'Save anyway',
  cancel: 'Cancel',
  deleteContact: 'Delete contact',
  deleteQuestion: 'Delete this contact?',
  delete: 'Delete',
  keep: 'Keep',
  badName: NAME_RULE,
  duplicateName: 'Another contact already has this name.',
  badAddress: 'That is not a Solana address.',
  full: 'The address book is full (200 contacts). Delete one to add another.',
  failed: 'Something went wrong. Try again.',
} as const;

/**
 * What the sheet edits. `add` with an address: prefilled from #20 or #27 — the address read-only, in groups of four.
 * `add` with `null`: #15's `+` and "Add new contact" — the address is an input, seeded with `typed` (#15's search query
 * when it is an address; review L1) and the name with `name` (the query otherwise). `edit`: a saved contact (a #15 row,
 * or #27 when the counter-party is saved) — the address read-only; the address never changes once saved (C12).
 */
export type ContactSheetMode = {kind: 'add'; address: string | null; name?: string; typed?: string} | {kind: 'edit'; address: string; name: string};

/**
 * The contact sheet (B1b-2b §6.2; D20, C12, C18, C19; review H3): an `.s8-sheet` like #43 over #15, #20 and #27. A
 * contact is a label, never trust, so the sheet is where an address enters the book and it says what is known about it:
 * the full address in groups of four; "You have never sent to this address." (O72) for any address `wallet.recipientInfo`
 * does not call known — shown until it answers `known: true` (fail closed); from #27c's "Save sender" (`received`) the
 * line reads "…— it only sent to you." (O77), and for a transfer below C18's floor (or an amount the decoder could not
 * read) a danger banner (O78) and "Save anyway" (O79) — warned, not refused. Errors are the background's (`malformed`,
 * `duplicate-name`, `full`) or the address check's (O86). Rule 6: Save, Delete and "Delete contact" (which opens the
 * confirm; pre-flight G3) are LockedButtons. An answer that lands after the sheet closed sets nothing and calls nothing.
 * No label here is derived from `contacts.list` (the own > treasury > contact precedence is #12/#20/#27's): the sheet
 * reads only `known`, and a contact never makes an address known.
 */
export function ContactSheet({
  mode,
  received,
  onSaved,
  onDeleted,
  onClose,
}: {
  mode: ContactSheetMode;
  /** Opened from #27c [Save sender]: what the sender sent (C18 decides dust). */
  received?: {token: Token | null; amount: bigint | null};
  onSaved: (contact: {address: string; name: string}) => void;
  onDeleted?: (address: string) => void;
  onClose: () => void;
}) {
  const m = useWallet();
  const {engine, reload} = m;
  const fixed = mode.address;
  const [typed, setTyped] = useState(mode.kind === 'add' ? (mode.typed ?? '') : '');
  const [name, setName] = useState(mode.name ?? '');
  const [error, setError] = useState<{field: 'address' | 'name' | 'form'; text: string} | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [known, setKnown] = useState<boolean | null>(null);
  const [pasteRefused, setPasteRefused] = useState(false);
  const address = fixed ?? typed.trim();
  const valid = isAddressText(address);
  const account = m.account?.publicKey ?? null;
  /** False once the sheet is gone: a late answer sets nothing and calls no callback. */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // E6 for the address on the sheet, each time it is a valid one: whether this wallet ever sent there. Until it answers
  // (or when it cannot), the never-sent line shows — never a silence that reads as "known". A reply for an address the
  // field no longer holds is dropped.
  // Review M2: the confirm swaps the sheet's content under the same Sheet (its opener, for the focus on close, is kept),
  // so the focus is moved here — to Keep on entering it, back to "Delete contact" on Keep — never left on `body`, from
  // where Tab would reach the screen behind the modal.
  // "Delete contact" is a LockedButton (pre-flight G3), which takes no ref: its wrapper (`display: contents`) is held.
  const keepRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLDivElement>(null);
  const confirmedOnce = useRef(false);
  useEffect(() => {
    if (confirming) {
      confirmedOnce.current = true;
      keepRef.current?.focus();
    } else if (confirmedOnce.current) deleteRef.current?.querySelector('button')?.focus();
  }, [confirming]);

  const generation = useRef(0);
  useEffect(() => {
    const mine = ++generation.current;
    setKnown(null);
    if (!valid || account === null) return;
    void engine.recipientInfo(account, address).then(r => {
      if (!alive.current || generation.current !== mine) return;
      if (r.ok) setKnown(r.data.known);
      else if (r.error === 'locked') void reload();
    });
  }, [valid, address, account, engine, reload]);

  const fromSender = received !== undefined && known !== true;
  const dust = fromSender && isDust(received.token, received.amount);

  const save = async () => {
    setError(null);
    if (!valid) return setError({field: 'address', text: CONTACT_TEXT.badAddress});
    if (cleanName(name) === null) return setError({field: 'name', text: CONTACT_TEXT.badName});
    const r = await engine.contactSet(address, name);
    if (!alive.current) return;
    if (r.ok) return onSaved({address, name: cleanName(name) ?? name});
    if (r.error === 'locked') return void reload();
    if (r.error === 'duplicate-name') return setError({field: 'name', text: CONTACT_TEXT.duplicateName});
    if (r.error === 'malformed') return setError({field: 'name', text: CONTACT_TEXT.badName});
    if (r.error === 'full') return setError({field: 'form', text: CONTACT_TEXT.full});
    setError({field: 'form', text: CONTACT_TEXT.failed});
  };

  const remove = async () => {
    if (mode.kind !== 'edit') return;
    setError(null);
    const r = await engine.contactRemove(mode.address);
    if (!alive.current) return;
    if (r.ok) {
      onDeleted?.(mode.address);
      return onClose();
    }
    if (r.error === 'locked') return void reload();
    setError({field: 'form', text: CONTACT_TEXT.failed});
  };

  const paste = async () => {
    setPasteRefused(false);
    try {
      const text = await navigator.clipboard.readText();
      if (alive.current) setTyped(text.trim());
    } catch {
      if (alive.current) setPasteRefused(true);
    }
  };

  const message = (field: 'address' | 'name' | 'form') =>
    error?.field === field ? (
      <p className="field-msg noc-danger" role="alert">
        {error.text}
      </p>
    ) : null;

  if (confirming && mode.kind === 'edit') {
    return (
      <Sheet title={CONTACT_TEXT.editTitle} onClose={onClose} tall>
        <div className="app-contact-sheet">
          <p className="noc-body app-contact-question">{CONTACT_TEXT.deleteQuestion}</p>
          <p className="noc-body-lg app-contact-name">{mode.name}</p>
          <div className="app-contact-addr">
            <AddressGroups address={mode.address} />
          </div>
          {message('form')}
          <div className="app-contact-actions">
            <button type="button" className="btn btn-secondary" ref={keepRef} onClick={() => setConfirming(false)}>
              {CONTACT_TEXT.keep}
            </button>
            <LockedButton className="btn btn-destructive" onPress={remove}>
              {CONTACT_TEXT.delete}
            </LockedButton>
          </div>
        </div>
      </Sheet>
    );
  }

  const warning = !valid || known === true ? null : (
    <p className="noc-caption noc-warning app-contact-warn">{fromSender ? CONTACT_TEXT.onlySentToYou : CONTACT_TEXT.neverSent}</p>
  );
  const invalidTyped = fixed === null && address !== '' && !valid;

  return (
    <Sheet title={mode.kind === 'edit' ? CONTACT_TEXT.editTitle : CONTACT_TEXT.addTitle} onClose={onClose} tall>
      <div className="app-contact-sheet">
        {fixed === null ? (
          <>
            <label className="noc-overline app-sheet-label" htmlFor="contact-address">
              {CONTACT_TEXT.address}
            </label>
            <div className="app-contact-field">
              <input
                id="contact-address"
                className={`app-input noc-mono${invalidTyped ? ' is-error' : ''}`}
                placeholder={CONTACT_TEXT.placeholder}
                autoComplete="off"
                spellCheck={false}
                value={typed}
                data-autofocus=""
                onChange={e => {
                  setTyped(e.target.value);
                  setPasteRefused(false);
                  if (error?.field === 'address') setError(null);
                }}
              />
              {typed === '' ? (
                <button type="button" className="icon-btn" aria-label={CONTACT_TEXT.paste} onClick={() => void paste()}>
                  <ExtIcon name="clip" size={18} />
                </button>
              ) : null}
            </div>
            {invalidTyped && error?.field !== 'address' ? (
              <p className="field-msg noc-danger" role="alert">
                {CONTACT_TEXT.badAddress}
              </p>
            ) : null}
            {message('address')}
            {pasteRefused && typed === '' ? <p className="noc-caption noc-warning">{SEND_TEXT.pasteRefused}</p> : null}
            {valid ? (
              <div className="app-contact-addr">
                <AddressGroups address={address} />
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="noc-overline app-sheet-label" id="contact-address-label">
              {CONTACT_TEXT.address}
            </div>
            <div className="app-contact-addr" aria-labelledby="contact-address-label">
              <AddressGroups address={fixed} />
            </div>
          </>
        )}
        {warning}
        {dust && valid ? <Banner tone="danger" title={CONTACT_TEXT.dust} /> : null}
        <label className="noc-overline app-sheet-label" htmlFor="contact-name">
          {CONTACT_TEXT.name}
        </label>
        <input
          id="contact-name"
          className={`app-input${error?.field === 'name' ? ' is-error' : ''}`}
          maxLength={32}
          autoComplete="off"
          value={name}
          {...(fixed === null ? {} : {'data-autofocus': ''})}
          onChange={e => {
            setName(e.target.value);
            if (error?.field === 'name') setError(null);
          }}
        />
        {message('name')}
        {message('form')}
        {/* Cancel and Save side by side (the design's `.sticky-bar.row`): stacked, the dust state ran past the panel. */}
        <div className="app-contact-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {CONTACT_TEXT.cancel}
          </button>
          <LockedButton className="btn btn-primary" disabled={!valid} onPress={save}>
            {dust ? CONTACT_TEXT.saveAnyway : CONTACT_TEXT.save}
          </LockedButton>
        </div>
        {mode.kind === 'edit' ? (
          <div className="app-contact-delete" ref={deleteRef}>
            <LockedButton className="btn btn-tertiary noc-danger" onPress={() => setConfirming(true)}>
              {CONTACT_TEXT.deleteContact}
            </LockedButton>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
