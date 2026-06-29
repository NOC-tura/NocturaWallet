declare module 'react-native-config' {
  export interface NativeConfig {
    HELIUS_RPC_URL: string;
    HELIUS_WS_URL: string;
    NETWORK: 'devnet' | 'mainnet-beta';
    API_BASE: string;
    /** Optional CoinGecko Demo API key — lifts the price rate-limit. May be undefined. */
    COINGECKO_API_KEY?: string;
    /** TODO: integrate @sentry/react-native — DSN is declared but not yet consumed by any code */
    SENTRY_DSN: string;
    /** Devnet test mint the shielded pool was initialized for. Optional; empty until configured. */
    SHIELDED_DEVNET_MINT?: string;
    /** 'true' enables shielded mode in this build (devnet test build only). Optional; absent = off. */
    FEATURES_SHIELDED?: string;
  }
  const Config: NativeConfig;
  export default Config;
}
