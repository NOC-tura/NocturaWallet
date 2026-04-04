import SSLPinning from 'react-native-ssl-pinning';

/**
 * SSL certificate pins for api.noc-tura.io.
 * Primary + backup pin for cert rotation without app update.
 *
 * These are SHA-256 hashes of the Subject Public Key Info (SPKI).
 * Replace with actual pins before production: openssl s_client -connect api.noc-tura.io:443
 */
export const SSL_PINS: string[] = [
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
  'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=',
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
    throw new SSLPinningError(
      'SSL certificate pinning failed',
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}
