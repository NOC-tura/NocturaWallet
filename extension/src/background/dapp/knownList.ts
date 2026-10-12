/**
 * The known domains (spec §2.5, D2; owner-approved with rev 3): noc-tura.io and a short baked list of large Solana
 * dApps. The one list drives the "Verified" badge (#46, #47, #49's dot) and the lookalike rules. Baked — no remote list
 * and no favicon (C6). Rule (review M4.6): never list a domain whose subdomains users can register or control — every
 * subdomain of a listed domain is verified.
 */
export interface KnownDomain {
  name: string;
  domain: string;
}

export const KNOWN_DOMAINS: readonly KnownDomain[] = [
  {name: 'Noctura', domain: 'noc-tura.io'},
  {name: 'Jupiter', domain: 'jup.ag'},
  {name: 'Raydium', domain: 'raydium.io'},
  {name: 'Orca', domain: 'orca.so'},
  {name: 'Meteora', domain: 'meteora.ag'},
  {name: 'Magic Eden', domain: 'magiceden.io'},
  {name: 'Tensor', domain: 'tensor.trade'},
  {name: 'Drift', domain: 'drift.trade'},
  {name: 'Marinade', domain: 'marinade.finance'},
  {name: 'Kamino', domain: 'kamino.finance'},
  {name: 'Jito', domain: 'jito.network'},
  {name: 'Phantom', domain: 'phantom.app'},
  {name: 'Solflare', domain: 'solflare.com'},
  {name: 'Solscan', domain: 'solscan.io'},
  {name: 'pump.fun', domain: 'pump.fun'},
];
