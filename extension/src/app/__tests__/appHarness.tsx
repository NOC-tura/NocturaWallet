import {render} from '@testing-library/react';
import {App} from '../App';
import {createEngine} from '../engine';
import {setupWallet, type Wallet, type WalletOptions} from './harness';

/**
 * The whole App — its own provider, router and tab bar — against the real background. `hash` is the
 * tab's location.hash; `spy` sees every message the app sends.
 */
export async function renderApp(o: WalletOptions & {hash?: string; spy?: (m: unknown) => void} = {}): Promise<Wallet> {
  const w = await setupWallet(o);
  const engine = o.spy === undefined ? w.engine : createEngine(m => (o.spy?.(m), w.transport(m)), async () => undefined);
  render(<App surface={o.surface ?? 'popup'} engine={engine} platform={w.platform} hash={o.hash ?? ''} />);
  return {...w, engine};
}
