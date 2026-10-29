import {Fragment, useEffect, useMemo, useState} from 'react';
import {useWallet} from '../WalletContext';
import {TopBar} from '../ui/TopBar';
import {ExtIcon} from '../ui/ExtIcon';
import {SkelLine} from '../ui/Skeleton';
import {useCopy} from '../ui/useCopy';
import {presaleClient, type ReferralData} from './client';
import {PRESALE_TEXT, REFER_TEXT, countText, earnedText, referredText} from './text';

/**
 * One of the three stat cards (the design's `.stat`): label, value ("—" when its source failed), sub. A figure wider
 * than its third of the row breaks only after a group separator ("123,456,<wbr>789.0"); one of eight characters or more
 * is set a size smaller ("$1,234.56" holds its third on one line).
 */
function Stat({label, value, sub, tone}: {label: string; value: string | null; sub: string; tone: 'acc' | 'muted' | null}) {
  return (
    <div className="stat">
      <span className="lbl noc-overline">{label}</span>
      {value === null ? (
        <SkelLine width={48} height={26} />
      ) : (
        <span className={`val noc-balance-md noc-numeral${tone === 'acc' ? ' acc' : tone === 'muted' ? ' app-ref-muted' : ''}${value.length >= 8 ? ' app-ref-long' : ''}`}>
          {value.split(',').map((part, i, all) => (
            <Fragment key={i}>
              {part}
              {i < all.length - 1 ? (
                <>
                  ,<wbr />
                </>
              ) : null}
            </Fragment>
          ))}
        </span>
      )}
      <span className="lbl noc-caption">{sub}</span>
    </div>
  );
}

/**
 * The legalese as the design draws it on 24a, 24a-bis and 24b: its words "program terms" in `--accent` (final review T4
 * M1; unlinked until B1e). Split here, at render, so text.ts keeps the sentence whole (its marker, §6.2).
 */
const TERMS_AT = REFER_TEXT.legalese.indexOf(REFER_TEXT.legaleseTerms);
const LEGALESE_LEAD = REFER_TEXT.legalese.slice(0, TERMS_AT);
const LEGALESE_TAIL = REFER_TEXT.legalese.slice(TERMS_AT + REFER_TEXT.legaleseTerms.length);

/**
 * #24 referral (B1d-2, §3.5, §4.4; index.html #24 ix 10903-11233 as the app corrected it, C1): one `presale.referral` on
 * every mount, and what it answered as drawn — three stat cards (REFERRALS, EARNED from chain, REFERRED; "—" for a
 * figure whose source failed), the code card with the invite link whole in `.noc-mono` (the address is the code),
 * "Used by N people" / "Not used yet" (hidden when REFERRALS has no source), Copy and "Share invite link" — both copy the
 * link through one useCopy (C15: the popup has no share sheet): while it says `copied` the Copy icon is the checkmark and
 * the code row carries the `--accent` border (24a-bis without its toast: no clipboardWrite, no auto-clear), and the
 * share button says the state (Q38) — "Copy failed" never shows the checkmark. Then Q39's banner and the legalese (its
 * "program terms" in `--accent`, as drawn). A reply that failed shows "—" for every figure, no link and Q11. The
 * design's ACTIVE card, "Recent rewards" and its rows, "View all" and the toast are omitted (§9); the background decides
 * every figure (C3).
 */
export function ReferFriend({onBack}: {onBack: () => void}) {
  const m = useWallet();
  const account = m.account?.publicKey ?? null;
  const client = useMemo(() => presaleClient(m.engine), [m.engine]);
  const {reload} = m;
  const [shown, setShown] = useState<{account: string; data: ReferralData | null} | null>(null);
  const [copy, doCopy] = useCopy();

  useEffect(() => {
    if (account === null) return;
    let alive = true;
    void client.referral(account).then(r => {
      if (!alive) return;
      if (!r.ok && r.error === 'locked') {
        void reload();
        return;
      }
      setShown({account, data: r.ok ? r.data : null});
    });
    return () => {
      alive = false;
    };
  }, [account, client, reload]);

  const loaded = shown !== null && shown.account === account;
  const data = loaded ? shown.data : null;
  /** A figure: still loading → null (a skeleton); its source failed, or the reply did → "—". */
  const figure = (v: bigint | null | undefined, text: (v: bigint) => string): string | null => (!loaded ? null : v === null || v === undefined ? REFER_TEXT.none : text(v));
  const earned = data?.earnedBase;
  const copied = copy === 'copied';
  const copyState = copy === 'copied' ? REFER_TEXT.copied : copy === 'failed' ? REFER_TEXT.copyFailed : null;

  return (
    <div className="screen s-ref">
      <TopBar title={REFER_TEXT.title} titleClass="noc-h3" onBack={onBack} />
      <div className="scroll">
        <div className="stats">
          <Stat label={REFER_TEXT.referrals} value={figure(data?.referrals, countText)} sub={REFER_TEXT.referralsSub} tone={null} />
          <Stat label={REFER_TEXT.earned} value={figure(earned, earnedText)} sub={REFER_TEXT.earnedSub} tone={typeof earned === 'bigint' && earned > 0n ? 'acc' : loaded ? 'muted' : null} />
          <Stat label={REFER_TEXT.referred} value={figure(data?.referredCents, referredText)} sub={REFER_TEXT.referredSub} tone={null} />
        </div>
        {loaded && data === null ? (
          <p className="noc-body-sm app-ref-failed" role="alert">
            {PRESALE_TEXT.unavailable}
          </p>
        ) : (
          <div className="code-card">
            <div className="lbl-row">
              <span className="noc-overline">{REFER_TEXT.eyebrow}</span>
              {data === null || data.referrals === null ? null : data.referrals === 0n ? (
                <span className="uses noc-caption">{REFER_TEXT.notUsed}</span>
              ) : (
                <span className="uses noc-caption">
                  {REFER_TEXT.usedLead}
                  <span className="noc-numeral">{countText(data.referrals)}</span>
                  {REFER_TEXT.usedTail(data.referrals)}
                </span>
              )}
            </div>
            <div className={copied ? 'code-row app-ref-copied' : 'code-row'}>
              {data === null ? (
                <span className="code">
                  <SkelLine width={220} height={20} />
                </span>
              ) : (
                <span className="code noc-mono app-ref-link">{data.link}</span>
              )}
              <div className="actions">
                <button type="button" className={copied ? 'app-ref-check' : undefined} aria-label={copyState ?? REFER_TEXT.copy} disabled={data === null} onClick={() => data !== null && doCopy(data.link)}>
                  <ExtIcon name={copied ? 'check' : copy === 'failed' ? 'close' : 'copy'} size={18} />
                </button>
              </div>
            </div>
            <button type="button" className="share-btn" disabled={data === null} onClick={() => data !== null && doCopy(data.link)}>
              <ExtIcon name="share" size={16} />
              <span role="status" aria-live="polite">
                {copyState ?? REFER_TEXT.share}
              </span>
            </button>
          </div>
        )}
        <div className="banner shield app-ref-banner">
          <ExtIcon name="info" size={16} />
          <div className="copy">
            <span className="noc-body-sm">{REFER_TEXT.banner}</span>
          </div>
        </div>
        <p className="legalese noc-caption">
          {LEGALESE_LEAD}
          <span className="app-ref-terms">{REFER_TEXT.legaleseTerms}</span>
          {LEGALESE_TAIL}
        </p>
      </div>
    </div>
  );
}
