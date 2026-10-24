import {useEffect, useMemo, useState} from 'react';
import {useWallet} from '../WalletContext';
import {TopBar} from '../ui/TopBar';
import {ExtIcon} from '../ui/ExtIcon';
import {SkelLine} from '../ui/Skeleton';
import {regionText} from '../ui/regionName';
import {presaleClient, type GeoReason} from './client';
import {GEO_SUB_TEXT, GEO_TEXT} from './text';

/** What #50b shows: the gate's reason (null: open, C18) and the detected country when the gate named one. */
interface Shown {
  reason: GeoReason | null;
  countryCode: string | null;
}

/**
 * #50b region blocked, presale (B1d §4.3; index.html #50 ix 19612-19906, the 50b phone): one `presale.view` on every
 * mount — a fresh `/geo/check` ("Re-checked at every presale screen mount") — and the gate's answer as drawn: the hero
 * (headline and sub for the reason), the region card (the country for `sanctioned`, a stale list and the open variant
 * (D22), as the gate detected it; otherwise the coarse-geo disclosure alone), the reason row, "Why this matters", the info banner and
 * "What still works". The background decides (C3): a view that is not the gate's closed answer was answered with the
 * gate open (it is asked first, §2.2), so it is the open variant (Q20); a view that failed is `no_check` — closed. The
 * design's flag tile, "claim_ix", "Stake existing NOC" and the post-TGE claim line are omitted (§9).
 */
export function Geo({onBack, onClose, onDone}: {onBack: () => void; onClose: () => void; onDone: () => void}) {
  const m = useWallet();
  const account = m.account?.publicKey ?? null;
  const client = useMemo(() => presaleClient(m.engine), [m.engine]);
  const {reload} = m;
  const [shown, setShown] = useState<{account: string; shown: Shown} | null>(null);

  useEffect(() => {
    if (account === null) return;
    let alive = true;
    void client.view(account).then(r => {
      if (!alive) return;
      if (!r.ok && r.error === 'locked') {
        void reload();
        return;
      }
      const v = r.ok ? r.data : null;
      const next: Shown = v === null ? {reason: 'no_check', countryCode: null} : !v.open && v.why === 'geo' ? {reason: v.geo.reason ?? 'no_check', countryCode: v.geo.countryCode} : {reason: null, countryCode: v.open ? v.countryCode : null};
      setShown({account, shown: next});
    });
    return () => {
      alive = false;
    };
  }, [account, client, reload]);

  const s = shown !== null && shown.account === account ? shown.shown : null;
  const close = (
    <button type="button" className="icon-btn" aria-label={GEO_TEXT.close} onClick={onClose}>
      <ExtIcon name="close" size={22} />
    </button>
  );

  let body;
  if (s === null) {
    body = (
      <div className="s11-geo-hero" aria-busy="true">
        <SkelLine width={72} height={72} />
        <SkelLine width={260} height={26} />
        <SkelLine width={240} />
      </div>
    );
  } else {
    const {reason} = s;
    const headline = reason === null ? GEO_TEXT.open : reason === 'sanctioned' ? GEO_TEXT.sanctioned : GEO_TEXT.closed;
    // §4.3: the country for `sanctioned`, a stale list and the open variant (D22) when the gate named one; the disclosure
    // line only otherwise.
    const country = s.countryCode !== null && (reason === null || reason === 'sanctioned' || reason === 'stale_list') ? regionText(s.countryCode) : null;
    const row = reason === null ? null : reason === 'sanctioned' ? [GEO_TEXT.geofence, GEO_TEXT.geofenceSub] : [GEO_TEXT.checkRequired, reason === 'refused' ? GEO_TEXT.refusedSub : GEO_TEXT.checkRequiredSub];
    body = (
      <>
        <div className="s11-geo-hero">
          <div className={reason === null ? 'glyph' : 'glyph app-geo-warn'}>
            <ExtIcon name={reason === null ? 'globe' : 'lock'} size={32} />
          </div>
          <h2 className="noc-h2">{headline}</h2>
          {reason === null ? null : <p className="noc-body app-geo-sub">{GEO_SUB_TEXT[reason]}</p>}
        </div>
        <div className="s11-geo-region">
          <div className="col">
            {country === null ? null : <div className="noc-body app-geo-primary">{GEO_TEXT.region(country)}</div>}
            <div className="noc-caption app-geo-tertiary app-geo-disclosure">{GEO_TEXT.disclosure}</div>
          </div>
        </div>
        <div className="card app-geo-card">
          {row === null ? null : (
            <div className="s11-reason-row">
              <div className="ico app-geo-warn">
                <ExtIcon name="lock" size={18} />
              </div>
              <div className="body">
                <div className="noc-body app-geo-primary">{row[0]}</div>
                <div className="noc-caption app-geo-tertiary">{row[1]}</div>
              </div>
            </div>
          )}
          <div className="s11-reason-row">
            <div className="ico">
              <ExtIcon name="file-text" size={18} />
            </div>
            <div className="body">
              <div className="noc-body app-geo-primary">{GEO_TEXT.why}</div>
              <div className="noc-caption app-geo-tertiary">{GEO_TEXT.whySub}</div>
            </div>
          </div>
        </div>
        <div className="banner app-geo-banner">
          <ExtIcon name="info" size={18} />
          <div>
            <div className="noc-body-sm app-geo-primary">{GEO_TEXT.lifts}</div>
            <div className="noc-caption app-geo-tertiary app-geo-disclosure">{GEO_TEXT.rechecked}</div>
          </div>
        </div>
        {reason === null ? null : (
          <div className="s11-stillworks">
            <div className="head">
              <ExtIcon name="check" size={18} />
              <span className="noc-overline app-geo-works">{GEO_TEXT.works}</span>
            </div>
            <ul>
              <li>{GEO_TEXT.sendReceive}</li>
              <li>{GEO_TEXT.balances}</li>
            </ul>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="screen">
      <TopBar title={GEO_TEXT.title} titleClass="noc-h1-compact" onBack={onBack} trailing={close} />
      <div className="app-geo-body">{body}</div>
      <div className="sticky-bar">
        <button type="button" className="btn btn-primary" onClick={onDone}>
          {GEO_TEXT.gotIt}
        </button>
      </div>
    </div>
  );
}
