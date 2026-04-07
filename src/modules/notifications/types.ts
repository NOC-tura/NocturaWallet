export type NotificationType = 'incoming_tx' | 'staking_reward' | 'tx_confirmed' | 'security_alert';

export const ALL_NOTIFICATION_TYPES: NotificationType[] = [
  'incoming_tx',
  'staking_reward',
  'tx_confirmed',
  'security_alert',
];

export interface NotificationPayload {
  type: NotificationType;
  token?: string;
  txId?: string;
}

export const NOTIFICATION_MESSAGES: Record<NotificationType, string> = {
  incoming_tx: 'You received NOC tokens',
  staking_reward: 'Your staking rewards are ready to claim',
  tx_confirmed: 'Transaction confirmed',
  security_alert: 'Security alert — please check your wallet',
};

export const NOTIFICATION_ROUTES: Record<NotificationType, string> = {
  incoming_tx: 'MainTabs',
  staking_reward: 'Staking',
  tx_confirmed: 'TransactionHistory',
  security_alert: 'SettingsTab',
};
