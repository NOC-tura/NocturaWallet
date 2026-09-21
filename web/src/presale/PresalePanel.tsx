import type {PresaleStats} from '../../../core/presale/stats';
import {formatBaseUnits, percentOf} from '../format';

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
      {/*
        Whole NOC for the stage total. Nobody's decision changes at the ninth decimal, and
        "1,279,937.425329514 NOC of 10,240,000 NOC" reads as a leaked internal number rather
        than a progress figure. Full precision stays the default everywhere it is YOUR money:
        a balance and an allocation are shown to the last unit.
      */}
      <p>
        {formatBaseUnits(sold, NOC_DECIMALS, 'NOC', {maxFractionDigits: 0})} of{' '}
        {formatBaseUnits(capacity, NOC_DECIMALS, 'NOC', {maxFractionDigits: 0})} —{' '}
        {percentOf(sold, capacity)}%
      </p>

      {/*
        Nothing about an allocation while there is no wallet to have one. The connect panel
        above already says what connecting is for; a heading over a third "connect a wallet"
        line turns an explanation into nagging, and gives a visitor an empty section to read.
      */}
      {allocation.status === 'disconnected' ? null : (
        <>
          <h3>Your allocation</h3>
          {allocation.status === 'loading' ? <p>Reading…</p> : null}
          {allocation.status === 'ok' ? (
            <p>{formatBaseUnits(BigInt(allocation.base), NOC_DECIMALS, 'NOC')}</p>
          ) : null}
          {allocation.status === 'absent' ? <p>No allocation for this wallet</p> : null}
          {allocation.status === 'error' ? (
            <p>Your allocation could not be read. This is a connection problem, not a zero balance.</p>
          ) : null}
        </>
      )}
    </section>
  );
}
