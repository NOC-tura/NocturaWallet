import {useWallet} from '../WalletContext';
import {TopBar} from '../ui/TopBar';
import {ExtIcon} from '../ui/ExtIcon';

/**
 * #38 about (spec §6.1). The version only (no build stamp); "noc-tura.io" as text, not a link —
 * Solscan is the one external link (§6.5). Terms, Privacy, licences and help arrive with their pages
 * (a release gate, B1e).
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
        <p className="noc-overline app-dim">Resources</p>
        <div className="s7-list">
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
