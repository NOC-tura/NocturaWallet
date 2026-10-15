import {useEffect, useRef, useState, type ReactNode} from 'react';
import {AddressGroups} from '../../../web/src/ui/AddressGroups';
import {ExtIcon} from '../app/ui/ExtIcon';
import {LockedButton} from '../app/ui/LockedButton';
import {SkelCircle, SkelLine} from '../app/ui/Skeleton';
import {feeUsd, shortAddress, showFee, showSol} from '../app/format';
import {fromBook} from '../app/addressBook';
import {formatAmount} from '../shared/amount';
import type {AddressLabel, BalanceChange, Decision, DecodedInstruction, FieldValue, ProgramKey, RequestView, TxDetail, TxItem} from './client';
import {BlockSite, BudgetNotice, ConfirmButton, LookalikeBanner, OriginCard, RiskConfirm, Spinner, Waiting, WindowTop, siteLabel} from './ui';
import {useArmed} from './useArmed';
import {SIGN_TEXT, TX_TEXT, WINDOW_TEXT} from './strings';

/** The design's mono program names (#48: "jupiter_v6", "spl_token"), for the programs the wallet decodes. */
const PROGRAM_NAMES: Record<ProgramKey, string> = {
  system: 'system_program',
  token: 'spl_token',
  'token-2022': 'spl_token_2022',
  'associated-token': 'spl_associated_token_account',
  'compute-budget': 'compute_budget',
  presale: 'noctura_presale',
};
/** The wallet's own tokens by mint (core/presale/addresses.ts; the approval window imports no core): symbol, tile and decimals. */
const KNOWN_MINTS: Record<string, {symbol: string; tile: string}> = {
  B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW: {symbol: 'NOC', tile: 'noc'},
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {symbol: 'USDC', tile: 'usdc'},
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: {symbol: 'USDT', tile: 'usdt'},
};
const MINUS = '−';

/** "194 000 / 200 000" (the design's thin groups). */
const grouped = (n: number): string => n.toLocaleString('en-US').replace(/,/g, ' ');

/** A change's line: the token, its signed amount (exact — every base unit), its dollars when there is a price. */
function changeRow(c: BalanceChange): {key: string; tile: string; tileText: string; name: string; delta: string; neg: boolean; fiat: string | null} {
  const known = c.mint === null ? {symbol: 'SOL', tile: 'sol'} : KNOWN_MINTS[c.mint];
  const amount = BigInt(c.amount);
  const neg = amount < 0n;
  const abs = neg ? -amount : amount;
  const value = c.decimals === null ? abs.toString() : formatAmount(abs, c.decimals, {min: 0, max: c.decimals});
  const micros = c.usdMicros === null ? null : BigInt(c.usdMicros);
  const usd = micros === null ? null : Number(micros < 0n ? -micros : micros) / 1_000_000;
  return {
    key: c.mint ?? 'SOL',
    tile: known === undefined ? 'ico app-tok-other' : `ico s8-tok ${known.tile}`,
    tileText: known === undefined ? '?' : known.symbol,
    name: known === undefined ? shortAddress(c.mint ?? '') : known.symbol,
    delta: `${neg ? MINUS : '+'}${value}`,
    neg,
    fiat: usd === null ? null : feeUsd(usd),
  };
}

function BalanceCard({item, simulating}: {item: TxItem; simulating: boolean}) {
  if (simulating || item.outcome === null) {
    return (
      <div className="s9-bal-card app-busy-dim">
        <span className="label">{TX_TEXT.balanceWaiting}</span>
        {[140, 120].map(w => (
          <div className="s9-bal-row" key={w}>
            <SkelCircle size={24} />
            <SkelLine width={w} height={14} />
            <SkelLine width={80} height={14} />
          </div>
        ))}
      </div>
    );
  }
  if (!item.outcome.ok) return null;
  const rows = item.outcome.changes.map(changeRow);
  return (
    <div className="s9-bal-card">
      <span className="label">{TX_TEXT.balancePost}</span>
      {rows.length === 0 ? <p className="noc-body-sm app-dim app-tx-none">{TX_TEXT.noChanges}</p> : null}
      {rows.map(r => (
        <div className="s9-bal-row" key={r.key}>
          <div className={r.tile}>{r.tileText}</div>
          <div>
            <div className={r.name === r.tileText ? 'pri' : 'pri noc-mono'}>{r.name}</div>
          </div>
          <div>
            <div className={`delta noc-numeral ${r.neg ? 'neg' : 'pos'}`}>{r.delta}</div>
            {r.fiat === null ? null : <div className="fiat">{r.fiat}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

/** A field's value: an address whole, in groups of four, with its label where known (B1 §3); amounts exact. */
function FieldValueView({value, labels}: {value: FieldValue; labels: readonly AddressLabel[]}): ReactNode {
  switch (value.kind) {
    case 'address': {
      const label = labels.find(l => l.address === value.value);
      return (
        <>
          <AddressGroups address={value.value} />
          {label === undefined ? null : <span className="app-tx-addr-label noc-caption">{label.kind === 'account' ? TX_TEXT.ownAccount(label.name) : fromBook(label.name)}</span>}
        </>
      );
    }
    // Fix round 1, I1: a legitimate protocol-level absence (decode.ts's own `none`), never a resolution failure.
    case 'none':
      return '—';
    case 'lamports':
      return `${showSol(BigInt(value.value))} SOL`;
    case 'amount':
      return value.decimals === null ? value.value : formatAmount(BigInt(value.value), value.decimals, {min: 0, max: value.decimals});
    case 'bool':
      return value.value ? 'true' : 'false';
    default:
      return value.value;
  }
}

function Payload({item, labels}: {item: TxItem; labels: readonly AddressLabel[]}) {
  // Fix round 1 (promoted minor 2): a v0 transaction whose lookup table is not yet resolved shows the card, with a line
  // saying why, instead of vanishing entirely.
  if (item.instructions === null) {
    return (
      <div className="s9-payload-card">
        <span className="label">{TX_TEXT.instructions}</span>
        <p className="noc-body-sm app-dim">{TX_TEXT.instructionsPending}</p>
      </div>
    );
  }
  const consumed = item.outcome !== null && item.outcome.ok ? item.outcome.unitsConsumed : null;
  return (
    <div className="s9-payload-card">
      <span className="label">{TX_TEXT.instructions}</span>
      {item.instructions.map((ix: DecodedInstruction, i) => (
        <div className="app-tx-ix" key={i}>
          <div className="row">
            <span className="k">{TX_TEXT.program(i + 1)}</span>
            {ix.program === null ? (
              <span className="v mono app-tx-unknown">
                {ix.programId === null ? '—' : <AddressGroups address={ix.programId} />}
                <span className="noc-caption"> · {TX_TEXT.unknownProgram}</span>
              </span>
            ) : (
              <span className="v mono">
                {shortAddress(ix.programId ?? '')} · {PROGRAM_NAMES[ix.program]}
              </span>
            )}
          </div>
          {ix.program === null ? null : (
            <div className="row app-tx-field">
              <span className="k noc-mono">instruction</span>
              <span className="v mono">
                {ix.name ?? TX_TEXT.unknownInstruction}
                {/* Fix round 1, I3 (controller ruling): a known program's instruction the decoder names but did not
                    decode the fields of (mintTo, withdrawNonceAccount, transferWithSeed, …) never looks fully decoded. */}
                {ix.fields.length === 0 ? <span className="noc-caption"> · {TX_TEXT.notDecoded}</span> : null}
              </span>
            </div>
          )}
          {ix.fields.map((f, fi) => (
            <div className="row app-tx-field" key={fi}>
              <span className="k noc-mono">{f.name}</span>
              <span className={f.value.kind === 'address' ? 'v app-tx-addr' : 'v mono'}>
                <FieldValueView value={f.value} labels={labels} />
              </span>
            </div>
          ))}
        </div>
      ))}
      {/* Fix round 1 (promoted minor 3, R5): computed locally — shown while still simulating too (consumed is "—" until then). */}
      {item.unitLimit === null ? null : (
        <div className="row">
          <span className="k">{TX_TEXT.computeUnits}</span>
          <span className="v noc-numeral">{`${consumed === null ? '—' : grouped(consumed)} / ${grouped(item.unitLimit)}`}</span>
        </div>
      )}
      {item.feeLamports === null ? null : (
        <div className="row">
          <span className="k">{TX_TEXT.networkFee}</span>
          <span className="v noc-numeral">{showFee(BigInt(item.feeLamports))} SOL</span>
        </div>
      )}
    </div>
  );
}

type TxState = 'simulating' | 'ready' | 'failed' | 'expired' | 'unreachable';
function stateOf(d: TxDetail | null): TxState | null {
  if (d === null) return null;
  if (d.simulation.status === 'simulating') return 'simulating';
  if (d.simulation.status === 'unreachable') return 'unreachable';
  const outcomes = d.transactions.map(t => t.outcome);
  if (outcomes.some(o => o !== null && !o.ok && o.error === 'expired')) return 'expired';
  if (outcomes.some(o => o === null || !o.ok)) return 'failed';
  return 'ready';
}

/**
 * #48 dapp-tx-approval (spec B1c §3.3; index.html ix:18261-18705), the states B1c-2 builds:
 *  - simulating-blocking: the origin card, the design's simulation banner, the balance card in skeleton at .55, the
 *    decoded instructions already shown, "This is mandatory — no skip", and Approve disabled ("Approve · simulating")
 *    until the simulation answers (no artificial minimum, §9); ✕ disabled as drawn, Reject open;
 *  - simulated: the balance changes (post − pre per mint, exact) beside the decoded instructions, the compute units and
 *    the fee, and the origin pill "Request from <host> · matches active session" (verified and unknown origins only —
 *    a lookalike's screen vouches for nothing); a batch shows each transaction's section, approved as a whole;
 *  - re-authentication (B1b's rules, through #10 — reached from the Noctura icon, D11): a line before Approve asks
 *    for it; after Approve asked, the banner says where, and Approve waits until the background says it is proven;
 *  - couldn't simulate / unreachable / blockhash expired (Q21): only Reject (B1c-3 adds the red-flag override);
 *  - lookalike: the banner and the flipped bar — [Reject and report], "Approve anyway (not recommended)" → the
 *    2-second confirm;
 *  - approving: "Approving", the body at .65, "Approving…" with the ring, every CTA and ✕ disabled;
 *  - the request can no longer be signed (`tx` null): Q26 and only Reject.
 * B1c-3 builds the red-flag blocks, the typed-confirm override and the unlimited-spend state.
 * C15 holds Approve (and its demoted forms) 500 ms after focus and after each state change — the request, a new
 * simulation, the re-authentication's state, busy; Reject is never held.
 */
export function Tx({request, waiting, notice, busy, onDecide}: {request: RequestView; waiting: number; notice: boolean; busy: boolean; onDecide: (d: Decision) => Promise<unknown>}) {
  const detail = request.tx;
  const lookalike = request.site.kind === 'lookalike';
  const [confirming, setConfirming] = useState(false);
  // Fix round 1, I2: the simulation the sheet was opened against — sent explicitly on proceed, never whatever is
  // current by then (the background answers `stale` for a newer one; §2.3's own fail-closed check, named twice).
  const [confirmSimId, setConfirmSimId] = useState<string | null>(null);
  // Review 1 L4: the last approval was refused `stale` (a refresh landed): say why the click did nothing, until the next one.
  const [stale, setStale] = useState(false);
  const simId = detail !== null && detail.simulation.status === 'ok' ? detail.simulation.id : 'none';
  const armed = useArmed([request.requestId, simId, detail?.reauth?.state ?? 'none', confirming, busy].join('|'));
  const reject = () => onDecide({decision: 'reject'});
  // Promoted minor 1: a reply arriving after this screen is gone (a new head replaced it, or it closed) sets nothing.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  /**
   * Fix round 2 (Rules of Hooks): every hook — and anything a hook below depends on — runs on EVERY render, in the
   * same order, whether or not `detail` is null this time; `Tx` is keyed by `requestId` (Approve.tsx), so the SAME
   * mounted instance can see its `tx` go null → non-null or non-null → null (Q26: the account leaves the session,
   * or rejoins it) without remounting. `stateOf`, `ready` and `reauthWaiting` are therefore null-safe here, computed
   * before the early return below, not after it.
   */
  const state = stateOf(detail);
  const simulating = state === 'simulating';
  const ready = state === 'ready';
  const reauthWaiting = detail?.reauth?.state === 'waiting';
  const canApprove = ready && !reauthWaiting && !busy;
  // Fix round 1, I2: the sheet is for exactly the simulation it opened on — a refresh that lands while it is open
  // (simId no longer matches what was captured, or canApprove itself goes false) closes it; a captured click that
  // still slips past that (the background is the final, fail-closed word) is refused `stale`, never signed.
  useEffect(() => {
    if (confirming && (simId !== confirmSimId || !canApprove)) setConfirming(false);
  }, [confirming, simId, confirmSimId, canApprove]);
  if (detail === null) {
    return (
      <div className="screen app-approve">
        <WindowTop overline={TX_TEXT.overline} tone="neutral" onClose={reject} disabled={busy} />
        <div className="scroll-area app-approve-scroll">
          {notice ? <BudgetNotice /> : null}
          <div className="app-origin-slot">
            <OriginCard site={request.site} origin={request.origin} host={request.host} />
          </div>
          <p className="noc-body-sm app-muted app-approve-lede">{SIGN_TEXT.cannotSign}</p>
        </div>
        <Waiting n={waiting} />
        <div className="sticky-bar">
          <LockedButton className="btn btn-secondary" onPress={reject} disabled={busy}>
            {WINDOW_TEXT.reject}
          </LockedButton>
        </div>
      </div>
    );
  }
  const approve = async (overrideSimId?: string) => {
    setStale(false);
    const sentSimId = overrideSimId ?? (detail.simulation.status === 'ok' ? detail.simulation.id : undefined);
    const reply = await onDecide({decision: 'approve', account: detail.account.publicKey, ...(sentSimId !== undefined ? {simulation: sentSimId} : {})});
    if (!alive.current) return;
    if (typeof reply === 'object' && reply !== null && 'error' in reply && reply.error === 'stale') setStale(true);
  };
  const n = detail.transactions.length;
  const overline = busy ? TX_TEXT.overlineApproving : lookalike ? TX_TEXT.overlineLookalike : TX_TEXT.overline;
  return (
    <div className="screen app-approve">
      <WindowTop overline={overline} tone={!busy && lookalike ? 'danger' : 'neutral'} onClose={reject} disabled={busy || simulating} />
      <div className={busy ? 'scroll-area app-approve-scroll app-tx-busy' : 'scroll-area app-approve-scroll'}>
        {notice ? <BudgetNotice /> : null}
        <div className="app-origin-slot">
          <OriginCard site={request.site} origin={request.origin} host={request.host} />
        </div>
        {lookalike ? <LookalikeBanner site={request.site} host={request.host} /> : null}
        {/* Review 1 L7: who broadcasts — the design draws one screen for both requests. */}
        <p className="noc-caption app-muted app-tx-sends">{detail.kind === 'signAndSendTransaction' ? TX_TEXT.sendsNoctura : TX_TEXT.sendsSite}</p>
        {stale && ready ? (
          <div className="s9-flag-banner warn app-tx-block" role="status">
            <ExtIcon name="alert-triangle" size={18} />
            <div>
              <p className="head">{TX_TEXT.stale}</p>
            </div>
          </div>
        ) : null}
        {/* Re-authentication first, under the origin: the one thing the user must do before Approve (seen without scrolling). */}
        {ready && detail.reauth !== null && detail.reauth.state === 'needed' ? <p className="noc-caption app-muted app-tx-caption">{TX_TEXT.reauthNeeded}</p> : null}
        {ready && reauthWaiting ? (
          <div className="s9-flag-banner warn app-tx-block" role="status">
            <ExtIcon name="lock" size={18} />
            <div>
              <p className="head">{TX_TEXT.reauthHead}</p>
              <p className="body">{TX_TEXT.reauthWaiting}</p>
            </div>
          </div>
        ) : null}
        {simulating ? (
          <div className="s9-sim-banner app-tx-block" role="status">
            <div className="m3" />
            <div>
              <div className="body">{TX_TEXT.simulating}</div>
              <div className="meta">{TX_TEXT.simulatingMeta}</div>
            </div>
          </div>
        ) : null}
        {state === 'failed' || state === 'unreachable' || state === 'expired' ? (
          <div className="s9-flag-banner danger app-tx-block" role="alert">
            <ExtIcon name="alert-triangle" size={18} />
            <div>
              <p className="head">{state === 'expired' ? TX_TEXT.expired : TX_TEXT.couldNot}</p>
              {state === 'unreachable' ? <p className="body">{TX_TEXT.unreachable}</p> : null}
              {state === 'failed'
                ? detail.transactions.map((t, i) =>
                    t.outcome !== null && !t.outcome.ok ? (
                      <p className="meta" key={i}>
                        {n > 1 ? `${TX_TEXT.batchItem(i + 1, n)}: ` : ''}
                        {t.outcome.detail}
                      </p>
                    ) : null,
                  )
                : null}
            </div>
          </div>
        ) : null}
        {detail.transactions.map((t, i) => (
          <section className="app-tx-item" key={i}>
            {n > 1 ? <h2 className="noc-overline app-tx-batch">{TX_TEXT.batchItem(i + 1, n)}</h2> : null}
            {state === 'failed' || state === 'expired' || state === 'unreachable' ? null : <BalanceCard item={t} simulating={simulating} />}
            <Payload item={t} labels={detail.labels} />
          </section>
        ))}
        {simulating ? <p className="noc-caption app-dim app-tx-caption">{TX_TEXT.mandatory}</p> : null}
        {ready && !lookalike ? (
          <div className="s9-origin-pill app-tx-block">
            <span className="dot ok" />
            <span className="body">
              {TX_TEXT.originPill(siteLabel(request.origin, request.host))[0]}
              <code>{siteLabel(request.origin, request.host)}</code>
              {TX_TEXT.originPill(siteLabel(request.origin, request.host))[2]}
            </span>
          </div>
        ) : null}
      </div>
      {request.offerBlock && !busy ? <BlockSite onBlock={() => onDecide({decision: 'block'})} /> : null}
      <Waiting n={waiting} />
      {!ready && !simulating ? (
        <div className="sticky-bar">
          {lookalike ? (
            <LockedButton className="btn btn-destructive" onPress={() => onDecide({decision: 'report'})} disabled={busy}>
              <ExtIcon name="close" size={18} />
              {WINDOW_TEXT.rejectAndReport}
            </LockedButton>
          ) : null}
          <LockedButton className="btn btn-secondary" onPress={reject} disabled={busy}>
            {WINDOW_TEXT.reject}
          </LockedButton>
        </div>
      ) : lookalike && !busy ? (
        <div className="sticky-bar">
          <LockedButton className="btn btn-destructive" onPress={() => onDecide({decision: 'report'})}>
            <ExtIcon name="close" size={18} />
            {WINDOW_TEXT.rejectAndReport}
          </LockedButton>
          <ConfirmButton
            armed={armed && canApprove}
            className="btn btn-tertiary noc-body-sm app-dim"
            onPress={() => {
              // I2: captured now — what the sheet is for, and what proceeding sends, however long it stays open.
              setConfirmSimId(simId);
              setConfirming(true);
            }}
          >
            {TX_TEXT.approveAnyway}
          </ConfirmButton>
        </div>
      ) : (
        <div className="sticky-bar row">
          <LockedButton className="btn btn-secondary" onPress={reject} disabled={busy}>
            {WINDOW_TEXT.reject}
          </LockedButton>
          {busy ? (
            <button type="button" className="btn btn-primary app-cta-wide app-cta-busy" disabled>
              <Spinner />
              {TX_TEXT.approving}
            </button>
          ) : (
            <ConfirmButton armed={armed && canApprove} className="btn btn-primary app-cta-wide" onPress={approve}>
              {TX_TEXT.approve}
              {simulating ? <span className="app-tx-sim-tag">{TX_TEXT.approveSimulating}</span> : null}
            </ConfirmButton>
          )}
        </div>
      )}
      {confirming ? (
        <RiskConfirm
          onCancel={() => setConfirming(false)}
          onProceed={async () => {
            // I2: the effect above already closes this sheet the instant either goes stale; this is the backstop —
            // onProceed itself never bypasses canApprove, and never sends anything but the id it was captured for.
            if (confirmSimId === null || simId !== confirmSimId || !canApprove) {
              setConfirming(false);
              return;
            }
            setConfirming(false);
            await approve(confirmSimId);
          }}
        />
      ) : null}
    </div>
  );
}
