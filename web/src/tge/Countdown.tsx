/**
 * Two failure modes here look like data, and both are refused explicitly: an unset
 * timestamp must not count from 1970, and a past one must not count through zero.
 * Everything is computed in UTC; only the rendering is local.
 */
export function Countdown({tgeUnix}: {tgeUnix: number | null}) {
  if (tgeUnix === null) return <p>The TGE date is not set yet.</p>;

  const remainingMs = tgeUnix * 1000 - Date.now();
  if (remainingMs <= 0) return <p>TGE has passed.</p>;

  const days = Math.floor(remainingMs / 86_400_000);
  const hours = Math.floor((remainingMs % 86_400_000) / 3_600_000);
  const when = new Date(tgeUnix * 1000).toISOString().slice(0, 10);
  return (
    <p>
      {days} days {hours} hours to TGE ({when})
    </p>
  );
}
