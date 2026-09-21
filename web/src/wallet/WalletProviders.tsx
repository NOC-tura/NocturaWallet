import {type ReactNode} from 'react';
import {ConnectionProvider, WalletProvider} from '@solana/wallet-adapter-react';
import {WalletModalProvider} from '@solana/wallet-adapter-react-ui';
import './wallet-adapter.css';
import {rpcEndpoint} from '../config';

export function WalletProviders({children}: {children: ReactNode}) {
  return (
    <ConnectionProvider endpoint={rpcEndpoint()}>
      {/*
        `wallets={[]}` on purpose. wallet-adapter-react 0.15.40 depends on
        @solana/wallet-standard-wallet-adapter-react, so wallets that implement the
        Wallet Standard — Phantom, Solflare, Backpack — register themselves. Listing
        them explicitly would mean pulling in @solana/wallet-adapter-wallets, which
        re-exports dozens of adapters and, with them, dozens of third-party hosts into
        a bundle that is supposed to contact only our origin.

        autoConnect stays off: a page that connects on arrival is the shape every
        drainer uses, and users are right to be trained against it.
      */}
      <WalletProvider wallets={[]} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

/*
 * KNOWN third-party request, not fixed here — recorded so the Task 11 host gate is
 * not loosened without the reason.
 *
 * @solana/wallet-adapter-react pulls @solana-mobile/wallet-adapter-mobile, whose
 * EmbeddedModal does `host.innerHTML = <link href="https://fonts.googleapis.com/…">`
 * when the modal is CONSTRUCTED. So it is not a page-load leak — desktop never
 * reaches it — but a mobile user who opens that flow hands Google their IP, and the
 * people most likely to be on a mobile browser are the ones this product is for.
 *
 * Options when this is decided (deploy task): patch the dependency, drop Mobile
 * Wallet Adapter support, or accept it and say so in the privacy page. It is listed
 * in the no-external-hosts allowlist with this note attached, never silently.
 */
