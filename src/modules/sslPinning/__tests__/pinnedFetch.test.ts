import {pinnedFetch, SSL_PINS, SSLPinningError} from '../pinnedFetch';
import * as SSLPinning from 'react-native-ssl-pinning';

const mockSSL = SSLPinning as unknown as typeof SSLPinning & {__reset: () => void};

describe('pinnedFetch', () => {
  beforeEach(() => {
    mockSSL.__reset();
  });

  it('SSL_PINS contains primary and backup pins', () => {
    expect(SSL_PINS.length).toBeGreaterThanOrEqual(2);
    SSL_PINS.forEach(pin => {
      expect(typeof pin).toBe('string');
      expect(pin.length).toBeGreaterThan(0);
    });
  });

  it('makes a GET request through SSL pinning with public-key pinning enabled', async () => {
    await pinnedFetch('https://api.noc-tura.io/api/v1/health');
    expect(SSLPinning.fetch).toHaveBeenCalledWith(
      'https://api.noc-tura.io/api/v1/health',
      expect.objectContaining({
        method: 'GET',
        pkPinning: true,
        sslPinning: expect.objectContaining({
          certs: expect.any(Array),
        }),
      }),
    );
  });

  it('all SSL_PINS use the sha256/ public-key format', () => {
    SSL_PINS.forEach(pin => expect(pin.startsWith('sha256/')).toBe(true));
  });

  it('makes a POST request with JSON body', async () => {
    await pinnedFetch('https://api.noc-tura.io/v1/prove/deposit', {
      method: 'POST',
      body: JSON.stringify({test: true}),
    });
    expect(SSLPinning.fetch).toHaveBeenCalledWith(
      'https://api.noc-tura.io/v1/prove/deposit',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({test: true}),
      }),
    );
  });

  it('includes content-type header for JSON', async () => {
    await pinnedFetch('https://api.noc-tura.io/v1/test', {
      method: 'POST',
      body: '{}',
    });
    expect(SSLPinning.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('throws SSLPinningError with E004 code on SSL pin failure', async () => {
    (SSLPinning.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('SSL certificate pinning verification failed'),
    );
    try {
      await pinnedFetch('https://api.noc-tura.io/v1/health');
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(SSLPinningError);
      expect((err as SSLPinningError).code).toBe('E004');
    }
  });

  it('re-throws network errors without wrapping as E004', async () => {
    (SSLPinning.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network request failed'),
    );
    try {
      await pinnedFetch('https://api.noc-tura.io/v1/health');
      fail('Should have thrown');
    } catch (err) {
      expect(err).not.toBeInstanceOf(SSLPinningError);
      expect((err as Error).message).toBe('Network request failed');
    }
  });
});

describe('non-2xx responses (react-native-ssl-pinning REJECTS these)', () => {
  // The native module invokes the callback with the RESPONSE as the error
  // argument whenever `!okHttpResponse.isSuccessful()`
  // (RNSslPinningModule.java:238-241), and the JS wrapper then does
  // `deferred.reject(data)` with a plain object (index.js:43). pinnedFetch's
  // catch did `error instanceof Error ? error : new Error(String(error))`, so
  // the object stringified to "[object Object]" and the STATUS WAS DESTROYED.
  //
  // Consequence on device: relayerSubmit never saw 409/429/502/503, so its
  // entire status machine — including the "already landed vs input-spent-
  // elsewhere" 409 disambiguation — was unreachable, and a transfer that DID
  // land reported failure, leaving the input note unspent forever.
  const rejectWith = (value: unknown) => {
    (SSLPinning.fetch as jest.Mock).mockRejectedValue(value);
  };

  it('returns a response for a 409 instead of throwing', async () => {
    rejectWith({status: 409, headers: {}, bodyString: '{"outcome":"already_spent"}'});
    const res = await pinnedFetch('https://api.noc-tura.io/v1/relayer/submit');
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({outcome: 'already_spent'});
  });

  it('preserves 429, 502 and 503 too', async () => {
    for (const status of [429, 502, 503]) {
      rejectWith({status, headers: {}, bodyString: '{}'});
      // eslint-disable-next-line no-await-in-loop
      const res = await pinnedFetch('https://api.noc-tura.io/v1/x');
      expect(res.status).toBe(status);
    }
  });

  it('exposes the body as text for a non-JSON error page', async () => {
    rejectWith({status: 502, headers: {}, bodyString: '<html>bad gateway</html>'});
    const res = await pinnedFetch('https://api.noc-tura.io/v1/x');
    await expect(res.text()).resolves.toBe('<html>bad gateway</html>');
  });

  it('still throws SSLPinningError on a real pin failure', async () => {
    rejectWith(new Error('SSL certificate pinning failure'));
    await expect(pinnedFetch('https://api.noc-tura.io/v1/x')).rejects.toBeInstanceOf(
      SSLPinningError,
    );
  });

  it('still rethrows a genuine transport error', async () => {
    rejectWith(new Error('Network request timed out'));
    await expect(pinnedFetch('https://api.noc-tura.io/v1/x')).rejects.toThrow(/timed out/);
  });
});

describe('end-to-end through the real library mock', () => {
  it('a native-layer 409 arrives as a readable status, not [object Object]', async () => {
    // Drives the mock the way the native module actually behaves (reject on
    // non-2xx) rather than by stubbing pinnedFetch's own dependency, so this
    // exercises the whole chain: native reject -> wrapper reject -> pinnedFetch
    // normalisation -> caller reads .status. That chain is what was broken.
    mockSSL.__reset();
    (SSLPinning as unknown as {__setResponse: (r: object) => void}).__setResponse({
      status: 409,
      bodyString: '{"outcome":"already_spent","alreadySpentIndexes":[1]}',
    });

    const res = await pinnedFetch('https://api.noc-tura.io/v1/relayer/submit', {
      method: 'POST',
      body: '{}',
    });

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      outcome: 'already_spent',
      alreadySpentIndexes: [1],
    });
  });
});

/**
 * Silent no-op guards (2026-09-18).
 *
 * OkHttp's CertificatePinner starts with `findMatchingPins(hostname)` and, on an
 * empty result, RETURNS WITHOUT CHECKING ANYTHING. Two shapes of URL reach that
 * branch, and both look exactly like a successful pinned call:
 *
 *  - a `www.` host: react-native-ssl-pinning registers pins under the host with
 *    a leading `www.` stripped (RNSslPinningModule.getDomainName), while OkHttp
 *    asks for the full host — no pin matches the pattern, so pinning is off.
 *  - a plaintext `http://` URL: no TLS, so there is no chain to pin at all.
 *
 * A pinned call that silently is not pinned is worse than an error, so both are
 * refused before the request leaves.
 */
describe('pinnedFetch — refuses URLs where pinning would silently not apply', () => {
  beforeEach(() => {
    mockSSL.__reset();
  });

  it('rejects a www. host and never issues the request', async () => {
    await expect(pinnedFetch('https://www.noc-tura.io/api/v1/health')).rejects.toThrow(
      SSLPinningError,
    );
    expect(SSLPinning.fetch).not.toHaveBeenCalled();
  });

  it('rejects a plaintext http:// URL and never issues the request', async () => {
    await expect(pinnedFetch('http://api.noc-tura.io/api/v1/health')).rejects.toThrow(
      SSLPinningError,
    );
    expect(SSLPinning.fetch).not.toHaveBeenCalled();
  });

  it('allows a host that merely contains www elsewhere', async () => {
    await pinnedFetch('https://wwwapi.noc-tura.io/health');
    expect(SSLPinning.fetch).toHaveBeenCalled();
  });

  it('allows the production host (control)', async () => {
    await pinnedFetch('https://api.noc-tura.io/api/v1/health');
    expect(SSLPinning.fetch).toHaveBeenCalled();
  });

  it('allows an arbitrary https host — the probe must be able to reach any of them', async () => {
    await pinnedFetch('https://dao.noc-tura.io/vote');
    expect(SSLPinning.fetch).toHaveBeenCalled();
  });
});
