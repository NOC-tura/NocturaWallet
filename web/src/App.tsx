import {QueryClientProvider} from '@tanstack/react-query';
import {WalletProviders} from './wallet/WalletProviders';
import {ConnectPanel} from './wallet/ConnectPanel';
import {PresalePanel} from './presale/PresalePanel';
import {PortfolioPanel} from './portfolio/PortfolioPanel';
import {usePresaleStats, useAllocation} from './presale/usePresale';
import {BuyForm} from './presale/BuyForm';
import {ReferralPanel} from './referral/ReferralPanel';
import {useReferral} from './referral/useReferral';
import {Countdown} from './tge/Countdown';
import {useTge} from './tge/useTge';
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

function Referral() {
  const {address, data, isPending, isError} = useReferral();
  if (!address) return null;
  if (isPending) return <p>Reading your referral stats…</p>;
  if (isError || !data) return <p>Your referral stats could not be read.</p>;
  return <ReferralPanel address={address} stats={data} />;
}

function Tge() {
  const {data, isPending, isError} = useTge();
  if (isPending) return <p>Reading the TGE date…</p>;
  if (isError) return <p>The TGE date could not be read.</p>;
  return <Countdown tgeUnix={data ?? null} />;
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
          <Tge />
          <Referral />
        </main>
      </WalletProviders>
    </QueryClientProvider>
  );
}
