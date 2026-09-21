import {QueryClientProvider} from '@tanstack/react-query';
import {WalletProviders} from './wallet/WalletProviders';
import {ConnectPanel} from './wallet/ConnectPanel';
import {PresalePanel} from './presale/PresalePanel';
import {usePresaleStats, useAllocation} from './presale/usePresale';
import {queryClient} from './lib/queryClient';

function Presale() {
  const stats = usePresaleStats();
  const allocation = useAllocation();
  if (stats.isPending) return <p>Loading the presale…</p>;
  if (stats.isError || !stats.data) return <p>The presale status could not be read.</p>;
  return <PresalePanel stats={stats.data} allocation={allocation} />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProviders>
        <main>
          <h1>Noctura</h1>
          <ConnectPanel />
          <Presale />
        </main>
      </WalletProviders>
    </QueryClientProvider>
  );
}
