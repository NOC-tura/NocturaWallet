import {useWallet} from '../WalletContext';
import {draftOf, showExact, type Draft} from '../send/rules';
import {ExplorerLink} from './TxDetail';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {ExtIcon} from '../ui/ExtIcon';
import {RefusedBanner} from '../ui/Banner';
import {LockedButton} from '../ui/LockedButton';
import {useEscape} from '../ui/useEscape';
import type {Intent, Pending} from '../engine';
import {kindRecord} from '../generic';
import type {PresaleRouteValue} from '../router';

/** The engine's landed-but-failed detail ends with a send's clause (background/pending.ts `failedDetail`). A record of
 *  another kind says what moved in its own sub, so its reason meta keeps only the program's error (owner-delegated copy
 *  call, 2026-10-25). A detail without the clause is shown as it is. */
export const withoutSendClause = (detail: string): string => detail.replace(/: the network fee was paid, nothing was sent\.$/, '');

/** The fixed strings #44 shows (spec §4.7); adapted ones are marked there. */
export const FAILED_TEXT = {
  eyebrow: 'Transaction',
  expiredHead: 'Recent blockhash expired',
  expiredSub: 'Not confirmed — no funds moved.',
  expiredWhy: 'Solana rotated past the blockhash before your transaction reached a leader. Tap retry — the wallet will fetch a fresh one.',
  expiredFoot: 'No fees were charged. Retry is a fresh transaction with a new blockhash — same recipient, same amount.',
  payload: 'Original payload preserved',
  rejectedHead: 'Program rejected the transaction',
  rejectedSub: 'The on-chain program returned an error. The network fee was charged; the amount did not move.',
  notSentHead: "Couldn't send",
  // index.html #s44 network-error (44d): its hero sub's second sentence, verbatim. The first ("Couldn't reach Solana
  // mainnet through your current RPC.") names a user-chosen RPC the extension does not have, and the route did answer.
  notSentSub: 'Funds are unchanged — the request never reached a leader.',
  genericHead: 'Transaction failed',
  tryAgain: 'Try again',
  edit: 'Edit transaction',
  details: 'View details',
  explorer: 'View on explorer',
} as const;

type Kind = 'blockhash-expired' | 'rejected-by-program' | 'network-error' | 'generic';

/** #44's state from the engine's `state` and `failure` (E8, C3) — never from `detail`, which is only the caption. */
export function failedKind(p: Pending): Kind {
  if (p.state === 'expired') return 'blockhash-expired';
  if (p.failure === 'landed') return 'rejected-by-program';
  if (p.failure === 'not-sent') return 'network-error';
  return 'generic';
}

/**
 * #44 tx-failed (spec §4.7): the design's categories the engine can report, chosen by `failure` (E8). Removed,
 * loudly: insufficient-fee (the engine never reports it; priority is automatic, D15), the slippage content (no
 * swaps), the RPC picker (reads and broadcast are fixed to the coordinator). `[Try again]` is a fresh prepare of
 * the same intent at #19 (rule 6: a LockedButton); the explorer link is Solscan's, checked (§6.5). A record without an
 * intent (B1d §1.3: another kind, Q42) has nothing to prepare again: no [Try again] or [Edit transaction] (the explorer
 * link in their place, the back arrow closes), and its kept payload is its block height — no recipient, no amount.
 * B1d §4.2: a record of a kind the presale entry renders (a purchase) has that kind's words — its amount line under the
 * head (Q32), its own sub when the program refused it on chain (Q55: the network fee paid, nothing bought), its payload
 * (what was paid, to whom) — and its [Try again] and back arrow start that kind's flow again (#23 with the amount); the
 * footer about "same recipient, same amount" is not shown (that flow prepares again at the current price).
 */
export function Failed({
  record,
  canRetry,
  onTryAgain,
  onEdit,
  onDetails,
  onClose,
  onRoute,
}: {
  record: Pending;
  /**
   * The record's account is the selected one (#27's owner rule, Task 14; final review I1): only then are [Try again] and
   * [Edit transaction] offered — each starts a flow for the record's account, which must not run under another's.
   */
  canRetry: boolean;
  onTryAgain: (intent: Intent) => void;
  onEdit: (draft: Draft) => void;
  onDetails: (signature: string) => void;
  /** The back arrow and Esc while another account is selected: #11, never that account's #12 with this draft. */
  onClose: () => void;
  /** B1d §4.2: a purchase's [Try again] and back arrow — the presale entry's route (#23 with the amount). */
  onRoute: (route: PresaleRouteValue) => void;
}) {
  const m = useWallet();
  const kind = failedKind(record);
  const refused = m.net.mode === 'refused';
  const intent = record.intent;
  const words = kindRecord(record);
  // A fresh attempt: a send's intent prepared again at #19, or the kind's own flow (B1d §4.2); none for a generic record.
  const again = intent !== null ? () => onTryAgain(intent) : words !== null ? () => onRoute(words.again) : null;
  const retry = canRetry && again !== null;
  const edit = () => {
    if (intent !== null) onEdit(draftOf(intent));
  };
  // The design's back arrow returns to #12 with the form kept: the same as [Edit transaction] — while the record's
  // account is selected. Otherwise it closes to #11. A purchase's goes back to its own form (#23 with the amount).
  const back = !retry || again === null ? onClose : intent !== null ? edit : again;
  useEscape(back);
  const head = kind === 'blockhash-expired' ? FAILED_TEXT.expiredHead : kind === 'rejected-by-program' ? FAILED_TEXT.rejectedHead : kind === 'network-error' ? FAILED_TEXT.notSentHead : FAILED_TEXT.genericHead;
  // The sub: expired, the engine's own line (its NOT_CONFIRMED; expiredSub only when the record has none); rejected, the
  // spec's adapted sentence; not-sent, 44d's own sub (its cause, the engine detail, is the reason banner's body, as 44d
  // draws it); generic, the detail.
  const sub =
    kind === 'rejected-by-program'
      ? words?.rejectedSub ?? FAILED_TEXT.rejectedSub
      : kind === 'blockhash-expired'
        ? record.detail ?? FAILED_TEXT.expiredSub
        : kind === 'network-error'
          ? FAILED_TEXT.notSentSub
          : record.detail ?? '';
  const tryAgain = !retry || again === null ? null : (
    <LockedButton className="btn btn-primary" disabled={refused} onPress={again}>
      <ExtIcon name="refresh" size={18} />
      {FAILED_TEXT.tryAgain}
    </LockedButton>
  );
  // 44c's button carries no glyph.
  const explorer = <ExplorerLink signature={record.signature} label={FAILED_TEXT.explorer} icon={false} />;
  return (
    <div className="screen">
      <div className="top-bar">
        <button type="button" className="icon-btn" aria-label="Back" onClick={back}>
          <ExtIcon name="back" size={22} />
        </button>
        <span className="title noc-overline app-fail-eyebrow">{FAILED_TEXT.eyebrow}</span>
        <span className="step noc-body-sm">{kind === 'rejected-by-program' ? 'Rejected' : 'Failed'}</span>
      </div>
      <div className="scroll-area app-fail-body">
        {refused ? <RefusedBanner /> : null}
        <div className="s9-fail-hero">
          <div className="ring">
            <div className="ring-inner">
              <ExtIcon name="close" size={32} />
            </div>
          </div>
          <h1 className="head">{head}</h1>
          {words === null ? null : <p className="sub app-fail-line noc-numeral">{words.line}</p>}
          {sub === '' ? null : <p className="sub">{sub}</p>}
        </div>
        {kind === 'generic' ? null : (
          <div className="s9-reason-banner">
            <span className="label">Reason · {kind}</span>
            {kind === 'blockhash-expired' ? <p className="body">{FAILED_TEXT.expiredWhy}</p> : null}
            {kind === 'network-error' && record.detail !== null ? <p className="body">{record.detail}</p> : null}
            {kind === 'rejected-by-program' && record.detail !== null ? <span className="meta">{(words === null ? record.detail : withoutSendClause(record.detail)).slice(0, 240)}</span> : null}
            {/* 44c: the explorer link is the reason banner's own (.explorer, with its link-out glyph), after the meta line. */}
            {kind === 'rejected-by-program' ? <ExplorerLink signature={record.signature} label={FAILED_TEXT.explorer} className="explorer" /> : null}
          </div>
        )}
        {kind === 'blockhash-expired' ? (
          <>
            <div className="s9-payload-card">
              <span className="label">{FAILED_TEXT.payload}</span>
              {words === null ? null : (
                <>
                  <div className="row">
                    <span className="k">To</span>
                    <span className="v">{words.to}</span>
                  </div>
                  <div className="row">
                    <span className="k">Amount</span>
                    <span className="v noc-numeral">{words.amount}</span>
                  </div>
                </>
              )}
              {intent === null ? null : (
                <>
                  <div className="row">
                    <span className="k">To</span>
                    <span className="v mono noc-mono">
                      <AddressGroups address={intent.recipient} />
                    </span>
                  </div>
                  <div className="row">
                    <span className="k">Amount</span>
                    <span className="v noc-numeral">
                      {showExact(intent.token, intent.amount)} {intent.token}
                    </span>
                  </div>
                </>
              )}
              <div className="row">
                <span className="k">Valid until block</span>
                <span className="v noc-numeral">{record.lastValidBlockHeight}</span>
              </div>
            </div>
            {intent === null ? null : <p className="noc-caption app-muted">{FAILED_TEXT.expiredFoot}</p>}
          </>
        ) : null}
      </div>
      <div className="sticky-bar">
        {kind === 'generic' || (again === null && kind !== 'rejected-by-program') ? explorer : tryAgain}
        {kind === 'blockhash-expired' && retry && intent !== null ? (
          <button type="button" className="btn btn-secondary" onClick={edit}>
            {FAILED_TEXT.edit}
          </button>
        ) : kind === 'rejected-by-program' ? (
          <>
            {/* The design's [View details] → #27 (screen.md #44), only here: the one #44 state whose transaction is on chain. */}
            <button type="button" className="btn btn-secondary" onClick={() => onDetails(record.signature)}>
              <ExtIcon name="doc" size={18} />
              {FAILED_TEXT.details}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
