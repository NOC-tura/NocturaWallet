export type RootStackParamList = {
  Splash: undefined;
  Unlock: {reason?: 'session_expired' | 'app_foreground' | 'manual_lock'};
  Onboarding: undefined;
  MainTabs: undefined;
  TransactionHistory: undefined;
  ShieldedBalance: undefined;
  Deposit: {token?: string};
  ShieldedTransfer: {recipient?: string};
  Withdraw: undefined;
  PrivacyExplainer: undefined;
  AppUpdateModal: {storeUrl: string; message?: string};
};

export type OnboardingStackParamList = {
  Welcome: undefined;
  SecurityIntro: undefined;
  CreateWallet: undefined;
  SeedPhrase: undefined;
  ConfirmSeed: undefined;
  ImportSeed: undefined;
  SyncWallet: undefined;
  SetPin: undefined;
  BiometricSetup: undefined;
  Success: undefined;
  Presale: undefined;
};

export type DashboardStackParamList = {
  Dashboard: undefined;
  Presale: undefined;
  Staking: undefined;
  Referral: undefined;
};

export type SendStackParamList = {
  Send: undefined;
  TransactionStatus: {
    signature: string;
    amount: string;
    recipient: string;
    token: string;
  };
  TransactionDetail: {signature: string};
};

export type SettingsStackParamList = {
  Settings: undefined;
  SecuritySettings: undefined;
  ChangePin: undefined;
  ExportViewKey: undefined;
  BackupSettings: undefined;
  NotificationSettings: undefined;
  WipeWallet: undefined;
};

export type MainTabsParamList = {
  HomeTab: undefined;
  SendTab: undefined;
  ReceiveTab: undefined;
  SettingsTab: undefined;
};
