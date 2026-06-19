import SSLPinning from 'react-native-ssl-pinning';

/**
 * SPKI public-key pins for api.noc-tura.io (SHA-256 of the SubjectPublicKeyInfo,
 * `sha256/<base64>` — OkHttp/AFNetworking format). The lib matches ANY cert in
 * the served chain, so we pin the leaf AND the Let's Encrypt intermediate:
 * a leaf renewal (even with a new key) still validates against the intermediate,
 * so certbot rotation can't brick the app. Server should also renew with
 * `--reuse-key` to keep the leaf pin stable. If no pin matches the live cert,
 * ALL backend calls fail the pin check and the app falls back to the direct path.
 */
// Verified from the VPS 2026-06-18 (both MATCH the live cert). Server renews
// with reuse_key=True so the LEAF pin survives ~90-day Let's Encrypt renewals;
// the INTERMEDIATE is the backup. A systemd noc-pin-check.timer monitors these
// daily. RULE on rotation: update BOTH this array AND the server's
// scripts/check-ssl-pins.sh, and ship the new app version BEFORE the new cert.
export const SSL_PINS: string[] = [
  'sha256/r6OlpjBVoTMRSS9o9JFTgtzC8KyrVYI6OAmKQGhf9Y8=', // LEAF (primary)
  'sha256/iFvwVyJSxnQdyaUvUERIf+8qk7gRze3612JMwoO3zdU=', // INTERMEDIATE Let's Encrypt (backup)
];

interface PinnedFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
}

interface PinnedFetchResponse {
  status: number;
  headers: Record<string, string>;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

export class SSLPinningError extends Error {
  readonly code = 'E032';
  readonly cause: Error;

  constructor(message: string, cause: Error) {
    super(message);
    this.name = 'SSLPinningError';
    this.cause = cause;
  }
}

/**
 * SSL-pinned fetch wrapper for Noctura API calls.
 * All requests to api.noc-tura.io MUST go through this function.
 * On pin failure → throws SSLPinningError (E032).
 */
export async function pinnedFetch(
  url: string,
  options: PinnedFetchOptions = {},
): Promise<PinnedFetchResponse> {
  const {method = 'GET', headers = {}, body} = options;

  const mergedHeaders: Record<string, string> = {...headers};
  if (body && !mergedHeaders['Content-Type']) {
    mergedHeaders['Content-Type'] = 'application/json';
  }

  try {
    const response = await SSLPinning.fetch(url, {
      method,
      headers: mergedHeaders,
      body,
      pkPinning: true,
      sslPinning: {
        certs: SSL_PINS,
      },
      timeoutInterval: 10_000,
    });

    return {
      status: response.status,
      headers: response.headers as Record<string, string>,
      json: async () => response.json(),
      text: async () => response.text(),
    };
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error));
    const message = cause.message.toLowerCase();
    // Differentiate SSL pin failures from network errors
    if (
      message.includes('ssl') ||
      message.includes('pin') ||
      message.includes('certificate') ||
      message.includes('trust')
    ) {
      throw new SSLPinningError('SSL certificate pinning failed', cause);
    }
    // Re-throw transport errors (timeout, DNS, etc.) without wrapping as E032
    throw cause;
  }
}
