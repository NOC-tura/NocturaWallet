import {render} from '@testing-library/react';
import {App} from '../App';
import {setupWallet, type Wallet, type WalletOptions} from './harness';

/** The whole App — its own provider, router and tab bar — against the real background. */
export async function renderApp(o: WalletOptions = {}): Promise<Wallet> {
  const w = await setupWallet(o);
  render(<App surface={o.surface ?? 'popup'} engine={w.engine} platform={w.platform} />);
  return w;
}
