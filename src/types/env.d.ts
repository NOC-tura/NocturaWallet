declare module 'react-native-config' {
  export interface NativeConfig {
    HELIUS_RPC_URL: string;
    HELIUS_WS_URL: string;
    NETWORK: 'devnet' | 'mainnet-beta';
    API_BASE: string;
    SENTRY_DSN: string;
  }
  const Config: NativeConfig;
  export default Config;
}
