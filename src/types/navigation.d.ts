import type {TransferIntent} from './transfer';
import type {ShieldIntent} from './shield';
import type {A0UnshieldDestination} from '../modules/shielded/a0/unshieldFlow';

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
  // #16 — both sides (M1c Task 8). 'public' is honoured only on a route in-app navigation created:
  // a deep link's query lands here too, so deepLinkConfig pins `direction` to 'private' and the
  // Navigator ignores it on any route that carries a link `path` (fix round 1, I-1)
  ShieldUnshieldModal: {direction?: 'private' | 'public'} | undefined;
  TransactionHistory: undefined;
  ShieldedExplainer: undefined;
  ZkProofModal: {amount: string}; // #18 — the A0 deposit's proof; amount in base units
  ShieldSimulate: {intent: ShieldIntent}; // #19 for the A0 deposit
  ShieldConfirm: {intent: ShieldIntent}; // #20
  ShieldStatus: {intent: ShieldIntent}; // #21
  // #18 → #21 for the A0 unshield (M1c Task 8): one unshieldA0 call per mount; no deep link
  UnshieldRun: {destination: A0UnshieldDestination; amount: string};
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
  TransactionDetail: {signature: string; account?: string}; // post-M1d R9: the account the detail was opened from
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
