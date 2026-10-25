import {useEffect, useId, useRef, useState, type ReactNode} from 'react';
import {AddressGroups} from '../../../web/src/ui/AddressGroups';
import {ExtIcon} from '../app/ui/ExtIcon';
import {LockedButton} from '../app/ui/LockedButton';
import {regionName} from '../app/ui/regionName';
import {SkelCircle, SkelLine} from '../app/ui/Skeleton';
import {feeUsd, shortAddress, showSol} from '../app/format';
import {fromBook} from '../app/addressBook';
import {formatAmount} from '../shared/amount';
import {dependsOnStep, type AddressLabel, type Approval, type BalanceChange, type Decision, type DecodedInstruction, type FieldValue, type Flag, type ProgramKey, type RequestView, type TxDetail, type TxItem} from './client';
import {BlockSite, BudgetNotice, ConfirmButton, LookalikeBanner, OriginCard, RiskConfirm, Spinner, Waiting, WindowTop, siteLabel} from './ui';
import {ARM_MS, FLAG_HOLD_MS, useArmed} from './useArmed';
import {FLAG_TEXT, SIGN_TEXT, TX_TEXT, WINDOW_TEXT} from './strings';

/** The design's mono program names (#48: "jupiter_v6", "spl_token"), for the programs the wallet decodes. */
const PROGRAM_NAMES: Record<ProgramKey, string> = {
  system: 'system_program',
  token: 'spl_token',
  'token-2022': 'spl_token_2022',
  'associated-token': 'spl_associated_token_account',
  'compute-budget': 'compute_budget',
  presale: 'noctura_presale',
};
/** B1c-3: the token programs an address field can name (an ATA create's `tokenProgram`), shown by their mono name beside the address. */
const TOKEN_PROGRAMS: Readonly<Partial<Record<string, ProgramKey>>> = {
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: 'token',
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: 'token-2022',
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

const U64_MAX = '18446744073709551615';
const TILES: Readonly<Record<string, string>> = {NOC: 'noc', USDC: 'usdc', USDT: 'usdt'};
/** An approval's amount with the mint's decimals, bare — no symbol (fix round 1 Minor 1: `FLAG_TEXT.bounded` appends its own). */
const approvalValue = (a: Approval): string => (a.decimals === null ? a.amount : formatAmount(BigInt(a.amount), a.decimals, {min: 0, max: a.decimals}));
/** An approval's amount as the user reads it: the bare value, with the wallet's symbol appended when known. */
const approvalAmount = (a: Approval): string => {
  const value = approvalValue(a);
  return a.symbol === null ? value : `${value} ${a.symbol}`;
};
const approvalsOf = (item: TxItem): Approval[] => (item.flags ?? []).flatMap(f => (f.kind === 'unlimited-approve' || f.kind === 'bounded-approve' ? f.approvals : []));

/**
 * B1c-3 (spec §3.3 "Banners", the design's ix:18358-18364): an approve changes no balance, so its row is synthesized from
 * the flag — "<SYM> delegated", "unlimited" / "≈ all current + future" at u64::MAX, else the amount.
 */
function delegatedRow(a: Approval): {key: string; tile: string; tileText: string; name: string; delta: string; neg: boolean; fiat: string | null} {
  const known = a.symbol === null ? undefined : TILES[a.symbol];
  const max = a.amount === U64_MAX;
  return {
    key: `delegated:${a.source}`,
    tile: known === undefined ? 'ico app-tok-other' : `ico s8-tok ${known}`,
    tileText: a.symbol ?? '?',
    name: FLAG_TEXT.delegated(a.symbol ?? shortAddress(a.mint ?? a.source)),
    delta: max ? FLAG_TEXT.unlimited : (a.decimals === null ? a.amount : formatAmount(BigInt(a.amount), a.decimals, {min: 0, max: a.decimals})),
    neg: true,
    fiat: max ? FLAG_TEXT.allFuture : null,
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
  // F10 (Q49): a step that depends on an earlier one was not simulated on its own — its effects are unknown, said so.
  if (!item.outcome.ok && item.outcome.error === 'dependent') {
    return (
      <div className="s9-bal-card">
        <span className="label">{FLAG_TEXT.balanceUnknown}</span>
        <p className="noc-body-sm app-dim app-tx-none">{FLAG_TEXT.balanceUnknownLine}</p>
      </div>
    );
  }
  if (!item.outcome.ok) return null;
  const rows = [...approvalsOf(item).map(delegatedRow), ...item.outcome.changes.map(changeRow)];
  const authority = (item.flags ?? []).some(f => f.kind === 'assign' || f.kind === 'set-authority');
  return (
    <div className="s9-bal-card">
      <span className="label">{TX_TEXT.balancePost}</span>
      {rows.length === 0 ? <p className="noc-body-sm app-dim app-tx-none">{authority ? FLAG_TEXT.noChangesAuthority : TX_TEXT.noChanges}</p> : null}
      {rows.map(r => (
        <div className="s9-bal-row" key={r.key}>
          <div className={r.tile}>{r.tileText}</div>
          <div>
            <div className={r.name === r.tileText || r.name === FLAG_TEXT.delegated(r.tileText) ? 'pri' : 'pri noc-mono'}>{r.name}</div>
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
      const program = TOKEN_PROGRAMS[value.value];
      return (
        <>
          <AddressGroups address={value.value} />
          {label !== undefined ? (
            <span className="app-tx-addr-label noc-caption">{label.kind === 'account' ? TX_TEXT.ownAccount(label.name) : fromBook(label.name)}</span>
          ) : program !== undefined ? (
            <span className="app-tx-addr-label noc-caption">{PROGRAM_NAMES[program]}</span>
          ) : null}
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
                    decode the fields of (mintTo, withdrawNonceAccount, initializeMint, …) never looks fully decoded. */}
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
          {/* Final review MUST-FIX 2: one numeral style on #48 — the design's (ix:18302 "0.000050 SOL", the deltas'
              "−0.0000050"): ungrouped digits for the fee as for the balance changes, never #27's grouped fee line. */}
          <span className="v noc-numeral">{showSol(BigInt(item.feeLamports))} SOL</span>
        </div>
      )}
    </div>
  );
}

/** An instruction's own name as a banner shows it: `transferChecked` → `TransferChecked`, an Anchor IDL's snake_case
 *  `presale_purchase_with_sol` → `PresalePurchaseWithSol` (owner-delegated copy call, 2026-10-25). */
export const bannerInstruction = (name: string): string => name.split('_').map(w => `${w.charAt(0).toUpperCase()}${w.slice(1)}`).join('');
/** An instruction as the banners name it, the design's way (ix:18352 `spl_token::Approve`): program, then the instruction's own name. */
function instructionName(item: TxItem, at: number | null): string | null {
  const ix = at === null ? undefined : item.instructions?.[at];
  if (ix === undefined || ix.program === null) return null;
  const name = ix.name === null ? TX_TEXT.unknownInstruction : bannerInstruction(ix.name);
  return `${PROGRAM_NAMES[ix.program]}::${name}`;
}
/** A meta line's instruction (Q55): "#<n> <program>::<Instruction>", n 1-based as "Program <n>" counts. */
const instructionMeta = (item: TxItem, at: number): string => `#${at + 1} ${instructionName(item, at) ?? TX_TEXT.unknownInstruction}`;
const Addr = ({address}: {address: string | null}) => (address === null ? <>—</> : <AddressGroups address={address} />);

function FlagBanner({tone, head, body, meta}: {tone: 'danger' | 'warn'; head: ReactNode; body?: ReactNode[]; meta?: ReactNode[]}) {
  return (
    <div className={`s9-flag-banner ${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <ExtIcon name="alert-triangle" size={18} />
      <div>
        <p className="head">{head}</p>
        {(body ?? []).map((b, i) => (
          <p className="body" key={i}>
            {b}
          </p>
        ))}
        {(meta ?? []).map((m, i) => (
          <p className="meta" key={i}>
            {m}
          </p>
        ))}
      </div>
    </div>
  );
}

/** The design's meta line (ix:18353): "delegate: … · token: USDC mint … · scope: u64::MAX" — every address whole (Q55). */
const approvalMeta = (a: Approval): ReactNode => (
  <>
    {FLAG_TEXT.meta.delegate}
    <Addr address={a.delegate} />
    {FLAG_TEXT.meta.token}
    {a.symbol === null ? '' : `${a.symbol} `}
    {FLAG_TEXT.meta.mint}
    <code>
      <Addr address={a.mint} />
    </code>
    {FLAG_TEXT.meta.scope}
    {a.amount === U64_MAX ? FLAG_TEXT.meta.max : approvalAmount(a)}
  </>
);

/** F5's body: the design's at u64::MAX (decoded), Q42 below it, Q43 when only the chain state shows it — "all or nearly all" below u64::MAX (O5). */
function unlimitedBody(item: TxItem, a: Approval): ReactNode {
  const all = <i>{a.amount === U64_MAX ? FLAG_TEXT.all(a.symbol) : FLAG_TEXT.nearlyAll(a.symbol)}</i>;
  const ix = instructionName(item, a.at);
  if (ix === null) {
    const [lead, future, untilRevoke, exploited] = FLAG_TEXT.unlimitedChain;
    return (
      <>
        {lead}
        {all}
        {a.amount === U64_MAX ? future : untilRevoke}
        {exploited}
      </>
    );
  }
  if (a.amount === U64_MAX) {
    const [lead, withAmount, max, units, end] = FLAG_TEXT.unlimitedMax;
    return (
      <>
        {lead}
        <code>{ix}</code>
        {withAmount}
        <code>{max}</code>
        {units}
        {all}
        {end}
      </>
    );
  }
  const [lead, forAmount, whole, end] = FLAG_TEXT.unlimitedWhole;
  return (
    <>
      {lead}
      <code>{ix}</code>
      {forAmount}
      <code>{`amount = ${a.amount}`}</code>
      {whole}
      {all}
      {end}
    </>
  );
}

/** O9: "unlimited" is said only of u64::MAX — an F5 any of whose approvals is u64::MAX. */
const unlimitedMax = (f: Flag): boolean => f.kind === 'unlimited-approve' && f.approvals.some(a => a.amount === U64_MAX);

/** One flag's banner (spec §3.3 "Banners"): a block `.s9-flag-banner danger`, a warning `warn`; head, body, meta. */
function flagBanner(item: TxItem, f: Flag, key: number): ReactNode {
  switch (f.kind) {
    case 'unlimited-approve':
      return (
        <FlagBanner key={key} tone="danger" head={(unlimitedMax(f) ? FLAG_TEXT.unlimitedHead : FLAG_TEXT.nearlyAllHead)(f.word === 'UNLIMITED' || f.word === 'ALLOWANCE' ? null : f.word)} body={f.approvals.map(a => unlimitedBody(item, a))} meta={f.approvals.map(approvalMeta)} />
      );
    case 'bounded-approve':
      return (
        <FlagBanner key={key} tone="warn" head={FLAG_TEXT.boundedHead(f.approvals.length === 1 ? (f.approvals[0]?.symbol ?? null) : null)} body={f.approvals.map(a => FLAG_TEXT.bounded(approvalValue(a), a.symbol))} meta={f.approvals.map(approvalMeta)} />
      );
    case 'assign':
      return (
        <FlagBanner
          key={key}
          tone="danger"
          head={FLAG_TEXT.assignHead}
          body={[FLAG_TEXT.assign]}
          meta={[
            ...f.instructions.map(ix => instructionMeta(item, ix.index)),
            ...(f.chain === null
              ? []
              : [
                  <>
                    {`${FLAG_TEXT.postSimulation} · owner: `}
                    <Addr address={f.chain.owner} />
                    {` · space: ${f.chain.space}`}
                  </>,
                ]),
          ]}
        />
      );
    case 'set-authority':
      return (
        <FlagBanner
          key={key}
          tone="danger"
          head={FLAG_TEXT.authorityHead}
          body={[FLAG_TEXT.authority]}
          meta={[
            ...f.instructions.map(ix => (
              <>
                {`${instructionMeta(item, ix.index)} · authorityType: ${ix.authorityType} · account: `}
                <Addr address={ix.account} />
                {' · newAuthority: '}
                <Addr address={ix.newAuthority} />
              </>
            )),
            ...f.chain.map(c => (
              <>
                {`${FLAG_TEXT.postSimulation} · ${c.change}: `}
                <Addr address={c.from} />
                {' → '}
                <Addr address={c.to} />
                {' · account: '}
                <Addr address={c.account} />
              </>
            )),
          ]}
        />
      );
    case 'dependent': {
      // Q32's <N>: only through dependsOnStep (client.ts) — never the outcome's `on` or a flag index read raw.
      const step = dependsOnStep(item);
      if (step === null) return null;
      return <FlagBanner key={key} tone="danger" head={FLAG_TEXT.dependsOn(step)} body={[FLAG_TEXT.dependent(step)]} meta={item.outcome !== null && !item.outcome.ok ? [item.outcome.detail] : []} />;
    }
    case 'unknown-program':
      return <FlagBanner key={key} tone="warn" head={FLAG_TEXT.unknownHead} body={[FLAG_TEXT.unknown]} meta={f.programs.map(p => (p === null ? FLAG_TEXT.unknownNull : <AddressGroups address={p} />))} />;
    case 'non-transfer':
      return <FlagBanner key={key} tone="warn" head={FLAG_TEXT.nonTransferHead} body={[FLAG_TEXT.nonTransfer]} meta={f.instructions.map(ix => instructionMeta(item, ix.index))} />;
    case 'token-2022': {
      const mint = (
        <>
          {'mint: '}
          <AddressGroups address={f.mint} />
        </>
      );
      if (f.settings === null) return <FlagBanner key={key} tone="warn" head={FLAG_TEXT.unreadable} meta={[mint]} />;
      const s = f.settings;
      const lines: [string, string, string | null][] = [
        [FLAG_TEXT.freeze, 'freezeAuthority', s.freezeAuthority],
        [FLAG_TEXT.permanentDelegate, 'permanentDelegate', s.permanentDelegate],
        [FLAG_TEXT.transferHook, 'transferHookProgram', s.transferHookProgram],
      ];
      const set = lines.filter((l): l is [string, string, string] => l[2] !== null);
      return (
        <FlagBanner
          key={key}
          tone="warn"
          head={FLAG_TEXT.token2022Head}
          body={set.map(l => l[0])}
          meta={[
            mint,
            ...set.map(l => (
              <>
                {`${l[1]}: `}
                <AddressGroups address={l[2]} />
              </>
            )),
          ]}
        />
      );
    }
    case 'durable-nonce':
      return <FlagBanner key={key} tone="warn" head={FLAG_TEXT.nonce} meta={[instructionMeta(item, f.at)]} />;
    case 'whole-balance':
      return <FlagBanner key={key} tone="warn" head={FLAG_TEXT.wholeHead} body={[FLAG_TEXT.whole]} />;
    // B1d §3.6 (F12): Q49, Q50a with the country's name for a sanctioned region, Q50b for every fail-closed reason, Q51.
    case 'presale-region':
      return <FlagBanner key={key} tone="danger" head={FLAG_TEXT.regionHead} body={[f.reason === 'sanctioned' && f.countryCode !== null ? FLAG_TEXT.regionSanctioned(regionName(f.countryCode)) : FLAG_TEXT.regionClosed]} meta={[FLAG_TEXT.regionMeta]} />;
    // Fix round 1 Minor 2: exhaustive at compile time — a new Flag kind fails to build here, rather than rendering
    // silently as no banner (`ReactNode` includes `undefined`, so a missing case would otherwise compile clean).
    default: {
      const exhaustive: never = f;
      return exhaustive;
    }
  }
}

/** A transaction's banners: B1d's F12 first, then its blocks, then its warnings (spec §3.3 "Banners"), each as the background listed it. */
function FlagBanners({item}: {item: TxItem}) {
  const flags = item.flags ?? [];
  const ordered = [...flags.filter(f => f.severity === 'refuse'), ...flags.filter(f => f.severity === 'block'), ...flags.filter(f => f.severity === 'warn')];
  return <>{ordered.map((f, i) => flagBanner(item, f, i))}</>;
}

/** One block's typed field (spec §3.3 "The typed field"; the design's `.s9-typed-confirm`, ix:18378-18381). */
export interface TypedField {
  key: string;
  tx: number;
  word: string;
}
function TypedConfirm({field, value, onChange}: {field: TypedField; value: string; onChange: (v: string) => void}) {
  const id = useId();
  const [lead, tail] = FLAG_TEXT.typed;
  return (
    <div className="s9-typed-confirm">
      <label className="label" htmlFor={id}>
        {lead}
        <code>{field.word}</code>
        {tail}
      </label>
      {/* Never pre-filled, never focused at open; an exact, case-sensitive match — no trimming, no case folding. */}
      <input id={id} className={value === field.word ? 'input match' : 'input'} value={value} autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck={false} onChange={e => onChange(e.target.value)} />
      <p className="noc-caption app-dim app-typed-help">{FLAG_TEXT.typedHelp}</p>
    </div>
  );
}

/** Every block's field: one per (transaction, kind) — `tx` the 0-based index the background reads (Task 4). */
const typedFieldsOf = (d: TxDetail | null): TypedField[] =>
  (d?.transactions ?? []).flatMap((t, tx) => (t.flags ?? []).flatMap(f => (f.severity === 'block' ? [{key: `${tx}:${f.kind}`, tx, word: f.word}] : [])));

type TxState = 'simulating' | 'ready' | 'failed' | 'expired' | 'unreachable' | 'refused';
function stateOf(d: TxDetail | null): TxState | null {
  if (d === null) return null;
  if (d.simulation.status === 'simulating') return 'simulating';
  if (d.simulation.status === 'unreachable') return 'unreachable';
  const outcomes = d.transactions.map(t => t.outcome);
  if (outcomes.some(o => o !== null && !o.ok && o.error === 'expired')) return 'expired';
  // B1c-3 (F10, O2): a step that depends on an earlier one is no failure here — its own block (UNCHECKED) gates it.
  if (outcomes.some(o => o === null || (!o.ok && o.error !== 'dependent'))) return 'failed';
  // B1d §3.6 (F12): a presale purchase the region check did not open — only Reject, no typed field.
  if (d.transactions.some(t => (t.flags ?? []).some(f => f.kind === 'presale-region'))) return 'refused';
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
 *  - couldn't simulate / unreachable / blockhash expired (Q21): only Reject — a step that depends on an earlier one
 *    of the batch (F10, O2) excepted: it is a block of its own (B1c-3);
 *  - lookalike: the banner and the flipped bar — [Reject and report], "Approve anyway (not recommended)" → the
 *    2-second confirm;
 *  - approving: "Approving", the body at .65, "Approving…" with the ring, every CTA and ✕ disabled;
 *  - the request can no longer be signed (`tx` null): Q26 and only Reject.
 * B1c-3 (spec §3.3 rev 3.6) renders the background's red flags in each transaction's section — blocks first, then
 * warnings — with one typed field per (transaction, block kind); the CTA is the design's red "Approve unlimited" for
 * unlimited approves only, "Approve anyway" (Q34) for any other block, greyed as #37's until every field matches, and
 * the approval sends the matched words (`overrides`). A lookalike origin with a block passes both gates: the typed
 * fields enable its demoted "Approve anyway (not recommended)", which then opens the 2-second confirm.
 * B1d §3.6 (F12): a presale purchase the jurisdiction gate did not open is `refused` — its banner first in its section,
 * the eyebrow "Critical · Blocked transaction", no typed field, and only Reject (no word opens it).
 * C15 holds Approve (and its demoted forms) 500 ms after focus and after each state change — the request, a new
 * simulation, the re-authentication's state, busy, every typed field's match; on a screen with any flag, 1.5 s (B1 §3).
 * Reject is never held.
 */
export function Tx({request, waiting, notice, busy, onDecide}: {request: RequestView; waiting: number; notice: boolean; busy: boolean; onDecide: (d: Decision) => Promise<unknown>}) {
  const detail = request.tx;
  const lookalike = request.site.kind === 'lookalike';
  const [confirming, setConfirming] = useState(false);
  // Fix round 1, I2: the simulation the sheet was opened against — sent explicitly on proceed, never whatever is
  // current by then (the background answers `stale` for a newer one; §2.3's own fail-closed check, named twice).
  const [confirmSimId, setConfirmSimId] = useState<string | null>(null);
  // Review 1 L4: the last approval was refused `stale` (a refresh landed): say why the click did nothing, until the next one.
  // Final review I3: or refused `out-of-date` (the simulation it named is the newest, but old; its refresh has not
  // landed) — that line is true only while that simulation is the one shown, so it goes when the refresh lands.
  const [refused, setRefused] = useState<{kind: 'stale' | 'out-of-date'; simId: string} | null>(null);
  const simId = detail !== null && detail.simulation.status === 'ok' ? detail.simulation.id : 'none';
  // B1c-3: what the user typed per (transaction, kind), for the simulation it was typed against — a new one empties every
  // field (review 1 L1); a match is exact — `===`, no trimming, no case folding.
  const [typedFor, setTypedFor] = useState<{simId: string; words: Readonly<Record<string, string>>}>({simId: 'none', words: {}});
  const typed = typedFor.simId === simId ? typedFor.words : {};
  const fields = typedFieldsOf(detail);
  const matches = fields.map(f => typed[f.key] === f.word);
  const allMatch = matches.every(m => m);
  const flagged = (detail?.transactions ?? []).some(t => (t.flags ?? []).length > 0);
  const armed = useArmed([request.requestId, simId, detail?.reauth?.state ?? 'none', confirming, busy, matches.map(m => (m ? 1 : 0)).join('')].join('|'), flagged ? FLAG_HOLD_MS : ARM_MS);
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
  const canApprove = ready && !reauthWaiting && !busy && allMatch;
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
          {/* Final review MUST-FIX 2: Q26 is drawn as Q21 is — a danger flag banner (#48's own `.s9-flag-banner danger`). */}
          <div className="s9-flag-banner danger app-tx-block" role="alert">
            <ExtIcon name="alert-triangle" size={18} />
            <div>
              <p className="head">{SIGN_TEXT.cannotSign}</p>
            </div>
          </div>
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
    setRefused(null);
    const sentSimId = overrideSimId ?? (detail.simulation.status === 'ok' ? detail.simulation.id : undefined);
    // B1c-3: the words of the fields that match, and only those (the background recomputes every expected word).
    const overrides = fields.flatMap(f => (typed[f.key] === f.word ? [{tx: f.tx, word: typed[f.key] ?? ''}] : []));
    const reply = await onDecide({decision: 'approve', account: detail.account.publicKey, ...(sentSimId !== undefined ? {simulation: sentSimId} : {}), ...(overrides.length > 0 ? {overrides} : {})});
    if (!alive.current) return;
    const error = typeof reply === 'object' && reply !== null && 'error' in reply ? reply.error : null;
    if (error === 'stale' || error === 'out-of-date') setRefused({kind: error, simId: sentSimId ?? 'none'});
  };
  const stale = refused !== null && refused.kind === 'stale';
  const outOfDate = refused !== null && refused.kind === 'out-of-date' && refused.simId === simId;
  const n = detail.transactions.length;
  // B1d §3.6: F12 in any transaction — the eyebrow says the transaction is blocked, whatever else the simulation says.
  const regionBlocked = detail.transactions.some(t => (t.flags ?? []).some(f => f.kind === 'presale-region'));
  const blocks = ready ? detail.transactions.flatMap(t => (t.flags ?? []).filter(f => f.severity === 'block')) : [];
  // The design's red "Approve unlimited" (and its eyebrow) only when every block is an F5 and one is of u64::MAX (O9);
  // every block an F5 below it: Q57's eyebrow and Q34's CTA.
  const approvalsOnly = blocks.length > 0 && blocks.every(f => f.kind === 'unlimited-approve');
  const unlimitedOnly = approvalsOnly && blocks.some(unlimitedMax);
  const overline = busy ? TX_TEXT.overlineApproving : regionBlocked ? FLAG_TEXT.overlineBlocked : unlimitedOnly ? FLAG_TEXT.overlineUnlimited : approvalsOnly ? FLAG_TEXT.overlineLarge : blocks.length > 0 ? FLAG_TEXT.overlineBlocked : lookalike ? TX_TEXT.overlineLookalike : TX_TEXT.overline;
  return (
    <div className="screen app-approve">
      <WindowTop overline={overline} tone={!busy && (lookalike || blocks.length > 0 || regionBlocked) ? 'danger' : 'neutral'} onClose={reject} disabled={busy || simulating} />
      <div className={busy ? 'scroll-area app-approve-scroll app-tx-busy' : 'scroll-area app-approve-scroll'}>
        {notice ? <BudgetNotice /> : null}
        <div className="app-origin-slot">
          <OriginCard site={request.site} origin={request.origin} host={request.host} />
        </div>
        {lookalike ? <LookalikeBanner site={request.site} host={request.host} /> : null}
        {/* Review 1 L7: who broadcasts — the design draws one screen for both requests. Not on F12's Reject-only screen:
            nothing can be approved there (owner-delegated copy call, 2026-10-25). */}
        {regionBlocked ? null : <p className="noc-caption app-muted app-tx-sends">{detail.kind === 'signAndSendTransaction' ? TX_TEXT.sendsNoctura : TX_TEXT.sendsSite}</p>}
        {(stale || outOfDate) && ready ? (
          <div className="s9-flag-banner warn app-tx-block" role="status">
            <ExtIcon name="alert-triangle" size={18} />
            <div>
              <p className="head">{stale ? TX_TEXT.stale : TX_TEXT.outOfDate}</p>
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
            <FlagBanners item={t} />
            {state === 'failed' || state === 'expired' || state === 'unreachable' ? null : <BalanceCard item={t} simulating={simulating} />}
            <Payload item={t} labels={detail.labels} />
            {ready
              ? fields
                  .filter(f => f.tx === i)
                  .map(f => <TypedConfirm key={f.key} field={f} value={typed[f.key] ?? ''} onChange={v => setTypedFor(prev => ({simId, words: {...(prev.simId === simId ? prev.words : {}), [f.key]: v}}))} />)
              : null}
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
          ) : blocks.length > 0 ? (
            // B1c-3: the design's red CTA (ix:18390) for an unlimited approve, Q34 for any other block; #37's greyed
            // gate (full label, no opacity wash) until every typed field matches.
            <ConfirmButton armed={armed && canApprove} className={allMatch ? 'btn btn-destructive app-cta-wide' : 'btn btn-destructive app-cta-wide app-cta-gated'} onPress={() => approve()}>
              {unlimitedOnly ? <ExtIcon name="alert-triangle" size={18} /> : null}
              {unlimitedOnly ? FLAG_TEXT.approveUnlimited : FLAG_TEXT.approveBlocked}
            </ConfirmButton>
          ) : (
            // Final review MUST-FIX 2: drawn at .4 while simulating (ix:18318) — its own class, in that state only.
            <ConfirmButton armed={armed && canApprove} className={simulating ? 'btn btn-primary app-cta-wide app-cta-simulating' : 'btn btn-primary app-cta-wide'} onPress={approve}>
              {TX_TEXT.approve}
              {simulating ? <span className="app-tx-sim-tag">{TX_TEXT.approveSimulating}</span> : null}
            </ConfirmButton>
          )}
        </div>
      )}
      {confirming ? (
        <RiskConfirm
          holdMs={flagged ? FLAG_HOLD_MS : ARM_MS}
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
