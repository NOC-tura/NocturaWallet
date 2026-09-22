import {useWallet} from '@solana/wallet-adapter-react';
import {WalletMultiButton} from '@solana/wallet-adapter-react-ui';
import {useWalletAvailability} from './useWalletAvailability';
import {Icon} from '../ui/Icon';

/**
 * The first thing a visitor sees. Before this it was a bare "Select Wallet" button, which
 * asks a stranger for something without saying why, and strands anyone who has no wallet at
 * an empty dialog.
 *
 * Three states, and the third is the one that needed a decision: what to tell someone with
 * no Solana wallet at all. Not "install Noctura for Android" — that app is a direct download
 * rather than a store install, and it is not a Wallet Standard provider, so it cannot connect
 * to this page at all. Sending someone there to use this page would be sending them nowhere.
 */
export function ConnectPanel() {
  const {publicKey, wallets} = useWallet();
  const availability = useWalletAvailability();

  return (
    <section aria-labelledby="connect-heading">
      {publicKey ? (
        <>
          <h2 className="noc-h3" id="connect-heading">
            <Icon name="key" size={16} />
            Your wallet
          </h2>
          <WalletMultiButton />
          <p className="noc-body-sm noc-mono link-break">{publicKey.toBase58()}</p>
        </>
      ) : availability === 'available' ? (
        <>
          <h2 className="noc-h3" id="connect-heading">Connect your Solana wallet</h2>
          <p className="noc-body-sm noc-muted">
            Connect to see your allocation and to buy. Your wallet signs; this page never sees a
            key, and connecting asks for no signature — a signature is requested only when you
            buy.
          </p>
          <WalletMultiButton />
          <p className="noc-caption noc-dim">
            Found on this device: {wallets.map(w => w.adapter.name).join(', ')}
          </p>
        </>
      ) : availability === 'searching' ? (
        <>
          <h2 className="noc-h3" id="connect-heading">Looking for a wallet…</h2>
          <WalletMultiButton />
        </>
      ) : (
        <>
          <h2 className="noc-h3" id="connect-heading">You’ll need a Solana wallet</h2>
          <p className="noc-body-sm noc-muted">
            This page holds no keys of its own. It reads the chain and asks a wallet you already
            control to sign, so there is nothing to create here.
          </p>
          <p className="noc-body-sm noc-muted">
            Install <strong>Phantom</strong>, <strong>Solflare</strong> or{' '}
            <strong>Backpack</strong> from your browser’s extension store, then reload this page.
          </p>
          {/*
            Named, not linked, and that is deliberate. A page that sends you somewhere to
            install a wallet is the exact shape of a phishing page, and this site's whole
            anti-phishing posture (§6.10) is that it asks you for nothing and sends you
            nowhere. It also keeps the bundle at zero external hosts, which is a property the
            build gate now enforces.
          */}
          <p className="noc-caption noc-dim">
            We deliberately don’t link to them: a page that sends you somewhere to install a
            wallet is the shape a phishing page takes. Search your extension store yourself.
          </p>
          <p className="noc-body-sm noc-muted">
            <strong>Using Noctura for Android?</strong> It’s a direct download rather than a
            store install, and it can’t connect to this page. Buy in the app instead — the
            presale is built into it.
          </p>
          <WalletMultiButton />
        </>
      )}

      {/*
        Stated on the screen, not only in docs. There is no field here to type a
        recovery phrase into, which is what makes the sentence true rather than a
        promise — a phishing clone cannot claim the real site asks for one.
      */}
      <p className="noc-caption noc-dim phrase-note">
        <Icon name="shield-check" />
        Noctura will never ask for your recovery phrase.
      </p>
    </section>
  );
}
