/**
 * Stands in for `@solana-mobile/wallet-adapter-mobile`, which `@solana/wallet-adapter-react`
 * imports unconditionally and which we do not want in the bundle. The substitution happens in
 * `vite.config.ts`; nothing in our own source imports this file.
 *
 * WHY IT IS OUT, decided 2026-09-21 together with the CSP:
 *
 *  1. Its `EmbeddedModal` builds a `<style>` element at run time — two of them, one per modal
 *     class, because `@solana-mobile/wallet-standard-mobile` rides in on the same dependency.
 *     Under `style-src 'self'` both are blocked, so the modal would render unstyled inside its
 *     own closed shadow root: broken, and broken only on a phone, where we would not see it.
 *  2. The same modal sets `innerHTML` containing a `<link>` to fonts.googleapis.com the moment
 *     it is constructed. A privacy wallet handing Google the IP address of a user who opened a
 *     connect dialog is the exact thing §6.2 exists to prevent — and the users most likely to
 *     reach that path are the mobile-browser ones this product is for.
 *
 * WHAT IS LOST: from a plain Android browser, a user can no longer reach a native wallet app by
 * intent. The remaining path is the in-app browser of Phantom or Solflare, which registers over
 * the Wallet Standard and needs nothing from this package. That is the common path anyway.
 *
 * WHY THE STUB IS SHAPED LIKE THIS: `WalletProvider` constructs the adapter whenever it decides
 * the environment is mobile, so a stub that threw would crash the page on an Android browser.
 * Instead the stub reports `Unsupported`, which `WalletProviderBase` already filters out of the
 * wallet list it exposes (lib/esm/WalletProviderBase.js, three `readyState !== Unsupported`
 * filters — read, not assumed). So the entry never reaches the UI, using the library's own
 * mechanism for "this wallet cannot work here" rather than a patch to its logic.
 */
import {
  BaseWalletAdapter,
  WalletNotReadyError,
  WalletReadyState,
  type SupportedTransactionVersions,
  type WalletName,
} from '@solana/wallet-adapter-base';
import type {PublicKey, TransactionSignature} from '@solana/web3.js';

export const SolanaMobileWalletAdapterWalletName = 'Mobile Wallet Adapter' as WalletName<'Mobile Wallet Adapter'>;

export class SolanaMobileWalletAdapter extends BaseWalletAdapter<'Mobile Wallet Adapter'> {
  name = SolanaMobileWalletAdapterWalletName;
  // The real adapter points these at solanamobile.com. Empty here on purpose: the UI never
  // renders this adapter, so a URL would be a host in the bundle that no code can reach —
  // and the external-host gate would then have to carry a line explaining a dead string.
  url = '';
  icon = '';
  readyState = WalletReadyState.Unsupported;
  publicKey: PublicKey | null = null;
  connecting = false;
  supportedTransactionVersions: SupportedTransactionVersions = null;

  async connect(): Promise<void> {
    // Unreachable through the UI — the Unsupported state keeps this adapter out of the
    // list — but a stale `walletName` in localStorage from before this change can still
    // select it by name. Failing loudly beats connecting to nothing.
    throw new WalletNotReadyError('Mobile Wallet Adapter is not available in this build');
  }

  async disconnect(): Promise<void> {}

  async sendTransaction(): Promise<TransactionSignature> {
    throw new WalletNotReadyError('Mobile Wallet Adapter is not available in this build');
  }
}

/**
 * The three helpers `WalletProvider` passes into the constructor. They are called before the
 * adapter is built, so they have to exist and return something of the right shape even though
 * the adapter they configure never connects.
 */
export function createDefaultAddressSelector() {
  return {select: async (addresses: string[]) => addresses[0]};
}

export function createDefaultAuthorizationResultCache() {
  return {clear: async () => {}, get: async () => undefined, set: async () => {}};
}

export function createDefaultWalletNotFoundHandler() {
  // The real one opens the embedded modal. Doing nothing is correct here: the adapter this
  // belongs to is filtered out of the UI, so there is no flow that can reach the handler.
  return async () => {};
}
