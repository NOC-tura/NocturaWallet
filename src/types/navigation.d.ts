import type {TransferIntent} from './transfer';
import type {ShieldIntent} from './shield';

export type RootStackParamList = {
  Splash: undefined;
  Unlock: {reason?: 'session_expired' | 'app_foreground' | 'manual_lock'};
  UnlockSend: {
    amount: string;
    ticker: string;
    recipient: string;
    networkFee?: string;
  };
  Onboarding: undefined;
  MainTabs: undefined;
  SendModal: {initialMint?: string} | undefined; // Send flow as root-level modal (was tab)
  ReceiveModal: undefined; // Receive as root-level modal (was tab); transparent only until M2 (I9)
  ScanModal: undefined; // QR scanner (#14)
  NotificationsModal: undefined; // Notifications inbox (#29)
  AddressBookModal: undefined; // Saved contacts (#15)
  // #16 — the shield side only until M1c (spec §12 "Hidden until its plan lands"): no 'public'.
  ShieldUnshieldModal: {direction?: 'private'} | undefined;
  TransactionHistory: undefined;
  ShieldedExplainer: undefined;
  ZkProofModal: {amount: string}; // #18 — the A0 deposit's proof; amount in base units
  ShieldSimulate: {intent: ShieldIntent}; // #19 for the A0 deposit
  ShieldConfirm: {intent: ShieldIntent}; // #20
  ShieldStatus: {intent: ShieldIntent}; // #21
  AppUpdateModal: {storeUrl: string; message?: string};
  TokenDetailModal: {mint: string};
  SwapModal: {initialFromMint?: string} | undefined;
};

export type OnboardingStackParamList = {
  Welcome: undefined;
  SecurityIntro: undefined;
  CreateWallet: undefined;
  SeedPhrase: undefined;
  ConfirmSeed: undefined;
  ImportSeed: undefined;
  SelectAccount: undefined;
  SyncWallet: undefined;
  SetPin: undefined;
  BiometricSetup: undefined;
  Success: undefined;
  Presale: undefined;
};

export type DashboardStackParamList = {
  Dashboard: undefined;
  Presale: undefined;
  PresaleBuyConfirm: {paymentToken: 'SOL' | 'USDC' | 'USDT'; amountBaseUnits: string};
  PresaleBuyStatus: {paymentToken: 'SOL' | 'USDC' | 'USDT'; amountBaseUnits: string};
  Staking: undefined;
  GeoBlocked: {countryCode?: string; presaleBlocked?: boolean} | undefined;
};

export type SendStackParamList = {
  Send: {initialMint?: string} | undefined;
  TxSimulate: {intent: TransferIntent};
  TxConfirm: {intent: TransferIntent};
  TransactionStatus: {intent: TransferIntent};
  TransactionDetail: {signature: string};
};

export type SettingsStackParamList = {
  Settings: undefined;
  SecuritySettings: undefined;
  ChangePin: undefined;
  BackupSettings: undefined;
  NotificationSettings: undefined;
  WipeWallet: undefined;
  Referral: undefined;
  PinProbe: undefined;
};

export type MainTabsParamList = {
  HomeTab: undefined;
  PortfolioTab: undefined;
  NftsTab: undefined;
  ProfileTab: undefined;
};
