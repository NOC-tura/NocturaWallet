import {forceSync, registerBackgroundTask, SyncResult} from '../backgroundSyncModule';
import {useWalletStore} from '../../../store/zustand/walletStore';

// Mock Solana connection and queries
jest.mock('../../solana/connection', () => ({
  getConnection: jest.fn(() => ({})),
}));

jest.mock('../../solana/queries', () => ({
  getBalance: jest.fn(),
  getTokenAccounts: jest.fn(),
}));

import {getBalance, getTokenAccounts} from '../../solana/queries';

const mockGetBalance = getBalance as jest.MockedFunction<typeof getBalance>;
const mockGetTokenAccounts = getTokenAccounts as jest.MockedFunction<typeof getTokenAccounts>;

const TEST_PUBLIC_KEY = 'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy';

describe('backgroundSyncModule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset wallet store
    useWalletStore.getState().reset();
  });

  describe('forceSync', () => {
    it('returns a SyncResult with success: false when no public key', async () => {
      const result = await forceSync();

      expect(result).toMatchObject<Partial<SyncResult>>({
        success: false,
        timestamp: expect.any(Number),
      });
    });

    it('returns a SyncResult with success: true and updates lastSyncedAt in walletStore', async () => {
      // Set up wallet with public key
      useWalletStore.getState().setPublicKey(TEST_PUBLIC_KEY);

      mockGetBalance.mockResolvedValue(BigInt(2_000_000_000)); // 2 SOL in lamports
      mockGetTokenAccounts.mockResolvedValue([
        {mint: 'TokenMint1111', owner: TEST_PUBLIC_KEY, amount: '1000', decimals: 6, address: 'TokenAddr1'},
        {mint: 'TokenMint2222', owner: TEST_PUBLIC_KEY, amount: '500', decimals: 9, address: 'TokenAddr2'},
      ]);

      const before = Date.now();
      const result = await forceSync();
      const after = Date.now();

      expect(result.success).toBe(true);
      expect(result.solBalance).toBe('2000000000');
      expect(result.tokenCount).toBe(2);
      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(after);

      // Verify lastSyncedAt was updated
      const lastSynced = useWalletStore.getState().lastSyncedAt;
      expect(lastSynced).not.toBeNull();
      expect(lastSynced).toBeGreaterThanOrEqual(before);
      expect(lastSynced).toBeLessThanOrEqual(after);
    });

    it('handles errors gracefully and returns partial result', async () => {
      useWalletStore.getState().setPublicKey(TEST_PUBLIC_KEY);

      // Make getBalance fail but getTokenAccounts succeed
      mockGetBalance.mockRejectedValue(new Error('RPC error'));
      mockGetTokenAccounts.mockResolvedValue([
        {mint: 'TokenMint1111', owner: TEST_PUBLIC_KEY, amount: '1000', decimals: 6, address: 'TokenAddr1'},
      ]);

      const result = await forceSync();

      // With Promise.allSettled, individual failures are handled gracefully
      // solBalance falls back to store value, tokenCount from successful call
      expect(result.success).toBe(true);
      expect(result.tokenCount).toBe(1);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('handles complete failure gracefully', async () => {
      useWalletStore.getState().setPublicKey(TEST_PUBLIC_KEY);

      // Mock getConnection to throw
      const {getConnection} = require('../../solana/connection');
      (getConnection as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Connection failed');
      });

      const result = await forceSync();

      expect(result.success).toBe(false);
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.solBalance).toBeUndefined();
    });
  });

  describe('registerBackgroundTask', () => {
    it('does not throw', () => {
      expect(() => registerBackgroundTask()).not.toThrow();
    });
  });
});
