import {Icon} from '../ui/Icon';
/**
 * Two failure modes here look like data, and both are refused explicitly: an unset
 * timestamp must not count from 1970, and a past one must not count through zero.
 * Everything is computed in UTC; only the rendering is local.
 *
 * Every state sits in the same card under the same label. "The TGE date is not set yet."
 * used to render bare, with nothing saying what it was about.
 */
export function Countdown({tgeUnix}: {tgeUnix: number | null}) {
  const when = tgeUnix === null ? null : new Date(tgeUnix * 1000).toISOString().slice(0, 10);
  const remainingMs = tgeUnix === null ? 0 : tgeUnix * 1000 - Date.now();

  let figure: React.ReactNode;
  if (tgeUnix === null) {
    figure = <p className="noc-body">The TGE date is not set yet.</p>;
  } else if (remainingMs <= 0) {
    figure = <p className="noc-body-lg">TGE has passed.</p>;
  } else {
    const days = Math.floor(remainingMs / 86_400_000);
    const hours = Math.floor((remainingMs % 86_400_000) / 3_600_000);
    // The number carries the weight; the date beside it is the fact it rests on.
    figure = (
      <p className="noc-balance-md noc-numeral">
        {days} days {hours} hours
      </p>
    );
  }

  return (
    <div className="noc-card tge">
      <div className="tge-main">
        <span className="noc-overline noc-dim tge-label">
          <Icon name="clock" />
          Token generation event
        </span>
        {figure}
      </div>
      {when !== null ? <p className="noc-body-sm noc-dim noc-mono">{when}</p> : null}
    </div>
  );
}
