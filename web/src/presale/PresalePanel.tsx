import type {PresaleStats} from '../../../core/presale/stats';
import {formatBaseUnits, percentOf} from '../format';
import {Icon} from '../ui/Icon';

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
  | {status: 'ok'; base: string};

const NOC_DECIMALS = 9;

/**
 * Drawn to screen #23 of the design file: a stage card carrying a radial accent wash, the
 * price on a baseline row with a muted unit, a 6 px progress rail, and a meta row whose
 * figures are secondary and whose labels are tertiary.
 */
export function PresalePanel({
  stats,
  allocation,
}: {
  stats: PresaleStats;
  allocation: AllocationState;
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

      <div className="noc-card noc-card-accent">
        {stats.isPaused ? (
          <p className="noc-body-lg noc-warning">Presale is paused</p>
        ) : (
          <>
            <div className="noc-eyebrow noc-overline">Stage {stats.displayStage}</div>
            <div className="noc-row">
              <span className="noc-balance-lg noc-numeral">${stats.pricePerNocUsd}</span>
              <span className="noc-ticker">per NOC</span>
            </div>
          </>
        )}

        {/*
          Whole NOC for the stage total. Nobody's decision changes at the ninth decimal,
          and "1,279,937.425329514 NOC of 10,240,000 NOC" reads as a leaked internal
          number rather than a progress figure. Full precision stays the default
          everywhere it is YOUR money: a balance and an allocation are shown to the last unit.
        */}
        <div className="noc-progress" role="img" aria-label={`${pct}% of this stage sold`}>
          <i style={{width: `${Math.min(100, pct)}%`}} />
        </div>
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
        <div className="noc-card-quiet">
          <span className="noc-overline noc-dim">Your allocation</span>
          {allocation.status === 'loading' ? <p className="noc-body noc-muted">Reading…</p> : null}
          {allocation.status === 'ok' ? (
            <p className="noc-balance-md noc-numeral">
              {formatBaseUnits(BigInt(allocation.base), NOC_DECIMALS, 'NOC')}
            </p>
          ) : null}
          {allocation.status === 'absent' ? (
            <p className="noc-body noc-muted">No allocation for this wallet</p>
          ) : null}
          {allocation.status === 'error' ? (
            <p className="noc-body-sm noc-danger">
              Your allocation could not be read. This is a connection problem, not a zero balance.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
