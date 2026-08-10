import {redactUrlSecrets} from '../redactSecrets';

const KEY = 'a852c8f4-e262-4a03-9a29-4e414edc87e5';

describe('redactUrlSecrets', () => {
  it('removes the query string from an RPC URL, which is where the API key lives', () => {
    const out = redactUrlSecrets(
      `FetchError: request to https://mainnet.helius-rpc.com/?api-key=${KEY} failed`,
    );
    expect(out).not.toContain(KEY);
    expect(out).toContain('https://mainnet.helius-rpc.com/?<redacted>');
    expect(out).toContain('FetchError');
    expect(out).toContain('failed');
  });

  it('redacts every URL in the message, not only the first', () => {
    const out = redactUrlSecrets(
      `sol: request to https://a.example/?api-key=${KEY} failed; ` +
        `tokens: request to wss://b.example/?api-key=${KEY} failed`,
    );
    expect(out).not.toContain(KEY);
    expect(out.match(/<redacted>/g)).toHaveLength(2);
  });

  it('redacts the whole query, not just parameters that sound like secrets', () => {
    // The coordinator's own leak was a logger that redacted "key-sounding" params.
    // Anything after `?` is out of our control, so all of it goes.
    const out = redactUrlSecrets('https://api.example/v1/x?session=abc&tok=def');
    expect(out).toBe('https://api.example/v1/x?<redacted>');
  });

  it('leaves a URL with no query string intact — the endpoint is useful in a bug report', () => {
    expect(redactUrlSecrets('failed to reach https://api.devnet.solana.com')).toBe(
      'failed to reach https://api.devnet.solana.com',
    );
  });

  it('leaves text with no URL untouched', () => {
    expect(redactUrlSecrets('Network request failed')).toBe('Network request failed');
  });

  it('handles wss:// as well as https://', () => {
    expect(redactUrlSecrets(`wss://mainnet.helius-rpc.com/?api-key=${KEY}`)).toBe(
      'wss://mainnet.helius-rpc.com/?<redacted>',
    );
  });

  it('does not swallow text that follows the URL', () => {
    const out = redactUrlSecrets(`see https://x.example/?k=${KEY}, then retry`);
    expect(out).not.toContain(KEY);
    expect(out).toContain('then retry');
  });
});
