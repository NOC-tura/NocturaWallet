export interface Contact {
  id: string;
  name: string;
  address: string;
  addressType: 'transparent' | 'shielded';
  memo?: string;
  lastUsedAt?: number;
  createdAt: number;
}
