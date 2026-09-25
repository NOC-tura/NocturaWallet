import {QueryClientProvider} from '@tanstack/react-query';
import {WalletProviders} from './wallet/WalletProviders';
import {BrandMark} from './ui/BrandMark';
import {ConnectPanel} from './wallet/ConnectPanel';
import {PresalePanel} from './presale/PresalePanel';
import {PortfolioPanel} from './portfolio/PortfolioPanel';
import {PurchaseHistory} from './portfolio/PurchaseHistory';
import {usePresaleStats, useAllocation} from './presale/usePresale';
import {useCredits} from './presale/useCredits';
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
  const credits = useCredits(allocation.status === 'ok' ? allocation.referralBonusBase : null);
  const solUsd = useSolUsd();
  if (stats.isPending) return <p>Loading the presale…</p>;
  if (stats.isError || !stats.data) return <p>The presale status could not be read.</p>;
  return (
    <>
      <PresalePanel stats={stats.data} allocation={allocation} credits={credits} />
      <BuyForm stage={stats.data} solUsd={solUsd} />
    </>
  );
}

/**
 * The portfolio needs the stage price to value a NOC holding, and the presale query
 * already holds it — asking the coordinator twice for the same number would be a second
 * source that can disagree with the first.
 */
function Portfolio() {
  const stats = usePresaleStats();
  // Until the stage is known there is no basis to value NOC against, and a zero would
  // render someone's holding as worthless. The panel waits rather than guesses.
  if (!stats.data) return null;
  return (
    <>
      <PortfolioPanel stagePriceUsd={stats.data.pricePerNocUsd} />
      <PurchaseHistory />
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
        {/*
          Phone-first, but not phone-only. Keeping the mockup's 440 px column at every
          width made a laptop look like it was displaying a screenshot of a phone: one
          narrow strip with a field of black on either side. The panels are independent
          cards, so above 900 px they take two tracks — the presale, the buy form and
          referral on the left, where the work happens, and the wallet, balances,
          purchases and countdown on the right, where the facts about you sit. Referral
          moved left in the desktop redesign (2026-09-25): on the right it made that
          column twice the length of the other. Below 900 px it collapses back to the
          single column the design draws, in this same DOM order — the redesign's visual
          reordering on phone was not taken, because focus order would then differ from
          what the reader sees.
        */}
        <main className="shell">
          <header className="shell-head">
            <BrandMark />
            <div className="head-copy">
              <h1 className="noc-h1">Noctura</h1>
            {/*
              What this page is, said before anyone has to guess. It is not a wallet: it
              holds no keys and creates none. Naming it honestly is also what makes the
              connect screen below make sense rather than read as a demand.
            */}
              <p className="noc-body-sm noc-dim">Presale and portfolio. Your wallet stays where it is.</p>
            </div>
          </header>
          <div className="cols">
            <div className="col col-main">
              <Presale />
              <Referral />
            </div>
            <div className="col col-side">
              <ConnectPanel />
              <Portfolio />
              <Tge />
            </div>
          </div>
        </main>
      </WalletProviders>
    </QueryClientProvider>
  );
}
