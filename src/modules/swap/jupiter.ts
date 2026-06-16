const JUP_BASE = 'https://lite-api.jup.ag/swap/v1';
const WSOL_MINT = 'So11111111111111111111111111111111111111112';

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  slippageBps: number;
  raw: unknown; // full quote — passed back to /swap verbatim
}

/** Jupiter uses wrapped-SOL for native SOL; map the app's 'native' sentinel. */
export function jupiterMint(appMint: string): string {
  return appMint === 'native' ? WSOL_MINT : appMint;
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 10_000): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {...init, signal: controller.signal});
    if (!res.ok) throw new Error(`Jupiter HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetch a swap quote (ExactIn). Throws on error / no route. amount = raw input base units. */
export async function getSwapQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps: number;
}): Promise<SwapQuote> {
  const {inputMint, outputMint, amount, slippageBps} = params;
  const url =
    `${JUP_BASE}/quote?inputMint=${jupiterMint(inputMint)}&outputMint=${jupiterMint(outputMint)}` +
    `&amount=${amount}&slippageBps=${slippageBps}&swapMode=ExactIn`;
  const body = (await fetchJson(url)) as {
    inputMint?: string;
    outputMint?: string;
    inAmount?: string;
    outAmount?: string;
    priceImpactPct?: string;
    slippageBps?: number;
    routePlan?: unknown[];
  };
  if (!body.outAmount || !Array.isArray(body.routePlan) || body.routePlan.length === 0) {
    throw new Error('No swap route for this pair');
  }
  return {
    inputMint: body.inputMint ?? jupiterMint(inputMint),
    outputMint: body.outputMint ?? jupiterMint(outputMint),
    inAmount: body.inAmount ?? amount,
    outAmount: body.outAmount,
    priceImpactPct: body.priceImpactPct ?? '0',
    slippageBps: body.slippageBps ?? slippageBps,
    raw: body,
  };
}

/** Get a ready-to-sign swap transaction (base64 VersionedTransaction) + expiry. */
export async function getSwapTransaction(
  quoteRaw: unknown,
  userPublicKey: string,
): Promise<{swapTransaction: string; lastValidBlockHeight: number}> {
  const body = (await fetchJson(`${JUP_BASE}/swap`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      quoteResponse: quoteRaw,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
    }),
  })) as {swapTransaction?: string; lastValidBlockHeight?: number};
  if (!body.swapTransaction) throw new Error('Jupiter returned no swap transaction');
  return {swapTransaction: body.swapTransaction, lastValidBlockHeight: body.lastValidBlockHeight ?? 0};
}
