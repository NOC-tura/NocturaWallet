import {deriveExtensionOrigin} from '../ext';

describe('deriveExtensionOrigin', () => {
  it('returns protocol+host for a URL whose origin the parser actually computes', () => {
    expect(deriveExtensionOrigin('https://wallet.noc-tura.io/unlock.html')).toBe('https://wallet.noc-tura.io');
  });

  it('throws on a scheme this parser gives a "null" origin to — fail closed rather than trust it', () => {
    // Real Chrome/Firefox compute a proper web-exposed origin for their own extension scheme
    // (Chrome registers chrome-extension: as standard; Firefox's moz-extension: carries
    // URI_HAS_WEB_EXPOSED_ORIGIN), but Node's URL implementation — this test environment — does
    // not know the scheme and reports the literal string "null" for `.origin`. That mismatch is
    // exactly the case this function must refuse to paper over.
    expect(() => deriveExtensionOrigin('chrome-extension://abcdefghijklmnopabcdefghijklmnop/')).toThrow();
  });
});
