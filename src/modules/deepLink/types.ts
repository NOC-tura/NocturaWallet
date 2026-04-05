export type DeepLinkType = 'pay' | 'receive' | 'stake' | 'referral' | 'presale' | 'rejected';

export interface DeepLinkAction {
  type: DeepLinkType;
  params: Record<string, string>;
  reason?: string;
}
