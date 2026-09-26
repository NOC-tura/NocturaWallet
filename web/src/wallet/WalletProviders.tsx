import {type ReactNode} from 'react';
import {ConnectionProvider, WalletProvider} from '@solana/wallet-adapter-react';
import {WalletModalProvider} from '@solana/wallet-adapter-react-ui';
import './wallet-adapter.css';
import {rpcEndpoint} from '../config';
import {userHasActed} from './userGesture';

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

        autoConnect is a FUNCTION, not false, and the distinction is the whole point.
        `false` was costing a click: after choosing Solflare in the dialog the button
        turned into "Connect" and waited to be pressed again, for a connection the user
        had just asked for. `true` would have gone too far the other way — reconnecting
        on arrival is the shape every drainer uses.

        The rule this page actually wants is neither: never connect except in response to
        something the user did. A restore from localStorage happens before anyone has
        touched anything; a selection happens after they opened the dialog. userHasActed()
        tells those apart, so the redundant click goes and the property stays.
      */}
      <WalletProvider wallets={[]} autoConnect={async () => userHasActed()}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

/*
 * RESOLVED 2026-09-21 — the third-party request recorded here is gone.
 *
 * @solana/wallet-adapter-react pulls @solana-mobile/wallet-adapter-mobile, whose
 * EmbeddedModal did `host.innerHTML = <link href="https://fonts.googleapis.com/…">`
 * when the modal was CONSTRUCTED, and built two <style> elements at run time that a
 * strict style-src blocks. Writing the CSP forced the choice; the adapter was replaced
 * with src/wallet/mobileAdapterStub.ts, which carries the full reasoning and what it
 * costs (no intent hand-off to a native wallet from a plain Android browser).
 *
 * Measured after: fonts.googleapis.com and fonts.gstatic.com out of the bundle, style
 * injections 2 → 0, bundle 630 kB → 507 kB.
 */
