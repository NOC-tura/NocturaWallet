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
    /**
     * 'true' routes shielded transfers through the coordinator relayer (private:
     * coordinator is fee_payer). Absent/other = self-relay (sender's key visible
     * on-chain, devnet/debug only). Optional; absent = off.
     */
    SHIELDED_RELAYER?: string;
    /**
     * 'true' generates shielded ZK proofs on-device (noteSecret never leaves the
     * phone; hosted prover unused for shielded). Requires native prover + assets.
     * Optional; absent = off.
     */
    LOCAL_PROVING?: string;
    /**
     * 'true' shows the dev-only "Native prover test" screen in Settings (devnet
     * build). Runs on-device native prove + compares to hosted. Absent = hidden.
     */
    NATIVE_PROVER_DEBUG?: string;
  }
  const Config: NativeConfig;
  export default Config;
}
