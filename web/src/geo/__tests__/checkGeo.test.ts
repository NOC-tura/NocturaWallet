const h = vi.hoisted(() => ({get: vi.fn()}));
vi.mock('../../lib/api', () => ({json: {get: h.get}}));

import {checkGeo} from '../useGeo';
import {isPresaleBlocked} from '../../../../core/geo/classify';

const SERVER_LIST = {
  success: true,
  data: {
    countries: [
      {code: 'IR', category: 'sanctioned'},
      {code: 'RO', category: 'restricted'},
    ],
    updated_at: '2026-04-04',
    age_days: 170,
    stale: true,
  },
};

// Block body on purpose: `() => h.get.mockReset()` returns the mock, and Vitest treats
// a function returned from beforeEach as a teardown hook — it then CALLS the mock with
// no arguments after every test. A stub that throws for unknown input then fails the
// test it already passed.
beforeEach(() => {
  h.get.mockReset();
});

describe('checkGeo', () => {
  it('blocks a sanctioned country', async () => {
    h.get.mockImplementation(async (p: string) =>
      p === '/geo/check' ? {countryCode: 'IR', isVpn: false} : SERVER_LIST,
    );
    const {result, listSource} = await checkGeo();
    expect(isPresaleBlocked(result)).toBe(true);
    expect(listSource).toBe('server');
  });

  it('blocks a sanctioned country even behind a VPN flag — stricter than the app', async () => {
    h.get.mockImplementation(async (p: string) =>
      p === '/geo/check' ? {countryCode: 'IR', isVpn: true} : SERVER_LIST,
    );
    expect(isPresaleBlocked((await checkGeo()).result)).toBe(true);
  });

  it('allows an unlisted country (positive control)', async () => {
    h.get.mockImplementation(async (p: string) =>
      p === '/geo/check' ? {countryCode: 'SI', isVpn: false} : SERVER_LIST,
    );
    const {result} = await checkGeo();
    expect(result.action).toBe('allow');
    expect(isPresaleBlocked(result)).toBe(false);
  });

  it('still blocks a sanctioned country when the list endpoint fails', async () => {
    // /geo/restricted-list returns 404 in production today. Without the bundled
    // fallback the page could block nobody, including the jurisdictions the gate is for.
    h.get.mockImplementation(async (p: string) => {
      if (p === '/geo/check') return {countryCode: 'IR', isVpn: false};
      throw new Error('HTTP 404');
    });
    const {result, listSource} = await checkGeo();
    expect(isPresaleBlocked(result)).toBe(true);
    expect(listSource).toBe('bundled');
  });

  it('THROWS when the country lookup itself fails — spec 6.8, not the app warn', async () => {
    h.get.mockImplementation(async (p: string) => {
      if (p === '/geo/check') throw new Error('HTTP 503');
      return SERVER_LIST;
    });
    await expect(checkGeo()).rejects.toThrow();
  });

  it('reports the list age rather than presenting a stale list as current', async () => {
    h.get.mockImplementation(async (p: string) =>
      p === '/geo/check' ? {countryCode: 'SI', isVpn: false} : SERVER_LIST,
    );
    const g = await checkGeo();
    expect(g.listStale).toBe(true);
    expect(g.listUpdatedAt).toBe('2026-04-04');
  });
});
