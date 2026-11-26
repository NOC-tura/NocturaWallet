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

// Mock TokenManager so fetchVerifiedList doesn't make real HTTP calls.
jest.mock('../../tokens/tokenModule', () => {
  return {
    TokenManager: jest.fn().mockImplementation(() => ({
      fetchVerifiedList: jest.fn().mockResolvedValue([]),
      buildDisplayTokens: jest.fn().mockReturnValue([]),
    })),
  };
});

// Mock tokenMetadata so DAS + MMKV are not touched in tests.
jest.mock('../../tokens/tokenMetadata', () => ({
  fetchTokenMetadata: jest.fn().mockResolvedValue({}),
  loadCachedMetadata: jest.fn().mockReturnValue({}),
  saveCachedMetadata: jest.fn(),
}));

import {getBalance, getTokenAccounts} from '../../solana/queries';
import {NOC_MINT} from '../../../constants/programs';

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
        error: 'No wallet loaded',
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

    it('does not carry the RPC API key into the error it returns', async () => {
      // forceSync's `error` is returned into app state AND rendered verbatim in a
      // user-facing Alert on the Dashboard, so an upstream message that formats
      // the request URL would put the Helius key on screen. Asserted at the call
      // site, not only on the helper: a redaction nothing calls still passes its
      // own unit tests.
      useWalletStore.getState().setPublicKey(TEST_PUBLIC_KEY);
      const KEY = 'a852c8f4-e262-4a03-9a29-4e414edc87e5';
      const withUrl = new Error(
        `request to https://mainnet.helius-rpc.com/?api-key=${KEY} failed, reason: connect ETIMEDOUT`,
      );
      mockGetBalance.mockRejectedValue(withUrl);
      mockGetTokenAccounts.mockRejectedValue(withUrl);

      const result = await forceSync();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).not.toContain(KEY);
      expect(result.error).toContain('<redacted>');
      // The diagnosis must survive the redaction, or the error stops being useful.
      expect(result.error).toContain('ETIMEDOUT');
    });

    // post-M1d R1 / r2-5: a partial sync is a failed sync that writes nothing (was: success with a half-old figure)
    const seedStore = () => {
      useWalletStore.getState().setPublicKey(TEST_PUBLIC_KEY);
      useWalletStore.setState({
        solBalance: '111',
        nocBalance: '222',
        tokenBalances: {OldMint: '333'},
        tokens: [{mint: 'OldMint', symbol: 'OLD', name: 'Old', decimals: 6, trust: 'verified'}],
        lastSyncedAt: 1000,
        lastSyncFailedAt: null,
      });
    };
    const unchanged = () => {
      const s = useWalletStore.getState();
      expect(s.solBalance).toBe('111');
      expect(s.nocBalance).toBe('222');
      expect(s.tokenBalances).toEqual({OldMint: '333'});
      expect(s.tokens.map(t => t.mint)).toEqual(['OldMint']); // r3 note 2: the early return comes before setTokens
      expect(s.lastSyncedAt).toBe(1000);
      expect(s.lastSyncFailedAt).toEqual(expect.any(Number));
    };

    it('R1 / r2-5: the SOL read failing alone writes nothing, keeps lastSyncedAt, sets lastSyncFailedAt', async () => {
      seedStore();
      mockGetBalance.mockRejectedValue(new Error('RPC error'));
      mockGetTokenAccounts.mockResolvedValue([
        {mint: 'TokenMint1111', owner: TEST_PUBLIC_KEY, amount: '1000', decimals: 6, address: 'TokenAddr1'},
      ]);
      const result = await forceSync();
      expect(result).toMatchObject({success: false, partial: true, error: 'sol: RPC error'});
      unchanged();
    });

    it('R1 / r2-5: the token read failing alone writes nothing — the fresh SOL figure is NOT shown under the old age', async () => {
      seedStore();
      mockGetBalance.mockResolvedValue(BigInt(2_000_000_000));
      mockGetTokenAccounts.mockRejectedValue(new Error('timeout'));
      const result = await forceSync();
      expect(result).toMatchObject({success: false, partial: true, error: 'tokens: timeout'});
      unchanged();
    });

    it('R1: both reads failing writes nothing; partial is false', async () => {
      seedStore();
      mockGetBalance.mockRejectedValue(new Error('429 Too Many Requests'));
      mockGetTokenAccounts.mockRejectedValue(new Error('429 Too Many Requests'));
      const result = await forceSync();
      expect(result).toMatchObject({success: false, partial: false, error: '429 Too Many Requests'});
      unchanged();
    });

    it('R1: a thrown sync (no connection) sets lastSyncFailedAt too', async () => {
      seedStore();
      const {getConnection} = require('../../solana/connection');
      (getConnection as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Connection failed');
      });
      const result = await forceSync();
      expect(result).toMatchObject({success: false, partial: false});
      unchanged();
    });

    it('R1: a later full success writes everything and clears lastSyncFailedAt', async () => {
      seedStore();
      useWalletStore.getState().markSyncFailed();
      mockGetBalance.mockResolvedValue(BigInt(2_000_000_000));
      mockGetTokenAccounts.mockResolvedValue([]);
      const result = await forceSync();
      expect(result).toMatchObject({success: true, partial: false, solBalance: '2000000000'});
      const s = useWalletStore.getState();
      expect(s.solBalance).toBe('2000000000');
      expect(s.lastSyncedAt).toBeGreaterThan(1000);
      expect(s.lastSyncFailedAt).toBeNull();
    });

    // Rule: a successful token read that lists no NOC account is a read of zero, never the previous figure.
    it('a full success whose token read holds no NOC account → nocBalance "0", never the previous figure', async () => {
      seedStore(); // nocBalance '222'
      mockGetBalance.mockResolvedValue(BigInt(1));
      mockGetTokenAccounts.mockResolvedValue([
        {mint: 'TokenMint1111', owner: TEST_PUBLIC_KEY, amount: '1000', decimals: 6, address: 'TokenAddr1'},
      ]);
      const result = await forceSync();
      expect(result.success).toBe(true);
      expect(useWalletStore.getState().tokenBalances).toEqual({TokenMint1111: '1000'}); // positive control: this sync was written
      expect(useWalletStore.getState().nocBalance).toBe('0');
    });

    it('control: NOC held in two accounts → nocBalance is their sum', async () => {
      seedStore();
      mockGetBalance.mockResolvedValue(BigInt(1));
      mockGetTokenAccounts.mockResolvedValue([
        {mint: NOC_MINT, owner: TEST_PUBLIC_KEY, amount: '40', decimals: 9, address: 'Noc1'},
        {mint: NOC_MINT, owner: TEST_PUBLIC_KEY, amount: '2', decimals: 9, address: 'Noc2'},
      ]);
      await forceSync();
      expect(useWalletStore.getState().nocBalance).toBe('42');
    });

    it('a partial failure redacts the RPC key as a total one does', async () => {
      seedStore();
      const KEY = 'a852c8f4-e262-4a03-9a29-4e414edc87e5';
      mockGetBalance.mockRejectedValue(new Error(`request to https://mainnet.helius-rpc.com/?api-key=${KEY} failed`));
      mockGetTokenAccounts.mockResolvedValue([]);
      const result = await forceSync();
      expect(result.error).not.toContain(KEY);
      expect(result.error).toContain('<redacted>');
    });

    // Fix round 1 / 1: a throw after the write must not label the fresh figures stale
    it('a throw after the balances were written does not set lastSyncFailedAt', async () => {
      seedStore();
      mockGetBalance.mockResolvedValue(BigInt(5));
      mockGetTokenAccounts.mockResolvedValue([]);
      const {loadCachedMetadata} = require('../../tokens/tokenMetadata');
      (loadCachedMetadata as jest.Mock).mockImplementationOnce(() => {
        throw new Error('cache broke');
      });
      const result = await forceSync();
      expect(result.success).toBe(false);
      expect(useWalletStore.getState().solBalance).toBe('5'); // positive control: the write happened
      expect(useWalletStore.getState().lastSyncFailedAt).toBeNull();
    });

    // Fix round 1 / 2: a wallet reset/import while the reads are in flight
    it('a wallet change mid-read writes nothing to the new store (success path)', async () => {
      seedStore();
      mockGetBalance.mockImplementation(async () => {
        useWalletStore.getState().reset();
        useWalletStore.getState().setPublicKey('NewWallet1111');
        return BigInt(9);
      });
      mockGetTokenAccounts.mockResolvedValue([]);
      const result = await forceSync();
      expect(result).toMatchObject({success: false, partial: false, error: 'wallet changed'});
      const s = useWalletStore.getState();
      expect(s.publicKey).toBe('NewWallet1111');
      expect(s.solBalance).toBe('0');
      expect(s.lastSyncedAt).toBeNull();
      expect(s.lastSyncFailedAt).toBeNull();
    });

    it('a wallet change mid-read: the old wallet\'s failure is not marked on the new store', async () => {
      seedStore();
      mockGetBalance.mockImplementation(async () => {
        useWalletStore.getState().reset();
        useWalletStore.getState().setPublicKey('NewWallet1111');
        throw new Error('boom');
      });
      mockGetTokenAccounts.mockRejectedValue(new Error('boom'));
      const result = await forceSync();
      expect(result.error).toBe('wallet changed');
      expect(useWalletStore.getState().lastSyncFailedAt).toBeNull();
    });

    it('a wallet change, then a throw before any write: the new store is not marked failed', async () => {
      seedStore();
      const {getConnection} = require('../../solana/connection');
      (getConnection as jest.Mock).mockImplementationOnce(() => {
        useWalletStore.getState().reset();
        useWalletStore.getState().setPublicKey('NewWallet1111');
        throw new Error('Connection failed');
      });
      await forceSync();
      expect(useWalletStore.getState().lastSyncFailedAt).toBeNull();
    });

    it('a wallet change during the metadata fetch: the old wallet token list is not set on the new store', async () => {
      seedStore();
      mockGetBalance.mockResolvedValue(BigInt(5));
      mockGetTokenAccounts.mockResolvedValue([]);
      const {fetchTokenMetadata} = require('../../tokens/tokenMetadata');
      (fetchTokenMetadata as jest.Mock).mockImplementationOnce(async () => {
        useWalletStore.getState().reset();
        useWalletStore.getState().setPublicKey('NewWallet1111');
        return {};
      });
      const tm = require('../../tokens/tokenModule').TokenManager as jest.Mock;
      const built = [{mint: 'X', symbol: 'X', name: 'X', decimals: 1, trust: 'verified'}];
      (tm.mock.results as {value: {buildDisplayTokens: jest.Mock}}[]).forEach(r => r.value.buildDisplayTokens.mockReturnValue(built));
      const result = await forceSync();
      expect(result).toMatchObject({success: false, error: 'wallet changed'});
      expect(useWalletStore.getState().tokens).toEqual([]);
    });

    it('no wallet: nothing is marked failed (there is no figure to be stale)', async () => {
      const result = await forceSync();
      expect(result).toMatchObject({success: false, partial: false, error: 'No wallet loaded'});
      expect(useWalletStore.getState().lastSyncFailedAt).toBeNull();
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
      expect(result.error).toBe('Connection failed');
    });

    it('surfaces deduplicated RPC error when both fail with the same reason', async () => {
      useWalletStore.getState().setPublicKey(TEST_PUBLIC_KEY);

      mockGetBalance.mockRejectedValue(new Error('429 Too Many Requests'));
      mockGetTokenAccounts.mockRejectedValue(new Error('429 Too Many Requests'));

      const result = await forceSync();

      expect(result.success).toBe(false);
      expect(result.error).toBe('429 Too Many Requests');
    });

    it('concatenates BOTH RPC error reasons when they differ', async () => {
      useWalletStore.getState().setPublicKey(TEST_PUBLIC_KEY);

      mockGetBalance.mockRejectedValue(new Error('429 Too Many Requests'));
      mockGetTokenAccounts.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await forceSync();

      expect(result.success).toBe(false);
      expect(result.error).toBe('sol: 429 Too Many Requests; tokens: ECONNREFUSED');
    });
  });

  // final review m1: one sync in flight — a caller during a running sync shares it
  describe('forceSync single-flight', () => {
    const deferred = <T,>() => {
      let resolve!: (v: T) => void;
      const promise = new Promise<T>(r => {
        resolve = r;
      });
      return {promise, resolve};
    };

    it('two concurrent calls → one RPC read, both get the same result; a call after it settles reads again', async () => {
      useWalletStore.getState().setPublicKey(TEST_PUBLIC_KEY);
      const bal = deferred<bigint>();
      mockGetBalance.mockImplementationOnce(() => bal.promise);
      mockGetTokenAccounts.mockResolvedValue([]);

      const a = forceSync();
      const b = forceSync();
      expect(b).toBe(a);
      bal.resolve(BigInt(7));
      const [ra, rb] = await Promise.all([a, b]);
      expect(ra).toBe(rb);
      expect(ra.success).toBe(true);
      expect(ra.solBalance).toBe('7');
      expect(mockGetBalance).toHaveBeenCalledTimes(1);
      expect(mockGetTokenAccounts).toHaveBeenCalledTimes(1);

      mockGetBalance.mockResolvedValueOnce(BigInt(8));
      const c = forceSync();
      expect(c).not.toBe(a);
      const rc = await c;
      expect(rc.solBalance).toBe('8');
      expect(mockGetBalance).toHaveBeenCalledTimes(2);
    });

    it('a failed sync clears the in-flight slot too (the next call reads again)', async () => {
      useWalletStore.getState().setPublicKey(TEST_PUBLIC_KEY);
      mockGetBalance.mockRejectedValueOnce(new Error('boom'));
      mockGetTokenAccounts.mockResolvedValue([]);
      const r1 = await forceSync();
      expect(r1.success).toBe(false);
      mockGetBalance.mockResolvedValueOnce(BigInt(3));
      const r2 = await forceSync();
      expect(r2.success).toBe(true);
      expect(mockGetBalance).toHaveBeenCalledTimes(2);
    });

    it('a call for ANOTHER wallet while the old one is in flight is not handed the old wallet\'s sync', async () => {
      useWalletStore.getState().setPublicKey(TEST_PUBLIC_KEY);
      const bal = deferred<bigint>();
      mockGetBalance.mockImplementationOnce(() => bal.promise);
      mockGetTokenAccounts.mockResolvedValue([]);
      const old = forceSync();
      useWalletStore.getState().reset();
      useWalletStore.getState().setPublicKey('NewWallet1111');
      mockGetBalance.mockResolvedValueOnce(BigInt(4));
      const fresh = forceSync();
      expect(fresh).not.toBe(old);
      bal.resolve(BigInt(9));
      await expect(old).resolves.toMatchObject({error: 'wallet changed'});
      await expect(fresh).resolves.toMatchObject({success: true, solBalance: '4'});
    });

    it("an old wallet's sync settling does not clear the new wallet's in-flight slot", async () => {
      useWalletStore.getState().setPublicKey(TEST_PUBLIC_KEY);
      const oldBal = deferred<bigint>();
      const newBal = deferred<bigint>();
      mockGetBalance.mockImplementationOnce(() => oldBal.promise);
      mockGetTokenAccounts.mockResolvedValue([]);
      const old = forceSync();
      useWalletStore.getState().reset();
      useWalletStore.getState().setPublicKey('NewWallet1111');
      mockGetBalance.mockImplementationOnce(() => newBal.promise);
      const fresh = forceSync();
      oldBal.resolve(BigInt(9));
      await old; // its finally runs here; the slot belongs to the new wallet's sync
      expect(forceSync()).toBe(fresh);
      newBal.resolve(BigInt(5));
      await expect(fresh).resolves.toMatchObject({success: true, solBalance: '5'});
      expect(mockGetBalance).toHaveBeenCalledTimes(2);
    });
  });

  describe('registerBackgroundTask', () => {
    it('does not throw', () => {
      expect(() => registerBackgroundTask()).not.toThrow();
    });
  });
});
