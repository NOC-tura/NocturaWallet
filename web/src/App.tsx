import {WalletProviders} from './wallet/WalletProviders';
import {ConnectPanel} from './wallet/ConnectPanel';

export function App() {
  return (
    <WalletProviders>
      <main>
        <h1>Noctura</h1>
        <ConnectPanel />
      </main>
    </WalletProviders>
  );
}
