import {useWallet} from '../WalletContext';
import {TopBar} from '../ui/TopBar';
import {ExtIcon, type ExtIconName} from '../ui/ExtIcon';
import {LICENCES_PAGE, NOCTURA_PAGES} from '../../shared/links';

/** #38's row labels and the screen-reader hint on a link that opens a new tab (B1e §4.1). */
export const ABOUT_TEXT = {
  legal: 'Legal',
  resources: 'Resources',
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
  licences: 'Open-source licenses',
  help: 'Help & support',
  newTab: ' (opens in a new tab)',
} as const;

/**
 * One #38 row that is a link (B1e §4.1): the design's `.s7-row` as an `<a target="_blank" rel="noopener noreferrer">`,
 * the explorer link's pattern (TxDetail.tsx). The browser opens it; nothing fetches it.
 */
function LinkRow({href, icon, title, chev}: {href: string; icon: ExtIconName; title: string; chev: 'arrow-up-right' | 'chevron-right'}) {
  return (
    <a className="s7-row" href={href} target="_blank" rel="noopener noreferrer">
      <span className="s7-glyph">
        <ExtIcon name={icon} size={20} />
      </span>
      <span className="s7-title">
        {title}
        <span className="app-sr">{ABOUT_TEXT.newTab}</span>
      </span>
      <span className="s7-meta" />
      <span className="s7-chev">
        <ExtIcon name={chev} size={16} />
      </span>
    </a>
  );
}

/**
 * #38 about (spec §6.1; B1e §4.1). The version only (no build stamp). Legal: Terms of Service and Privacy Policy open
 * noc-tura.io in a new tab (the external-link arrow, as drawn), Open-source licenses opens the package's own
 * licenses.html in a new tab (the in-app chevron, as drawn). Resources: Help & support (noc-tura.io, a new tab), then
 * "noc-tura.io" as text, not a link.
 */
export function About({onBack}: {onBack: () => void}) {
  const m = useWallet();
  return (
    <div className="screen">
      <TopBar title="About" onBack={onBack} />
      <div className="app-about-body">
        <div className="app-about-card">
          <div className="app-about-mark" aria-hidden="true">
            <ExtIcon name="shield-lock" size={36} />
          </div>
          <h2 className="s7-wordmark">
            noctura<span className="dot">.</span>
          </h2>
          <p className="noc-body-sm app-muted">Solana wallet for your browser — your keys stay on this device.</p>
          <p className="noc-caption noc-mono app-dim">v{m.platform.version()}</p>
        </div>
        <p className="noc-overline app-dim">{ABOUT_TEXT.legal}</p>
        <div className="s7-list">
          <LinkRow href={NOCTURA_PAGES.terms} icon="doc" title={ABOUT_TEXT.terms} chev="arrow-up-right" />
          <LinkRow href={NOCTURA_PAGES.privacy} icon="shield-check" title={ABOUT_TEXT.privacy} chev="arrow-up-right" />
          <LinkRow href={LICENCES_PAGE} icon="book" title={ABOUT_TEXT.licences} chev="chevron-right" />
        </div>
        <p className="noc-overline app-dim">{ABOUT_TEXT.resources}</p>
        <div className="s7-list">
          <LinkRow href={NOCTURA_PAGES.help} icon="help" title={ABOUT_TEXT.help} chev="arrow-up-right" />
          <div className="s7-row app-static">
            <span className="s7-glyph">
              <ExtIcon name="globe" size={20} />
            </span>
            <span className="s7-title noc-mono">noc-tura.io</span>
          </div>
        </div>
        <div className="app-about-foot">
          <p className="noc-caption app-dim">© 2026 Noctura</p>
          <p className="noc-caption app-dim">
            BSL 1.1 · converts to MIT on <span className="noc-numeral">2034-01-01</span>
          </p>
        </div>
      </div>
    </div>
  );
}
