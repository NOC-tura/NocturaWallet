import {QueryClientProvider} from '@tanstack/react-query';
import {WalletProviders} from './wallet/WalletProviders';
import {ConnectPanel} from './wallet/ConnectPanel';
import {PresalePanel} from './presale/PresalePanel';
import {PortfolioPanel} from './portfolio/PortfolioPanel';
import {usePresaleStats, useAllocation} from './presale/usePresale';
import {BuyForm} from './presale/BuyForm';
import {useQuery} from '@tanstack/react-query';
import {json} from './lib/api';
import {queryClient} from './lib/queryClient';

function useSolUsd() {
  const q = useQuery({
    queryKey: ['sol-usd'],
    staleTime: 60_000,
    queryFn: async () => {
      const b = await json.get<{success?: boolean; data?: {solana?: {usd?: number}}}>(
        '/wallet/prices?ids=solana',
      );
      const usd = b.data?.solana?.usd;
      if (!b.success || typeof usd !== 'number') throw new Error('SOL price unavailable');
      return usd;
    },
  });
  return q.data ?? null;
}

function Presale() {
  const stats = usePresaleStats();
  const allocation = useAllocation();
  const solUsd = useSolUsd();
  if (stats.isPending) return <p>Loading the presale…</p>;
  if (stats.isError || !stats.data) return <p>The presale status could not be read.</p>;
  return (
    <>
      <PresalePanel stats={stats.data} allocation={allocation} />
      <BuyForm stage={stats.data} solUsd={solUsd} />
    </>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProviders>
        <main>
          <h1>Noctura</h1>
          <ConnectPanel />
          <PortfolioPanel />
          <Presale />
        </main>
      </WalletProviders>
    </QueryClientProvider>
  );
}
