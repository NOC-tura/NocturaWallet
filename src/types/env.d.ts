declare module 'react-native-config' {
  export interface NativeConfig {
    HELIUS_RPC_URL: string;
    HELIUS_WS_URL: string;
    /**
     * The build's chain identity (constants/chain.ts): the cluster the RPC is on, the network the
     * screens name, the explorer cluster, and whether presale exists (mainnet-beta only). Required:
     * a missing or unknown value refuses to start (networkGuard), never defaults to mainnet.
     */
    NETWORK: 'devnet' | 'mainnet-beta';
    API_BASE: string;
    /** Optional CoinGecko Demo API key — lifts the price rate-limit. May be undefined. */
    COINGECKO_API_KEY?: string;
    /** TODO: integrate @sentry/react-native — DSN is declared but not yet consumed by any code */
    SENTRY_DSN: string;
    /** 'true' enables shielded mode in this build (the devnet build only: requires NETWORK=devnet). Optional; absent = off. */
    FEATURES_SHIELDED?: string;
    /** 'true' generates shielded ZK proofs on-device (required with FEATURES_SHIELDED). Optional; absent = off. */
    LOCAL_PROVING?: string;
    /** Dev-only TLS pin probe screen (positive + negative control). Never set in .env.production. */
    PIN_PROBE?: string;
  }
  const Config: NativeConfig;
  export default Config;
}
