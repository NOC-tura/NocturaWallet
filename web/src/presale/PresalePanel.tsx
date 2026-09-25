import type {PresaleStats} from '../../../core/presale/stats';
import {formatBaseUnits, formatAmount, percentOf} from '../format';
import {Icon} from '../ui/Icon';
import type {Credit} from '../../../core/presale/credits';

/**
 * Three states, not a nullable number. "We could not read your allocation" and "you
 * have none" are opposite claims to someone checking whether their money arrived, and
 * a failed RPC call must never be able to produce the second.
 */
export type AllocationState =
  | {status: 'disconnected'}
  | {status: 'loading'}
  | {status: 'error'}
  | {status: 'absent'}
  | {status: 'ok'; base: string; referralBonusBase: string | null};

const NOC_DECIMALS = 9;

/**
 * Drawn to screen #23 of the design file: a stage card carrying a radial accent wash, the
 * price on a baseline row with a muted unit, a 6 px progress rail, and a meta row whose
 * figures are secondary and whose labels are tertiary.
 */
const EXPLORER = 'https://explorer.solana.com/tx/';

/** "773.4843 NOC" → "773.4843". The ticker is rendered on its own, a step smaller. */
const figure = (text: string) => text.replace(/ NOC$/, '');

const day = (t: number | null) =>
  t === null ? '' : new Date(t * 1000).toISOString().slice(0, 10);

export function PresalePanel({
  stats,
  allocation,
  credits = null,
}: {
  stats: PresaleStats;
  allocation: AllocationState;
  /** Itemised non-purchase credits, when they reconcile exactly against the account. */
  credits?: Credit[] | null;
}) {
  const sold = BigInt(stats.soldInStageBase);
  const capacity = BigInt(stats.stageCapacityBase);
  const pct = percentOf(sold, capacity);

  return (
    <section>
      <h2>
        <Icon name="trend-up" />
        Presale
      </h2>

      {/*
        Paused keeps the stage and the price in view, dimmed, with a badge. It used to
        replace them with one sentence; a paused sale still has a price, and a card that
        lost its figures read as a page that had failed to load.
      */}
      <div className={`noc-card noc-card-accent stage${stats.isPaused ? ' is-paused' : ''}`}>
        <div className="stage-top">
          <div className="noc-eyebrow noc-overline">Stage {stats.displayStage}</div>
          {stats.isPaused ? (
            <span className="badge badge-paused">
              <Icon name="pause" />
              Presale is paused
            </span>
          ) : null}
        </div>
        <div className="noc-row">
          <span className="price noc-numeral">${stats.pricePerNocUsd}</span>
          <span className="per">per NOC</span>
        </div>

        {/*
          Whole NOC for the stage total. Nobody's decision changes at the ninth decimal,
          and "1,279,937.425329514 NOC of 10,240,000 NOC" reads as a leaked internal
          number rather than a progress figure. Full precision stays the default
          everywhere it is YOUR money: a balance and an allocation are shown to the last unit.
        */}
        {/* Native, so the fill is an attribute rather than an inline width the CSP
            would have to allow. */}
        <progress
          className="noc-progress"
          max={100}
          value={Math.min(100, pct)}
          aria-label={`${pct}% of this stage sold`}
        />
        <div className="noc-meta noc-body-sm noc-numeral">
          <span>
            <b>{formatBaseUnits(sold, NOC_DECIMALS, 'NOC', {maxFractionDigits: 0})}</b> of{' '}
            {formatBaseUnits(capacity, NOC_DECIMALS, 'NOC', {maxFractionDigits: 0})}
          </span>
          <b>{pct}%</b>
        </div>
      </div>

      {/*
        Nothing about an allocation while there is no wallet to have one. The connect panel
        above already says what connecting is for; a heading over a third "connect a wallet"
        line turns an explanation into nagging, and gives a visitor an empty section to read.
      */}
      {allocation.status === 'disconnected' ? null : (
        <div className="noc-card-quiet alloc">
          <span className="noc-overline noc-dim">Your allocation</span>
          {allocation.status === 'loading' ? <p className="reading noc-body">Reading…</p> : null}
          {allocation.status === 'ok' ? (
            /* Four decimals on screen, the exact figure on hover. The chain stores nine;
               the last of them are worth fractions of a cent and read as a leak. The
               number leads and the ticker steps down, as everywhere in the redesign. */
            <p
              data-testid="allocation"
              className="amt-lg"
              title={formatAmount(BigInt(allocation.base), NOC_DECIMALS, 'NOC').exact}
            >
              <span className="noc-balance-lg noc-numeral">
                {figure(formatAmount(BigInt(allocation.base), NOC_DECIMALS, 'NOC').text)}
              </span>{' '}
              <span className="noc-ticker">NOC</span>
            </p>
          ) : null}
          {/*
            Named, because otherwise the total cannot be checked. Whatever is in this
            field arrived WITHOUT a purchase of the holder's own, so someone adding up
            their own history comes up short by exactly this much with no way to see why.

            The wording says "not from your own purchases" and NOT "referral bonus",
            which it said until 2026-09-22 and which was wrong. PresaleAllocation
            .referral_bonus_tokens has three writers and only two of them are referrals:
            presale_purchase_with_sol (lib.rs:384) and coordinator_mint_and_vest_stake
            (2445) add a referral bonus, while admin_add_allocation (744) adds an admin
            giveaway to the recipient themselves — the program's own comment there says
            "reuse existing field for giveaway tracking". One mainnet account carries
            both: 80.539640239 awarded + 40.247084996 given = 120.786725235, verified by
            enumerating that PDA's transactions. Calling the whole of it a referral bonus
            would have told that holder they earned 40 NOC from referrals they never made.

            The page cannot tell the two apart without walking the account's history, and
            it does not need to: what is true of all three writers, and is the reason the
            line exists at all, is that none of them is a purchase of yours.
          */}
          {allocation.status === 'ok' &&
          allocation.referralBonusBase !== null &&
          BigInt(allocation.referralBonusBase) > 0n ? (
            <p
              className="noc-caption noc-dim noc-numeral"
              title={formatAmount(BigInt(allocation.referralBonusBase), NOC_DECIMALS, 'NOC').exact}
            >
              includes{' '}
              {formatAmount(BigInt(allocation.referralBonusBase), NOC_DECIMALS, 'NOC').text} that
              did not come from your own purchases — a referral bonus, or an allocation added
              by the project
            </p>
          ) : null}
          {/*
            Checkable, not just stated. Every other number on this page can be taken to the
            chain and confirmed; until now this one could not, and on 2026-09-23 a mainnet
            account appeared whose ENTIRE allocation was a credit — 188.607594936 NOC with
            no purchases at all, and nothing its owner could check it against.

            Shown only when the items add up to the account's own figure exactly. The
            referral log names no recipient, so on an account that is both a buyer and a
            referrer the sum overshoots, the check fails, and the sentence above stands
            alone — less informative, never wrong.
          */}
          {credits !== null && credits.length > 0 ? (
            <ul className="credits">
              {credits.map(c => (
                <li key={c.signature} className="noc-caption noc-dim">
                  <span className="noc-numeral">
                    {formatAmount(c.base, NOC_DECIMALS, 'NOC').text}
                  </span>{' '}
                  {c.kind === 'giveaway' ? 'added by the project' : 'referral bonus'}
                  {c.blockTime !== null ? ` · ${day(c.blockTime)}` : ''}{' '}
                  <a
                    className="noc-mono"
                    href={`${EXPLORER}${c.signature}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    title={c.signature}
                  >
                    {c.signature.slice(0, 8)}…
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          {allocation.status === 'absent' ? (
            <p className="noc-body noc-muted">No allocation for this wallet</p>
          ) : null}
          {allocation.status === 'error' ? (
            <p className="read-error noc-body-sm">
              <Icon name="alert" />
              Your allocation could not be read. This is a connection problem, not a zero balance.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
