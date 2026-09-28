import {evaluateListFreshness, presaleGeoGate} from '../freshness';
import type {JurisdictionResult} from '../classify';

const NOW = new Date('2026-09-28T12:00:00Z');
const fresh = {source: 'server' as const, updatedAt: '2026-09-20', reviewedAt: '2026-09-20', maxStalenessDays: 30, serverStale: false};
const allow: JurisdictionResult = {action: 'allow', countryCode: 'SI', transparentAllowed: true};

describe('evaluateListFreshness', () => {
  it('a server list inside its limit is fresh', () => {
    expect(evaluateListFreshness(fresh, NOW)).toEqual({stale: false, reason: null, ageDays: 8});
  });
  it('the bundled fallback is always stale', () => {
    expect(evaluateListFreshness({source: 'bundled', updatedAt: '2026-09-27'}, NOW).reason).toBe('bundled');
  });
  it('missing dates are stale', () => {
    expect(evaluateListFreshness({source: 'server', maxStalenessDays: 30, serverStale: false}, NOW).reason).toBe('no_dates');
  });
  it('unparsable dates are stale', () => {
    expect(evaluateListFreshness({...fresh, updatedAt: 'soon', reviewedAt: 'soon'}, NOW).reason).toBe('no_dates');
  });
  it('a missing limit is stale', () => {
    expect(evaluateListFreshness({...fresh, maxStalenessDays: undefined}, NOW).stale).toBe(true);
  });
  it('server stale:false never overrides a local age above the limit', () => {
    const r = evaluateListFreshness({...fresh, updatedAt: '2026-04-04', reviewedAt: '2026-04-04'}, NOW);
    expect(r).toMatchObject({stale: true, reason: 'too_old'});
  });
  it('server stale:true is stale even when young', () => {
    expect(evaluateListFreshness({...fresh, serverStale: true}, NOW).reason).toBe('server_says_stale');
  });
  it('uses the later of updatedAt and reviewedAt', () => {
    expect(evaluateListFreshness({...fresh, updatedAt: '2026-04-04', reviewedAt: '2026-09-25'}, NOW).stale).toBe(false);
  });
});

describe('presaleGeoGate', () => {
  const ok = evaluateListFreshness(fresh, NOW);
  it('opens for a fresh list and an allowed country (positive control)', () => {
    expect(presaleGeoGate({freshness: ok, jurisdiction: allow})).toEqual({open: true, reason: null});
  });
  it('closes on a stale list', () => {
    expect(presaleGeoGate({freshness: evaluateListFreshness({source: 'bundled'}, NOW), jurisdiction: allow}).reason).toBe('stale_list');
  });
  it('closes when the check did not happen', () => {
    expect(presaleGeoGate({freshness: ok, jurisdiction: null}).reason).toBe('no_check');
  });
  it.each(['', 'XX', 'UNKNOWN', 'zz', 'S'])('closes on unknown country code %j', code => {
    expect(presaleGeoGate({freshness: ok, jurisdiction: {...allow, countryCode: code}}).reason).toBe('unknown_country');
  });
  it('closes on a sanctioned block', () => {
    expect(
      presaleGeoGate({freshness: ok, jurisdiction: {action: 'block', countryCode: 'IR', reason: 'sanctioned', transparentAllowed: true}}).reason,
    ).toBe('sanctioned');
  });
});
