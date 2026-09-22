/**
 * Two failure modes here look like data, and both are refused explicitly: an unset
 * timestamp must not count from 1970, and a past one must not count through zero.
 * Everything is computed in UTC; only the rendering is local.
 */
export function Countdown({tgeUnix}: {tgeUnix: number | null}) {
  if (tgeUnix === null) return <p className="noc-body-sm noc-dim">The TGE date is not set yet.</p>;

  const remainingMs = tgeUnix * 1000 - Date.now();
  if (remainingMs <= 0) return <p className="noc-body-lg">TGE has passed.</p>;

  const days = Math.floor(remainingMs / 86_400_000);
  const hours = Math.floor((remainingMs % 86_400_000) / 3_600_000);
  const when = new Date(tgeUnix * 1000).toISOString().slice(0, 10);
  return (
    <div className="noc-card-quiet">
      <span className="noc-overline noc-dim">Token generation event</span>
      {/* The number carries the weight; the date underneath is the fact it rests on. */}
      <p className="noc-balance-md noc-numeral">
        {days} days {hours} hours
      </p>
      <p className="noc-body-sm noc-dim noc-numeral">{when}</p>
    </div>
  );
}
