import {useEffect, useRef, useState} from 'react';
import {useWallet, PENDING_POLL_MS} from '../WalletContext';
import {showUsd} from '../format';
import {showExact, showLamports, usdOf, type Draft} from '../send/rules';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {ExtIcon} from '../ui/ExtIcon';
import {LockedButton} from '../ui/LockedButton';
import {useCopy} from '../ui/useCopy';
import {useCloseTab} from '../ui/useCloseTab';
import {useEscape} from '../ui/useEscape';
import {useNow} from '../useNow';
import {Stuck, STUCK_TEXT} from './Stuck';
import {Failed} from './Failed';
import {feePaidLamports, type Intent, type Pending, type PendingState} from '../engine';

/** The fixed strings #21 shows (spec §4.6); adapted ones are marked there. */
export const STATUS_TEXT = {
  sending: 'Sending…',
  broadcasting: 'Broadcasting transaction…',
  submitted: 'Submitted to Solana mainnet · waiting for first confirmation',
  statusBroadcasting: 'Broadcasting',
  canClose: 'You can close this window — Noctura keeps watching this transaction.',
  ifFails: 'If this fails, your funds stay in your wallet — no fees are charged until the network accepts the transaction.',
  waiting: 'Waiting for confirmation',
  slow: 'SLOW',
  slowLabel: 'Taking longer than usual',
  slowSub: "The network hasn't included it in a block yet.",
  recoveryIn: 'Recovery options will appear in',
  sent: 'Sent',
  confirmed: 'CONFIRMED',
  sentOk: 'Sent successfully',
  details: 'View details',
  done: 'Done',
  doneTab: 'Done — open the Noctura icon any time.',
  closeTab: 'Close this tab',
  checking: 'Checking whether it was sent…',
  unsure: 'We could not confirm whether it was sent. Check Activity before trying again.',
  openActivity: 'Open Activity',
} as const;

/** The design's bold lead of the reassurance line (index.html #s21, in --fg-secondary). */
const IF_FAILS_LEAD = 'If this fails, your funds stay in your wallet';

/** #21 shows its stuck warning from 80 s, and #54 from 90 s or when the engine says `stuck` (spec §4.6). */
export const SLOW_AFTER_MS = 80_000;
export const STUCK_AFTER_MS = 90_000;

const OPEN: readonly PendingState[] = ['pending', 'stuck'];

function CopyIcon({value, label}: {value: string; label: string}) {
  const [state, copy] = useCopy();
  return (
    <button type="button" className="copy" aria-label={state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label} onClick={() => copy(value)}>
      <ExtIcon name={state === 'copied' ? 'check' : state === 'failed' ? 'close' : 'copy'} size={14} />
    </button>
  );
}

/** The design's invisible copy cell, so a row without a copy lines its value up with the rows that have one. */
const NoCopy = () => <span className="copy app-ghost" aria-hidden="true" />;

interface Props {
  account: string;
  id: string | null;
  since: number;
  onDone: () => void;
  onDetails: (signature: string) => void;
  onActivity: () => void;
  onTryAgain: (intent: Intent) => void;
  onEdit: (draft: Draft) => void;
}

/**
 * #21 tx-status (spec §4.6), and the screen #54 and #44 grow out of. Each send it follows — this account, this id,
 * this tap — is its own mount: when one of them changes, the old one unmounts (its reads are dropped) and a fresh one
 * starts from "Checking…". Another account selected is NOT a new mount (fix round 1): the screen keeps what it has
 * seen — #54 shown, the confirmation seen live, a settled record — and only drops the reads that were out.
 */
export function Status(props: Props) {
  return <Tracked key={`${props.account}|${props.id ?? ''}|${props.since}`} {...props} />;
}

/**
 * With no id (a lost answer), how long after the screen opens a record may still be adopted: the reads stop after it,
 * and a record made after it is never this send (fix round 1).
 */
export const LOOKUP_MS = 10_000;

interface Seen {
  /** A wallet.pending answer has been applied. */
  read: boolean;
  /** The id followed: the one handed in, or the one found from the tap on (no id: a lost answer). */
  tracked: string | null;
  record: Pending | null;
}

/**
 * The pending record from wallet.send (or #20's lookup), re-read every 2 s from wallet.pending and matched by id,
 * only while this screen is shown. With no id (a send whose answer was lost), it looks for this account's record
 * created at or after the tap — never "nothing sent": without one it sends the user to Activity. After every await
 * the read checks it is still its generation's (unmount, a settled record) and not older than one already applied;
 * once a record is settled (confirmed, failed, expired) the reads stop, so no later answer moves the screen.
 */
function Tracked({account, id, since, onDone, onDetails, onActivity, onTryAgain, onEdit}: Props) {
  const m = useWallet();
  const {engine, now: clock, platform, surface} = m;
  const now = useNow(1_000, clock);
  const tab = useCloseTab(platform);
  const [seen, setSeen] = useState<Seen>({read: false, tracked: id, record: null});
  /** When this screen saw the record confirm, having seen it open first: "Confirmed in N s" only for what it saw live. */
  const [confirmedAt, setConfirmedAt] = useState<number | null>(null);
  /** #54 once shown stays #54: an expiry then is its expired layout, not #44's — decided by what was shown. */
  const [stuckShown, setStuckShown] = useState(false);
  /** A settled record (confirmed, failed, expired) is on screen: no more reads, and none still out lands. */
  const settled = useRef(false);
  const sawOpen = useRef(false);
  const trackedRef = useRef<string | null>(id);
  const gen = useRef(0);
  /** A wallet.pending read failed before any answered: the check-pending line, and a way out (fix round 1). */
  const [readFailed, setReadFailed] = useState(false);
  const openedAt = useRef(clock());
  // Another account selected: the reads restart in a new generation (one still out is dropped); what was seen stays.
  const selected = m.account?.publicKey ?? null;

  useEffect(() => {
    if (settled.current) return;
    const g = gen.current;
    let asked = 0;
    let applied = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    const poll = async () => {
      asked += 1;
      const mine = asked;
      const r = await engine.pending();
      if (gen.current !== g || mine < applied) return;
      if (!r.ok) {
        setReadFailed(true);
        return;
      }
      applied = mine;
      let t = trackedRef.current;
      const looking = t === null;
      if (t === null && clock() - openedAt.current <= LOOKUP_MS) {
        const found = r.data.find(p => p.account === account && p.createdAt >= since && p.createdAt <= openedAt.current + LOOKUP_MS);
        if (found !== undefined) {
          t = found.id;
          trackedRef.current = t;
        }
      }
      const rec = t === null ? null : (r.data.find(p => p.id === t) ?? null);
      if (rec !== null && OPEN.includes(rec.state)) sawOpen.current = true;
      if (rec !== null && rec.state === 'confirmed' && sawOpen.current) setConfirmedAt(c => c ?? clock());
      setSeen({read: true, tracked: t, record: rec});
      // Settled: stop here, in this answer — not on the next render — so nothing more is asked and no read still out
      // (an older one) can land.
      // No record from the tap on within LOOKUP_MS: the check-pending line stays and nothing later is adopted.
      const gaveUp = looking && t === null && clock() - openedAt.current >= LOOKUP_MS;
      if ((rec !== null && !OPEN.includes(rec.state)) || gaveUp) {
        settled.current = true;
        gen.current += 1;
        clearInterval(timer);
      }
    };
    void poll();
    timer = setInterval(() => void poll(), PENDING_POLL_MS);
    return () => {
      gen.current += 1;
      clearInterval(timer);
    };
  }, [engine, account, since, clock, selected]);

  const record = seen.record;
  const success = record?.state === 'confirmed';
  const toFailed = record !== null && (record.state === 'failed' || (record.state === 'expired' && !stuckShown));
  const toStuck = record !== null && !toFailed && !success && (record.state === 'expired' || record.state === 'stuck' || stuckShown || now - record.createdAt >= STUCK_AFTER_MS);
  useEffect(() => {
    if (toStuck) setStuckShown(true);
  }, [toStuck]);
  useEscape(onDone, success);

  if (record !== null && toFailed) return <Failed record={record} onTryAgain={onTryAgain} onEdit={onEdit} onDetails={onDetails} />;
  if (record !== null && toStuck) return <Stuck record={record} now={now} onClose={onDone} onActivity={onActivity} onTryAgain={onTryAgain} />;

  if (record === null) {
    // A failed read before any answered: the outcome is not known, so the check-pending line and a way out.
    const unsure = (seen.read && seen.tracked === null) || (!seen.read && readFailed);
    const untracked = seen.read && seen.tracked !== null;
    return (
      <div className="screen s-stat">
        <div className="top-bar">
          <button type="button" className="icon-btn" aria-label="Close" disabled={!seen.read && !readFailed} onClick={onDone}>
            <ExtIcon name="close" size={22} />
          </button>
          <div className="title noc-h1">{STATUS_TEXT.sending}</div>
        </div>
        <div className="scroll">
          <div className="hero">
            <p className="stage-sub" role="status">
              {unsure ? STATUS_TEXT.unsure : untracked ? STUCK_TEXT.untracked : STATUS_TEXT.checking}
            </p>
          </div>
        </div>
        {unsure || untracked ? (
          <div className="sticky-bar">
            <button type="button" className="btn btn-primary" onClick={onActivity}>
              {STATUS_TEXT.openActivity}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const token = record.intent.token;
  const usd = usdOf(token, record.intent.amount, m.prices);
  // The fiat line: --fg-secondary on success and slow, --fg-tertiary while broadcasting (index.html #s21).
  const amountCard = (big: boolean, dim: boolean) => (
    <div className="amount-card">
      <span className="eyebrow">Amount</span>
      <div className="amount-line">
        <span className={`amount noc-numeral${big ? ' noc-balance-lg app-amount-big' : ''}`}>{showExact(token, record.intent.amount)}</span>
        <span className="ticker">{token}</span>
      </div>
      {usd === null ? null : <span className={`noc-caption noc-numeral ${dim ? 'app-dim' : 'app-secondary'}`}>≈ {showUsd(usd)} USD</span>}
    </div>
  );
  const toRow = (
    <div className="meta-row">
      <span className="lbl">To</span>
      <span className="val mono noc-mono">
        <AddressGroups address={record.intent.recipient} />
      </span>
      <CopyIcon value={record.intent.recipient} label="Copy recipient" />
    </div>
  );
  const hashRow = (
    <div className="meta-row">
      <span className="lbl">Tx hash</span>
      <span className="val mono noc-mono">{record.signature}</span>
      <CopyIcon value={record.signature} label="Copy transaction hash" />
    </div>
  );

  if (success) {
    // What was paid, by the record's state and split fee (feePaidLamports: network + Noctura fee once confirmed).
    const fee = feePaidLamports(record);
    return (
      <div className="screen s-stat">
        <div className="top-bar">
          <button type="button" className="icon-btn" aria-label="Close" onClick={onDone}>
            <ExtIcon name="close" size={22} />
          </button>
          <div className="title noc-h1">{STATUS_TEXT.sent}</div>
          <span className="step noc-overline app-success">{STATUS_TEXT.confirmed}</span>
        </div>
        <div className="scroll">
          <div className="hero">
            <div className="ring success">
              <ExtIcon name="check" size={56} />
            </div>
            <div className="stage-label app-success">{STATUS_TEXT.sentOk}</div>
            {confirmedAt === null ? null : <div className="stage-sub">Confirmed in {Math.max(1, Math.round((confirmedAt - record.createdAt) / 1000))} s</div>}
            {amountCard(true, false)}
            <div className="meta-grid">
              {toRow}
              {hashRow}
              {fee === null ? null : (
                <div className="meta-row">
                  <span className="lbl">Fee paid</span>
                  <span className="val noc-numeral">{showLamports(fee)} SOL</span>
                  <NoCopy />
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="sticky-bar row">
          <button type="button" className="btn btn-secondary" onClick={() => onDetails(record.signature)}>
            <ExtIcon name="doc" size={18} />
            {STATUS_TEXT.details}
          </button>
          {surface === 'popup' ? (
            <button type="button" className="btn btn-primary" onClick={onDone}>
              <ExtIcon name="check" size={18} />
              {STATUS_TEXT.done}
            </button>
          ) : tab.refused ? null : (
            <LockedButton className="btn btn-primary" onPress={tab.close}>
              {STATUS_TEXT.closeTab}
            </LockedButton>
          )}
        </div>
        {surface === 'tab' ? <p className="noc-caption app-muted app-center-text app-tab-done">{STATUS_TEXT.doneTab}</p> : null}
      </div>
    );
  }

  const age = now - record.createdAt;
  const slow = age >= SLOW_AFTER_MS;
  const waited = Math.max(0, Math.floor(age / 1000));
  const left = Math.max(0, Math.ceil((STUCK_AFTER_MS - age) / 1000));
  return (
    <div className="screen s-stat">
      <div className="top-bar">
        <button type="button" className="icon-btn" aria-label="Back" disabled>
          <ExtIcon name="back" size={22} />
        </button>
        <div className="title noc-h1">{STATUS_TEXT.sending}</div>
        <span className={`step noc-overline${slow ? ' app-warning' : ''}`}>{slow ? STATUS_TEXT.slow : ''}</span>
      </div>
      <div className="scroll">
        <div className="hero">
          <div className={`ring ${slow ? 'stuck' : 'broadcasting'}`}>
            <ExtIcon name="send" size={56} />
          </div>
          <div className={`stage-label${slow ? ' app-warning' : ''}`}>{slow ? STATUS_TEXT.slowLabel : STATUS_TEXT.broadcasting}</div>
          <div className={`stage-sub${slow ? ' is-warn' : ''}`}>{slow ? STATUS_TEXT.slowSub : STATUS_TEXT.submitted}</div>
          {amountCard(false, !slow)}
          <div className="meta-grid">
            {toRow}
            {slow ? hashRow : null}
            <div className="meta-row">
              <span className="lbl">Status</span>
              <span className={`val ${slow ? 'app-warning' : 'app-live'}`}>{slow ? `Waiting · ${Math.floor(waited / 60)} m ${waited % 60} s` : STATUS_TEXT.statusBroadcasting}</span>
              <NoCopy />
            </div>
          </div>
          {record.detail === null ? null : <p className="noc-caption app-muted app-center-text">{record.detail}</p>}
          {slow ? (
            <div className="stuck-watch" role="status">
              <ExtIcon name="info" size={16} />
              <div className="app-watch-head">{STATUS_TEXT.recoveryIn}</div>
              <span className="countdown noc-numeral">{String(left).padStart(2, '0')} s</span>
            </div>
          ) : null}
        </div>
        <p className="app-close-note">{STATUS_TEXT.canClose}</p>
        <p className="noc-caption app-dim app-center-text app-reassure" role="note">
          <b>{IF_FAILS_LEAD}</b>
          {STATUS_TEXT.ifFails.slice(IF_FAILS_LEAD.length)}
        </p>
      </div>
      <div className="sticky-bar">
        <button type="button" className="btn btn-secondary" disabled>
          {STATUS_TEXT.waiting}
        </button>
      </div>
    </div>
  );
}
