import {pinnedFetch, SSL_PINS, SSLPinningError} from '../pinnedFetch';
import SSLPinning from 'react-native-ssl-pinning';

const mockSSL = SSLPinning as typeof SSLPinning & {__reset: () => void};

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

  it('makes a GET request through SSL pinning', async () => {
    await pinnedFetch('https://api.noc-tura.io/v1/health');
    expect(SSLPinning.fetch).toHaveBeenCalledWith(
      'https://api.noc-tura.io/v1/health',
      expect.objectContaining({
        method: 'GET',
        sslPinning: expect.objectContaining({
          certs: expect.any(Array),
        }),
      }),
    );
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

  it('throws SSLPinningError with E032 code on SSL pin failure', async () => {
    (SSLPinning.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('SSL certificate pinning verification failed'),
    );
    try {
      await pinnedFetch('https://api.noc-tura.io/v1/health');
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(SSLPinningError);
      expect((err as SSLPinningError).code).toBe('E032');
    }
  });

  it('re-throws network errors without wrapping as E032', async () => {
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
