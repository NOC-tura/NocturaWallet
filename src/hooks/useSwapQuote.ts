import {useQuery} from '@tanstack/react-query';
import {getSwapQuote, type SwapQuote} from '../modules/swap/jupiter';

/**
 * Live Jupiter quote for a pair + input amount. `enabled` should be false when
 * the amount is empty/zero or the mints match. The screen debounces `amountRaw`
 * before passing it here so typing doesn't spam Jupiter.
 */
export function useSwapQuote(args: {
  inputMint: string;
  outputMint: string;
  amountRaw: string;
  slippageBps: number;
  enabled: boolean;
}) {
  return useQuery<SwapQuote>({
    queryKey: ['swapQuote', args.inputMint, args.outputMint, args.amountRaw, args.slippageBps],
    queryFn: () =>
      getSwapQuote({
        inputMint: args.inputMint,
        outputMint: args.outputMint,
        amount: args.amountRaw,
        slippageBps: args.slippageBps,
      }),
    enabled: args.enabled,
    staleTime: 10_000,
    refetchInterval: 15_000,
    retry: 1,
  });
}
