import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useWallet} from '../WalletContext';
import {parseAmount} from '../../shared/amount';
import {TOKEN_INFO, showAmount} from '../format';
import {plainAmount} from '../send/rules';
import {TopBar} from '../ui/TopBar';
import {ExtIcon} from '../ui/ExtIcon';
import {Banner} from '../ui/Banner';
import {LockedButton} from '../ui/LockedButton';
import {SkelLine} from '../ui/Skeleton';
import {TokenSheet} from '../screens/TokenSheet';
import {ExplorerLink} from '../screens/TxDetail';
import {SEND_TEXT} from '../screens/Send';
import type {Pending, Reply, Token} from '../engine';
import {
  PRESALE_CURRENCIES,
  presaleClient,
  purchaseDataOf,
  type PrepareRefusal,
  type PresaleCurrency,
  type PresaleView,
  type PurchaseView,
  type Quote,
  type QuoteLine,
  type StageView,
} from './client';
import {GEO_REASON_TEXT, PRESALE_TEXT, dollarsText, fillWidth, millionsNoc, priceText, raisedText, shortSignature, solPriceText} from './text';
import type {PresaleAgain} from './routes';

/** C35: #23a re-reads the snapshot and the gate this often while it is visible. */
export const REREAD_MS = 25_000;
/** §4.1: 23b reads its record (no network) this often, the design's interval. */
export const PENDING_POLL_MS = 6_000;
/** §4.1: typing asks a quote this long after the last keystroke. */
export const QUOTE_DEBOUNCE_MS = 250;

type ViewReply = Reply<PresaleView, 'malformed' | 'locked' | 'unknown-account' | 'unavailable'>;
type OpenView = Extract<PresaleView, {open: true}>;
/** A line under the amount (§3.2, §5): a quote's own, or a prepare's limit and balance refusals. */
type Line = QuoteLine | 'above-limit';
const LINES: readonly string[] = ['below-min', 'above-max-tx', 'above-user-limit', 'above-limit', 'insufficient-sol', 'insufficient-token', 'split-balance', 'sender-below-rent', 'no-sol-price'];
const isLine = (code: string): code is Line => LINES.includes(code);

const visible = (): boolean => typeof document === 'undefined' || document.visibilityState === 'visible';

/** The words of a line (Q19, Q40 a–c, Q41 a–d) for the background's code, from the view's own numbers. */
function lineText(line: Line, currency: PresaleCurrency, v: OpenView): string {
  switch (line) {
    case 'below-min':
      return PRESALE_TEXT.belowMin(dollarsText(v.limits.minCents));
    case 'above-max-tx':
    case 'above-limit':
      return PRESALE_TEXT.aboveMaxTx(dollarsText(v.limits.maxTxCents));
    case 'above-user-limit':
      return PRESALE_TEXT.aboveUser(dollarsText(v.limits.userRemainingCents));
    case 'insufficient-sol':
      return currency === 'SOL' ? PRESALE_TEXT.insufficient('SOL') : PRESALE_TEXT.feeSol;
    case 'insufficient-token':
      return PRESALE_TEXT.insufficient(currency);
    case 'split-balance':
      return PRESALE_TEXT.split(currency, showAmount(currency, currency === 'SOL' ? v.balances.SOL : v.balances[currency].largest));
    case 'sender-below-rent':
      return PRESALE_TEXT.keepRent;
    case 'no-sol-price':
      return PRESALE_TEXT.noSolPrice;
  }
}

/** A prepare refusal that is not a line: the notice it shows (null: none), and whether the view is read again. */
function refusalOf(code: PrepareRefusal | 'failed'): {notice: string | null; reread: boolean} {
  switch (code) {
    case 'price-changed':
      return {notice: PRESALE_TEXT.priceChanged, reread: true};
    case 'state-changed':
      return {notice: PRESALE_TEXT.accountChanged, reread: true};
    case 'simulation-failed':
    case 'simulation-mismatch':
      return {notice: PRESALE_TEXT.notSimulated, reread: false};
    case 'presale-busy':
      return {notice: PRESALE_TEXT.busy, reread: false};
    case 'coordinator-refused':
      return {notice: PRESALE_TEXT.refused, reread: false};
    case 'presale-closed':
      return {notice: PRESALE_TEXT.inactive, reread: true};
    case 'blocked':
      return {notice: PRESALE_TEXT.blocked, reread: true};
    // C10: a purchase in flight is 23b once the view is read again; a send in flight keeps #23a, with B1b's line.
    case 'in-flight':
      return {notice: SEND_TEXT.pending, reread: true};
    case 'geo-closed':
    case 'unknown-account':
      return {notice: null, reread: true};
    default:
      return {notice: PRESALE_TEXT.unavailable, reread: true};
  }
}

function StageCard({state, live}: {state: StageView; live: boolean}) {
  const n = state.stage + 1;
  return (
    <div className="stage-card">
      <span className="eyebrow noc-overline">
        <ExtIcon name="rocket" size={14} /> {live ? PRESALE_TEXT.liveEyebrow(n) : PRESALE_TEXT.closedEyebrow(n)}
      </span>
      <div className="price">
        <span className="noc-balance-lg noc-numeral">{priceText(state.priceTicks)}</span>
        <span className="unit noc-body-lg">{PRESALE_TEXT.perNoc}</span>
      </div>
      <div className="progress" aria-label="Presale progress">
        <i style={{width: fillWidth(state.stageSoldBase, state.stageCapBase)}} />
      </div>
      <div className="meta">
        <span className="noc-caption">
          <b>
            <span className="noc-numeral">{raisedText(state.raisedCents)}</span>
          </b>
          {PRESALE_TEXT.raised}
        </span>
        <span className="noc-caption">
          <b>
            <span className="noc-numeral">{millionsNoc(state.stageCapBase)}</span>
          </b>
          {PRESALE_TEXT.stageCap}
        </span>
      </div>
      {state.nextPriceTicks === null ? null : (
        <div className="meta app-pre-meta2">
          <span className="noc-caption">
            {PRESALE_TEXT.nextStage}
            <span className="noc-numeral">{priceText(state.nextPriceTicks)}</span>
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * The closed line of an answer (§4.1): Q11 / Q12 / Q13 / Q14, or the region line (`region`: a link to #50b); null when
 * the answer is open.
 */
function closedLine(v: PresaleView): {text: string; region: boolean} | null {
  if (v.open) return null;
  if (v.why === 'unavailable') return {text: v.code === 'refused' ? PRESALE_TEXT.refused : PRESALE_TEXT.unavailable, region: false};
  if (v.why === 'geo') return {text: PRESALE_TEXT.regionLine(GEO_REASON_TEXT[v.geo.reason ?? 'no_check']), region: true};
  return {text: v.why === 'inactive' ? PRESALE_TEXT.inactive : PRESALE_TEXT.blocked, region: false};
}

/** 23b (§4.1, C17, C30): the open purchase, from its record — never hidden; the answer's closed line beneath (a region line opens #50b). */
function Pending23b({record, line, onRegion}: {record: Pending; line: {text: string; region: boolean} | null; onRegion: () => void}) {
  const data = record.extra === null ? undefined : purchaseDataOf(record.extra.data);
  return (
    <>
      <div className="pending-card">
        <div className="head">
          <div className="ring" aria-hidden="true" />
          <div className="copy">
            <h3 className="noc-h3">{PRESALE_TEXT.orderPending}</h3>
            <p className="noc-body-sm">{PRESALE_TEXT.waiting}</p>
          </div>
        </div>
        {data === undefined ? null : (
          <>
            <div className="row">
              <span className="l noc-body-sm">{PRESALE_TEXT.paid}</span>
              <span className="r noc-body-lg noc-numeral">{`${showAmount(data.currency, data.amount)} ${data.currency}`}</span>
            </div>
            <div className="row">
              <span className="l noc-body-sm">{PRESALE_TEXT.estimated}</span>
              <span className="r noc-body-lg noc-numeral">{`${showAmount('NOC', data.nocBase)} NOC`}</span>
            </div>
            <div className="row">
              <span className="l noc-body-sm">{PRESALE_TEXT.stage}</span>
              <span className="r noc-body-sm">{PRESALE_TEXT.stageRow(data.stage + 1, priceText(data.priceTicks))}</span>
            </div>
          </>
        )}
        <div className="row">
          <span className="l noc-body-sm">{PRESALE_TEXT.txHash}</span>
          <span className="r mono noc-mono" title={record.signature}>
            {shortSignature(record.signature)}
          </span>
        </div>
      </div>
      {/* index.html #23b's info banner: one regular-weight line (B1b's Banner would set it as a semibold title). */}
      <div className="banner info" role="status">
        <ExtIcon name="info" size={16} />
        <div>
          <span className="noc-body-sm">{PRESALE_TEXT.closeNote}</span>
        </div>
      </div>
      {line === null ? null : line.region ? (
        // §4.1 (B1d-1b Task 6): the region line is a link to #50b, in the warning banner's own words and style.
        <button type="button" className="banner warning app-strip app-pre-region" onClick={onRegion}>
          <ExtIcon name="alert-triangle" size={18} />
          <span className="noc-body-sm banner-title">{line.text}</span>
          <span className="app-strip-chev">
            <ExtIcon name="chevron-right" size={18} />
          </span>
        </button>
      ) : (
        <Banner tone="warning" title={line.text} />
      )}
      <ExplorerLink signature={record.signature} label={PRESALE_TEXT.explorer} icon={false} className="geo-link noc-body-sm" />
    </>
  );
}

/**
 * #23 presale (B1d §4.1; index.html #23 ix 10603-10902): 23a active, 23b pending and the allocation row. Everything it
 * shows is what the background answered — `presale.view`, `presale.quote`, `presale.pending` — formatted, never
 * computed: the estimate, MAX, the limit and balance lines and the stage are the background's (C3). Claim (23c) and
 * done (23d) are not built (D1): there is no on-chain source before TGE.
 *
 * Reads (C35): a full view on mount, on focus, on a currency change, when the screen becomes visible again and once
 * when 23b's record closes; while 23a is visible, the snapshot and the gate every 25 s (`refresh: 'gate'`, the balances
 * of the last full view kept); nothing while hidden. 23b reads only its record, every 6 s and on focus (no network).
 * Buy (rule 6, a LockedButton) hands the background's prepared purchase to `onPrepared`.
 */
export function Presale({
  again = null,
  onBack,
  onDone,
  onPrepared,
  onRegion,
  onGeo,
}: {
  /**
   * B1d-1b Task 5: #23 again with what the user was buying — #20's back and its sign-time refusals that keep the
   * purchase, #44's and #54's [Try again]: the currency and amount in the field, the refusal's line or notice, and the
   * challenge id the next Buy carries. Null: a fresh #23.
   */
  again?: PresaleAgain | null;
  onBack: () => void;
  /** 23b's [Done] → #11. */
  onDone: () => void;
  /** §4.1: the purchase the background prepared — #20's purchase variant (`presale-confirm`, `flow`). */
  onPrepared: (account: string, view: PurchaseView) => void;
  /** C18: "Not available in your region?" (and 23b's region line) → #50b, over #23. */
  onRegion: () => void;
  /** §4.1 (B1d-1b Task 6): the gate's closed answer with no open record — #23 is replaced by #50b. */
  onGeo: () => void;
}) {
  const m = useWallet();
  const account = m.account?.publicKey ?? null;
  const client = useMemo(() => presaleClient(m.engine), [m.engine]);
  const {reload, report} = m;
  const [view, setView] = useState<{account: string; reply: ViewReply} | null>(null);
  /** 23b's record as its own poll last read it, for the record the view showed. */
  const [polled, setPolled] = useState<{id: string; record: Pending} | null>(null);
  const [currency, setCurrency] = useState<PresaleCurrency>(again?.currency ?? 'SOL');
  const [text, setText] = useState(() => (again === null ? '' : plainAmount(BigInt(again.amount), TOKEN_INFO[again.currency].decimals)));
  /** The text MAX wrote: while the field still holds it, the quote asked is MAX's (`'max'`), not the number. */
  const [maxText, setMaxText] = useState<string | null>(null);
  const [quoted, setQuoted] = useState<{key: string; quote: Quote | 'stale'} | null>(null);
  /** A prepare's line (§5: limit and balance codes), for the amount it was asked for. */
  const [refusal, setRefusal] = useState<{key: string; line: Line} | null>(() =>
    again === null || again.code === null || !isLine(again.code) ? null : {key: `${again.currency}|${plainAmount(BigInt(again.amount), TOKEN_INFO[again.currency].decimals)}`, line: again.code},
  );
  const [notice, setNotice] = useState<string | null>(() => (again === null || again.code === null || isLine(again.code) ? null : refusalOf(again.code).notice));
  /** The purchase's challenge #20 handed back: the next Buy carries it (§3.3 step 6). */
  const carried = useRef(again?.challengeId ?? null);
  const [sheet, setSheet] = useState(false);
  const [shown, setShown] = useState(visible);

  const generation = useRef(0);
  const read = useCallback(
    async (refresh?: 'gate') => {
      if (account === null) return;
      const mine = ++generation.current;
      const reply = await client.view(account, refresh);
      // A later read, or the screen gone: this answer is dropped (the newest read decides).
      if (generation.current !== mine) return;
      if (!reply.ok && reply.error === 'locked') {
        void reload();
        return;
      }
      if (reply.ok && !reply.data.open && reply.data.why === 'unavailable' && reply.data.code === 'refused') report('coordinator-refused');
      setView({account, reply});
    },
    [account, client, reload, report],
  );
  /** False once the screen is gone: a prepare that answers after it hands nothing on. */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current += 1;
    };
  }, []);

  // A full view on mount, for another account, and on a currency change (C35).
  useEffect(() => {
    void read();
  }, [read, currency]);

  const current = view !== null && view.account === account && view.reply.ok ? view.reply.data : null;
  const failed = view !== null && view.account === account && !view.reply.ok;
  const record = current === null ? null : polled !== null && current.pending !== null && polled.id === current.pending.id ? polled.record : current.pending;
  const open = current !== null && current.open && record === null ? current : null;

  // §4.1: the gate closed and no open record → #50b in #23's place ("re-checked at every presale screen mount": #50b asks
  // its own view). Once: this screen is leaving.
  const toGeo = current !== null && record === null && !current.open && current.why === 'geo';
  const replaced = useRef(false);
  useEffect(() => {
    if (!toGeo || replaced.current) return;
    replaced.current = true;
    onGeo();
  }, [toGeo, onGeo]);

  // Visibility (C35): hidden pauses the re-read; visible again resumes it with a full view. Focus asks a full view.
  useEffect(() => {
    const onVisibility = () => {
      const now = visible();
      setShown(now);
      if (now) void read();
    };
    const onFocus = () => void read();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [read]);

  // 23a's re-read: the snapshot and the gate only, every 25 s while visible (C35, review 2 M3).
  const rereading = open !== null && shown;
  useEffect(() => {
    if (!rereading) return;
    const i = setInterval(() => void read('gate'), REREAD_MS);
    return () => clearInterval(i);
  }, [rereading, read]);

  // 23b: the record every 6 s and on focus — no network (C30); when it is no longer open, one full view.
  const watching = record === null ? null : record.id;
  useEffect(() => {
    if (watching === null || account === null) return;
    let alive = true;
    const poll = async () => {
      const r = await client.pending(account);
      if (!alive || !r.ok) return;
      if (r.data === null || r.data.id !== watching) void read();
      else setPolled({id: watching, record: r.data});
    };
    const i = setInterval(() => void poll(), PENDING_POLL_MS);
    const onFocus = () => void poll();
    window.addEventListener('focus', onFocus);
    return () => {
      alive = false;
      clearInterval(i);
      window.removeEventListener('focus', onFocus);
    };
  }, [watching, account, client, read]);

  const decimals = TOKEN_INFO[currency].decimals;
  const parsed = parseAmount(text, decimals);
  const amount = parsed !== null && parsed > 0n ? parsed : null;
  const isMax = maxText !== null && text === maxText;
  const key = `${currency}|${text}`;

  // The quote (§3.2): 250 ms after the last keystroke, again for each new view; MAX's own while the field holds it.
  // Empty or zero asks nothing (the popup's own `{line: null}`, Buy disabled).
  const quoteGeneration = useRef(0);
  useEffect(() => {
    const mine = ++quoteGeneration.current;
    if (account === null || open === null || (amount === null && !isMax)) return;
    const t = setTimeout(() => {
      void client.quote(account, currency, isMax ? 'max' : (amount ?? 0n)).then(r => {
        if (quoteGeneration.current !== mine) return;
        if (!r.ok) {
          if (r.error === 'locked') void reload();
          return;
        }
        if (r.data === 'stale') {
          setQuoted({key, quote: 'stale'});
          void read();
          return;
        }
        if (isMax) {
          // MAX's amount as the background answered it; the field shows it, and it stays MAX's while unedited.
          const next = plainAmount(r.data.amount, decimals);
          setText(next);
          setMaxText(next);
          setQuoted({key: `${currency}|${next}`, quote: r.data});
        } else setQuoted({key, quote: r.data});
      });
    }, QUOTE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [account, open, amount, isMax, currency, key, decimals, client, read, reload]);

  const quote = quoted !== null && quoted.key === key && quoted.quote !== 'stale' ? quoted.quote : null;
  const stale = quoted !== null && quoted.key === key && quoted.quote === 'stale';
  const noPrice = open !== null && currency === 'SOL' && open.solUsdMicros === null;
  const line: Line | null = refusal !== null && refusal.key === key ? refusal.line : noPrice ? 'no-sol-price' : (quote?.line ?? null);
  const estimate = quote?.nocBase ?? null;
  const ready = open !== null && account !== null && amount !== null && quote !== null && quote.amount === amount && line === null && !stale && m.net.mode !== 'refused';

  const edit = (next: string) => {
    setText(next);
    setRefusal(null);
    setNotice(null);
  };
  const choose = (t: Token) => {
    const c = PRESALE_CURRENCIES.find(x => x === t);
    if (c === undefined || c === currency) return;
    setCurrency(c);
    setText('');
    setMaxText(null);
    setRefusal(null);
    setNotice(null);
  };
  const max = () => {
    setRefusal(null);
    setNotice(null);
    // The field holds MAX's text from the answer; '' until it lands, so the quote below asks 'max'.
    setText('');
    setMaxText('');
  };

  const buy = async () => {
    if (!ready || open === null || account === null || amount === null) return;
    setNotice(null);
    const asked = key;
    const r = await client.prepareBuy(account, {currency, amount, stage: open.state.stage}, carried.current ?? undefined);
    if (!alive.current) return;
    if (r.ok) {
      onPrepared(account, r.data);
      return;
    }
    if (r.error === 'locked') {
      void reload();
      return;
    }
    if (isLine(r.error)) {
      setRefusal({key: asked, line: r.error});
      return;
    }
    if (r.error === 'coordinator-refused') report('coordinator-refused');
    const what = refusalOf(r.error);
    setNotice(what.notice);
    if (what.reread) void read();
  };

  // A closed region answer with no open record is #50b's to show: the skeleton stays while #23 is replaced.
  const loading = (current === null && !failed) || toGeo;
  const balance = open === null ? null : currency === 'SOL' ? open.balances.SOL : open.balances[currency].largest;
  const sub =
    open === null
      ? null
      : currency === 'SOL'
        ? open.solUsdMicros === null
          ? PRESALE_TEXT.receiveStable(priceText(open.state.priceTicks))
          : PRESALE_TEXT.receiveSol(priceText(open.state.priceTicks), solPriceText(open.solUsdMicros))
        : PRESALE_TEXT.receiveStable(priceText(open.state.priceTicks));

  let body;
  if (loading) {
    body = (
      <>
        <div className="stage-card" aria-busy="true">
          <SkelLine width={140} />
          <SkelLine width={180} height={28} />
          <SkelLine width={320} height={6} />
          <SkelLine width={260} />
        </div>
        <div className="input-card" aria-busy="true">
          <SkelLine width={200} />
          <SkelLine width={240} height={28} />
          <SkelLine width={200} />
          <SkelLine width={160} height={22} />
        </div>
      </>
    );
  } else if (current === null) {
    body = <Banner tone="warning" title={PRESALE_TEXT.unavailable} />;
  } else if (record !== null) {
    body = <Pending23b record={record} line={closedLine(current)} onRegion={onRegion} />;
  } else if (!current.open) {
    const closed = closedLine(current);
    body = (
      <>
        {current.why === 'inactive' || current.why === 'blocked' ? <StageCard state={current.state} live={current.why === 'blocked'} /> : null}
        {closed === null ? null : <Banner tone="warning" title={closed.text} />}
      </>
    );
  } else {
    const v = current;
    body = (
      <>
        {notice === null ? null : <Banner tone="warning" title={notice} />}
        <StageCard state={v.state} live />
        <div className="input-card">
          <div className="lbl-row">
            <b className="noc-overline">{PRESALE_TEXT.youPay}</b>
            <span className="noc-caption">
              {PRESALE_TEXT.available}
              <span className="noc-numeral">{balance === null ? '—' : showAmount(currency, balance)}</span> {currency}
            </span>
          </div>
          <div className="row">
            <input
              className="input noc-balance-lg noc-numeral"
              aria-label={PRESALE_TEXT.youPay}
              placeholder="0.0"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              value={text}
              onChange={e => edit(e.target.value.trim())}
            />
            <button type="button" className="ticker" aria-label={PRESALE_TEXT.currency(currency)} onClick={() => setSheet(true)}>
              {currency}
              <ExtIcon name="chevron-down" size={16} />
            </button>
            <button type="button" className="max" onClick={max}>
              {PRESALE_TEXT.max}
            </button>
          </div>
          {line === null ? null : (
            <div className="helper error" role="alert">
              <ExtIcon name="alert" size={12} /> {lineText(line, currency, v)}
            </div>
          )}
          <hr />
          <div className="lbl-row">
            <b className="noc-overline">{PRESALE_TEXT.youReceive}</b>
            <span className="noc-caption">{sub}</span>
          </div>
          <div className="est">
            <span className="noc-balance-md noc-numeral">{estimate === null ? '—' : showAmount('NOC', estimate)}</span>
            <span className="ticker">NOC</span>
          </div>
        </div>
        {v.allocation.exists && v.allocation.totalBase > 0n ? (
          <div className="receipt">
            <div className="row">
              <span className="l noc-body-sm">{PRESALE_TEXT.allocation}</span>
              <span className="r app-pre-stack">
                <span className="noc-body-sm noc-numeral">{`${showAmount('NOC', v.allocation.totalBase)} NOC`}</span>
                <span className="noc-caption app-pre-claimable">{PRESALE_TEXT.claimable}</span>
              </span>
            </div>
          </div>
        ) : null}
        <button type="button" className="geo-link noc-body-sm" onClick={onRegion}>
          {PRESALE_TEXT.region}
        </button>
      </>
    );
  }

  const showBuy = loading || open !== null;
  return (
    <>
      <div className="screen s-pre">
        <TopBar title={PRESALE_TEXT.title} titleClass="noc-h3" onBack={onBack} />
        <div className="scroll">{body}</div>
        {record !== null ? (
          <div className="sticky-bar">
            <button type="button" className="btn btn-secondary" onClick={onDone}>
              {PRESALE_TEXT.done}
            </button>
          </div>
        ) : showBuy ? (
          <div className="sticky-bar">
            <LockedButton className="btn btn-primary" disabled={!ready} onPress={buy}>
              <ExtIcon name="buy" size={18} />
              {estimate === null || open === null ? PRESALE_TEXT.buyPlain : PRESALE_TEXT.buy(showAmount('NOC', estimate))}
            </LockedButton>
          </div>
        ) : null}
      </div>
      {sheet ? <TokenSheet balances={m.balances} prices={m.prices} selected={currency} tokens={PRESALE_CURRENCIES} onSelect={choose} onClose={() => setSheet(false)} /> : null}
    </>
  );
}
