import type {PresaleStats} from '../../../core/presale/stats';
import {formatBaseUnits, percentOf} from '../format';

/**
 * Three states, not a nullable number. "We could not read your allocation" and "you
 * have none" are opposite claims to someone checking whether their money arrived, and
 * a failed RPC call must never be able to produce the second.
 */
export type AllocationState =
  | {status: 'loading'}
  | {status: 'error'}
  | {status: 'absent'}
  | {status: 'ok'; base: string};

const NOC_DECIMALS = 9;

export function PresalePanel({
  stats,
  allocation,
}: {
  stats: PresaleStats;
  allocation: AllocationState;
}) {
  const sold = BigInt(stats.soldInStageBase);
  const capacity = BigInt(stats.stageCapacityBase);

  return (
    <section>
      <h2>Presale</h2>
      {stats.isPaused ? (
        <p>Presale is paused</p>
      ) : (
        <p>
          Stage {stats.displayStage} · ${stats.pricePerNocUsd} per NOC
        </p>
      )}
      <p>
        {formatBaseUnits(sold, NOC_DECIMALS, 'NOC')} of{' '}
        {formatBaseUnits(capacity, NOC_DECIMALS, 'NOC')} — {percentOf(sold, capacity)}%
      </p>

      <h3>Your allocation</h3>
      {allocation.status === 'loading' ? <p>Reading…</p> : null}
      {allocation.status === 'ok' ? <p>{formatBaseUnits(BigInt(allocation.base), NOC_DECIMALS, 'NOC')}</p> : null}
      {allocation.status === 'absent' ? <p>No allocation for this wallet</p> : null}
      {allocation.status === 'error' ? (
        <p>Your allocation could not be read. This is a connection problem, not a zero balance.</p>
      ) : null}
    </section>
  );
}
