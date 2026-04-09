declare module 'react-native-config' {
  export interface NativeConfig {
    HELIUS_RPC_URL: string;
    HELIUS_WS_URL: string;
    NETWORK: 'devnet' | 'mainnet-beta';
    API_BASE: string;
    /** TODO: integrate @sentry/react-native — DSN is declared but not yet consumed by any code */
    SENTRY_DSN: string;
  }
  const Config: NativeConfig;
  export default Config;
}
