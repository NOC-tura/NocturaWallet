const EXPLORERS = {
  solscan: 'https://solscan.io/tx/',
  solanaexplorer: 'https://explorer.solana.com/tx/',
  solanafm: 'https://solana.fm/tx/',
} as const;

export function getExplorerUrl(
  signature: string,
  explorer: 'solscan' | 'solanaexplorer' | 'solanafm' = 'solscan',
): string {
  return `${EXPLORERS[explorer]}${signature}`;
}
