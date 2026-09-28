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

  // Date parsing strictness: only YYYY-MM-DD (as UTC) or full ISO-8601 with explicit offset.
  it('rejects timestamps without explicit UTC offset (no Z, no ±HH:MM)', () => {
    expect(
      evaluateListFreshness({...fresh, updatedAt: '2026-09-20T00:00:00', reviewedAt: '2026-09-20T00:00:00'}, NOW).reason,
    ).toBe('no_dates');
  });
  it('accepts timestamps with Z suffix', () => {
    expect(
      evaluateListFreshness({...fresh, updatedAt: '2026-09-20T00:00:00Z', reviewedAt: '2026-09-20T00:00:00Z'}, NOW).stale,
    ).toBe(false);
  });
  it('accepts timestamps with explicit +HH:MM offset', () => {
    // 2026-09-20T02:00:00+02:00 is the same instant as 2026-09-20T00:00:00Z, so it should be fresh.
    expect(
      evaluateListFreshness({...fresh, updatedAt: '2026-09-20T02:00:00+02:00', reviewedAt: '2026-09-20T02:00:00+02:00'}, NOW).stale,
    ).toBe(false);
  });
  it('rejects junk text after valid date', () => {
    expect(evaluateListFreshness({...fresh, updatedAt: '2026-09-20junktext', reviewedAt: '2026-09-20junktext'}, NOW).reason).toBe('no_dates');
  });
  it('rejects impossible dates (e.g., 2026-02-31)', () => {
    expect(evaluateListFreshness({...fresh, updatedAt: '2026-02-31', reviewedAt: '2026-02-31'}, NOW).reason).toBe('no_dates');
  });
  it('rejects maxStalenessDays of 0', () => {
    expect(evaluateListFreshness({...fresh, maxStalenessDays: 0}, NOW).stale).toBe(true);
  });
  it('rejects negative maxStalenessDays', () => {
    expect(evaluateListFreshness({...fresh, maxStalenessDays: -5}, NOW).stale).toBe(true);
  });
  it('rejects invalid now (NaN date)', () => {
    expect(evaluateListFreshness({...fresh}, new Date(NaN)).reason).toBe('too_old');
  });

  // Day-boundary tests: validate the date as written, not as UTC.
  it('accepts offset timestamp near day boundary (2026-09-20T01:00:00+02:00 = 2026-09-19T23:00:00Z)', () => {
    // The written date is 2026-09-20 but UTC instant is 2026-09-19T23:00:00Z, which is about 13 days old.
    const r = evaluateListFreshness({...fresh, updatedAt: '2026-09-20T01:00:00+02:00', reviewedAt: '2026-09-20T01:00:00+02:00'}, NOW);
    expect(r.stale).toBe(false);
    expect(r.ageDays).toBe(8); // Computed as (2026-09-28T12:00:00Z - 2026-09-19T23:00:00Z) / 86400000
  });
  it('accepts negative offset timestamp (2026-09-19T23:30:00-05:00)', () => {
    // 2026-09-19T23:30:00-05:00 is 2026-09-20T04:30:00Z, about 8 days old.
    const r = evaluateListFreshness({...fresh, updatedAt: '2026-09-19T23:30:00-05:00', reviewedAt: '2026-09-19T23:30:00-05:00'}, NOW);
    expect(r.stale).toBe(false);
  });
  it('accepts leap-year date 2028-02-29', () => {
    // 2028 is a leap year, so Feb 29 is valid. Judged from the day after, so the future-date
    // rule below does not decide the outcome — only the parser does.
    const after = new Date('2028-03-01T00:00:00Z');
    expect(evaluateListFreshness({...fresh, updatedAt: '2028-02-29', reviewedAt: '2028-02-29'}, after).reason).toBe(null);
  });
  it('rejects non-leap-year date 2027-02-29', () => {
    // 2027 is not a leap year, so Feb 29 is invalid. Judged from the day after, where a parser
    // that accepted it (as 2027-03-01) would report the list fresh.
    const after = new Date('2027-03-01T00:00:00Z');
    expect(evaluateListFreshness({...fresh, updatedAt: '2027-02-29', reviewedAt: '2027-02-29'}, after).reason).toBe('no_dates');
  });
  it('rejects hour 24 (2026-09-20T24:00:00Z)', () => {
    expect(evaluateListFreshness({...fresh, updatedAt: '2026-09-20T24:00:00Z', reviewedAt: '2026-09-20T24:00:00Z'}, NOW).reason).toBe('no_dates');
  });
  it('rejects invalid month (2026-13-01)', () => {
    expect(evaluateListFreshness({...fresh, updatedAt: '2026-13-01', reviewedAt: '2026-13-01'}, NOW).reason).toBe('no_dates');
  });

  // A list dated in the future is a broken or lying server, not a fresh list: more than one
  // day ahead of `now` (the tolerance covers time zones and small clock skew) is stale.
  describe('future dates', () => {
    const at = (d: string) => evaluateListFreshness({...fresh, updatedAt: d, reviewedAt: d}, NOW);
    it('just under one day ahead is accepted', () => {
      expect(at('2026-09-29T11:59:59Z').stale).toBe(false);
    });
    it('exactly one day ahead is accepted', () => {
      expect(at('2026-09-29T12:00:00Z').stale).toBe(false);
    });
    it('just over one day ahead is stale', () => {
      expect(at('2026-09-29T12:00:01Z')).toEqual({stale: true, reason: 'no_dates', ageDays: null});
    });
    it('a date-only value tomorrow is accepted, the day after is stale', () => {
      expect(at('2026-09-29').stale).toBe(false);
      expect(at('2026-09-30')).toMatchObject({stale: true, reason: 'no_dates'});
    });
    it('a far-future date is stale even with a fresh date beside it and stale:false from the server', () => {
      expect(evaluateListFreshness({...fresh, updatedAt: '2099-01-01', reviewedAt: '2026-09-25'}, NOW)).toMatchObject({stale: true, reason: 'no_dates'});
      expect(evaluateListFreshness({...fresh, updatedAt: '2026-09-25', reviewedAt: '2099-01-01'}, NOW)).toMatchObject({stale: true, reason: 'no_dates'});
    });
    it('an offset timestamp is compared as the instant it names', () => {
      // 2026-09-29T13:30:00+02:00 is 11:30Z — under one day ahead.
      expect(at('2026-09-29T13:30:00+02:00').stale).toBe(false);
      // 2026-09-29T11:30:00-02:00 is 13:30Z — over one day ahead.
      expect(at('2026-09-29T11:30:00-02:00').stale).toBe(true);
    });
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
