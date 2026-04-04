import {GeoFenceManager} from '../geoFenceModule';
import type {JurisdictionResult} from '../geoFenceModule';
import {pinnedFetch} from '../../sslPinning/pinnedFetch';
import {mmkvPublic} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';
import {BUNDLED_RESTRICTED_LIST} from '../restrictedList';

// Mock pinnedFetch
jest.mock('../../sslPinning/pinnedFetch', () => ({
  pinnedFetch: jest.fn(),
}));

const mockPinnedFetch = pinnedFetch as jest.MockedFunction<typeof pinnedFetch>;

/**
 * Helper: build a mock PinnedFetchResponse that returns the given JSON payload.
 */
function makeFetchResponse(payload: unknown, status = 200) {
  return {
    status,
    headers: {},
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as Awaited<ReturnType<typeof pinnedFetch>>;
}

describe('GeoFenceManager', () => {
  let manager: GeoFenceManager;

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear MMKV state between tests
    mmkvPublic.clearAll();
    manager = new GeoFenceManager();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Allow — unrestricted country (US)
  // ──────────────────────────────────────────────────────────────────────────
  it('returns allow for unrestricted country (US)', async () => {
    mockPinnedFetch.mockResolvedValueOnce(
      makeFetchResponse({countryCode: 'US', isVpn: false}),
    );

    const result: JurisdictionResult = await manager.checkJurisdiction();

    expect(result.action).toBe('allow');
    expect(result.countryCode).toBe('US');
    expect(result.reason).toBeUndefined();
    expect(result.transparentAllowed).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Warn — restricted country (CN)
  // ──────────────────────────────────────────────────────────────────────────
  it('returns warn with restricted reason for restricted country (CN)', async () => {
    mockPinnedFetch.mockResolvedValueOnce(
      makeFetchResponse({countryCode: 'CN', isVpn: false}),
    );

    const result: JurisdictionResult = await manager.checkJurisdiction();

    expect(result.action).toBe('warn');
    expect(result.countryCode).toBe('CN');
    expect(result.reason).toBe('restricted');
    expect(result.transparentAllowed).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Block — OFAC sanctioned country (KP)
  // ──────────────────────────────────────────────────────────────────────────
  it('returns block with sanctioned reason for OFAC sanctioned country (KP)', async () => {
    mockPinnedFetch.mockResolvedValueOnce(
      makeFetchResponse({countryCode: 'KP', isVpn: false}),
    );

    const result: JurisdictionResult = await manager.checkJurisdiction();

    expect(result.action).toBe('block');
    expect(result.countryCode).toBe('KP');
    expect(result.reason).toBe('sanctioned');
    expect(result.transparentAllowed).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Warn — VPN detected
  // ──────────────────────────────────────────────────────────────────────────
  it('returns warn with vpn_detected reason when VPN is detected', async () => {
    mockPinnedFetch.mockResolvedValueOnce(
      makeFetchResponse({countryCode: 'US', isVpn: true}),
    );

    const result: JurisdictionResult = await manager.checkJurisdiction();

    expect(result.action).toBe('warn');
    expect(result.reason).toBe('vpn_detected');
    expect(result.transparentAllowed).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Warn — API failure (fail-safe, never silent block)
  // ──────────────────────────────────────────────────────────────────────────
  it('returns warn with ambiguous reason on API failure', async () => {
    mockPinnedFetch.mockRejectedValueOnce(new Error('Network request failed'));

    const result: JurisdictionResult = await manager.checkJurisdiction();

    expect(result.action).toBe('warn');
    expect(result.reason).toBe('ambiguous');
    expect(result.transparentAllowed).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. transparentAllowed is always true even when blocked
  // ──────────────────────────────────────────────────────────────────────────
  it('transparentAllowed is always true even when blocked', async () => {
    // Sanctioned → block
    mockPinnedFetch.mockResolvedValueOnce(
      makeFetchResponse({countryCode: 'IR', isVpn: false}),
    );
    const blocked = await manager.checkJurisdiction();
    expect(blocked.action).toBe('block');
    expect(blocked.transparentAllowed).toBe(true);

    // Ambiguous → warn
    mockPinnedFetch.mockRejectedValueOnce(new Error('timeout'));
    const ambiguous = await manager.checkJurisdiction();
    expect(ambiguous.action).toBe('warn');
    expect(ambiguous.transparentAllowed).toBe(true);

    // Allow
    mockPinnedFetch.mockResolvedValueOnce(
      makeFetchResponse({countryCode: 'DE', isVpn: false}),
    );
    const allowed = await manager.checkJurisdiction();
    expect(allowed.action).toBe('allow');
    expect(allowed.transparentAllowed).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. setKycCountry overrides IP-based detection
  // ──────────────────────────────────────────────────────────────────────────
  it('setKycCountry overrides IP-based detection', async () => {
    // Set KYC country to a restricted country
    manager.setKycCountry('CN');

    // Even though the API would return US, KYC country takes precedence
    // (no fetch should be called when KYC country is set)
    const result = await manager.checkJurisdiction();

    expect(mockPinnedFetch).not.toHaveBeenCalled();
    expect(result.countryCode).toBe('CN');
    expect(result.action).toBe('warn');
    expect(result.reason).toBe('restricted');
    expect(result.transparentAllowed).toBe(true);
  });

  it('setKycCountry persists to MMKV', () => {
    manager.setKycCountry('JP');
    const stored = mmkvPublic.getString(MMKV_KEYS.GEO_KYC_COUNTRY);
    expect(stored).toBe('JP');
  });

  it('setKycCountry is loaded from MMKV on construction', async () => {
    // Pre-seed MMKV with a KYC country
    mmkvPublic.set(MMKV_KEYS.GEO_KYC_COUNTRY, 'KP');

    const freshManager = new GeoFenceManager();
    const result = await freshManager.checkJurisdiction();

    expect(mockPinnedFetch).not.toHaveBeenCalled();
    expect(result.countryCode).toBe('KP');
    expect(result.action).toBe('block');
    expect(result.reason).toBe('sanctioned');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Restricted list caching works
  // ──────────────────────────────────────────────────────────────────────────
  it('uses cached restricted list when cache is fresh (< 6 hours old)', async () => {
    // Store a custom restricted list in MMKV with a fresh timestamp
    const customList = [{code: 'XX', category: 'sanctioned'}];
    const freshTs = Date.now() - 1 * 60 * 60 * 1000; // 1 hour ago
    mmkvPublic.set(MMKV_KEYS.GEO_RESTRICTED_LIST, JSON.stringify(customList));
    mmkvPublic.set(MMKV_KEYS.GEO_RESTRICTED_LIST_AT, String(freshTs));

    const freshManager = new GeoFenceManager();

    mockPinnedFetch
      // First call: geo check returns XX
      .mockResolvedValueOnce(
        makeFetchResponse({countryCode: 'XX', isVpn: false}),
      );

    const result = await freshManager.checkJurisdiction();

    expect(result.countryCode).toBe('XX');
    expect(result.action).toBe('block');
    expect(result.reason).toBe('sanctioned');
  });

  it('falls back to bundled list when cache is stale (> 6 hours old)', async () => {
    // Store a list with ONLY 'XX' sanctioned — stale timestamp (7 hours ago)
    const staleList = [{code: 'XX', category: 'sanctioned'}];
    const staleTs = Date.now() - 7 * 60 * 60 * 1000;
    mmkvPublic.set(MMKV_KEYS.GEO_RESTRICTED_LIST, JSON.stringify(staleList));
    mmkvPublic.set(MMKV_KEYS.GEO_RESTRICTED_LIST_AT, String(staleTs));

    const freshManager = new GeoFenceManager();

    // geo check returns KP (in bundled list as sanctioned)
    mockPinnedFetch
      .mockResolvedValueOnce(
        makeFetchResponse({countryCode: 'KP', isVpn: false}),
      )
      // background refresh of the restricted list — return the stale list again
      .mockResolvedValueOnce(
        makeFetchResponse([{code: 'XX', category: 'sanctioned'}]),
      );

    const result = await freshManager.checkJurisdiction();

    // Falls back to bundled list → KP is sanctioned in the bundled list
    expect(result.countryCode).toBe('KP');
    expect(result.action).toBe('block');
    expect(result.reason).toBe('sanctioned');
  });

  it('bundled list contains the expected OFAC sanctioned and restricted countries', () => {
    const sanctioned = BUNDLED_RESTRICTED_LIST.filter(
      c => c.category === 'sanctioned',
    ).map(c => c.code);
    const restricted = BUNDLED_RESTRICTED_LIST.filter(
      c => c.category === 'restricted',
    ).map(c => c.code);

    expect(sanctioned).toEqual(
      expect.arrayContaining(['CU', 'IR', 'KP', 'SY', 'RU']),
    );
    expect(restricted).toEqual(
      expect.arrayContaining(['CN', 'MM', 'BY', 'VE', 'ZW']),
    );
  });
});
