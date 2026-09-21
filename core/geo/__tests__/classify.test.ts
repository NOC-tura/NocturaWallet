import {classifyJurisdiction, isPresaleBlocked} from '../classify';

const LIST = [
  {code: 'IR', category: 'sanctioned' as const},
  {code: 'RO', category: 'restricted' as const},
];

describe('classifyJurisdiction — default order, as the app has always behaved', () => {
  it('blocks a sanctioned jurisdiction', () => {
    const r = classifyJurisdiction({countryCode: 'IR', isVpn: false}, LIST);
    expect(r.action).toBe('block');
    expect(r.reason).toBe('sanctioned');
    expect(isPresaleBlocked(r)).toBe(true);
  });

  it('warns, and does not block, on a merely restricted country', () => {
    const r = classifyJurisdiction({countryCode: 'RO', isVpn: false}, LIST);
    expect(r.action).toBe('warn');
    expect(r.reason).toBe('restricted');
    expect(isPresaleBlocked(r)).toBe(false);
  });

  it('allows an unlisted country with no VPN (positive control)', () => {
    const r = classifyJurisdiction({countryCode: 'SI', isVpn: false}, LIST);
    expect(r.action).toBe('allow');
    expect(isPresaleBlocked(r)).toBe(false);
  });

  it('warns on a VPN, and a VPN outranks the country — the app behaviour, kept', () => {
    expect(classifyJurisdiction({countryCode: 'SI', isVpn: true}, LIST).reason).toBe('vpn_detected');
    // The case nobody had tested: a sanctioned country behind a VPN flag.
    const sanctionedOnVpn = classifyJurisdiction({countryCode: 'IR', isVpn: true}, LIST);
    expect(sanctionedOnVpn.action).toBe('warn');
    expect(isPresaleBlocked(sanctionedOnVpn)).toBe(false);
  });

  it('always permits transparent use, whatever the verdict', () => {
    for (const cc of ['IR', 'RO', 'SI']) {
      expect(classifyJurisdiction({countryCode: cc, isVpn: true}, LIST).transparentAllowed).toBe(true);
      expect(classifyJurisdiction({countryCode: cc, isVpn: false}, LIST).transparentAllowed).toBe(true);
    }
  });
});

describe('classifyJurisdiction — sanctionedWinsOverVpn, for a public sale surface', () => {
  const strict = {sanctionedWinsOverVpn: true};

  it('blocks a sanctioned country even when the IP is flagged as a VPN', () => {
    const r = classifyJurisdiction({countryCode: 'IR', isVpn: true}, LIST, strict);
    expect(r.action).toBe('block');
    expect(r.reason).toBe('sanctioned');
    expect(isPresaleBlocked(r)).toBe(true);
  });

  it('still only warns for a VPN in an unlisted country', () => {
    const r = classifyJurisdiction({countryCode: 'SI', isVpn: true}, LIST, strict);
    expect(r.action).toBe('warn');
    expect(r.reason).toBe('vpn_detected');
  });

  it('does not change the verdict when no VPN is involved (control)', () => {
    for (const cc of ['IR', 'RO', 'SI']) {
      expect(classifyJurisdiction({countryCode: cc, isVpn: false}, LIST, strict)).toEqual(
        classifyJurisdiction({countryCode: cc, isVpn: false}, LIST),
      );
    }
  });
});
