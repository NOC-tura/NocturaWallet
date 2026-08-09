import {API_BASE} from '../../constants/programs';
import {pinnedFetch, SSLPinningError} from '../sslPinning/pinnedFetch';

/**
 * GET a coordinator JSON endpoint, SSL-pinned.
 *
 * WHY THE FALLBACK IS NARROW. This used to be `try { pinnedFetch } catch { fetch }`
 * with a bare catch, which fell back to an UNPINNED request to the same URL on
 * any throw — including a pin failure. That is a downgrade an attacker can
 * trigger rather than merely benefit from: present a certificate that doesn't
 * match SSL_PINS, or simply reset the pinned connection, and the client retries
 * itself without pinning. The paths here carry the user's transparent address
 * (`/user/<addr>`, `/referral-stats/<addr>`), which is the reason to attack it.
 *
 * A pin failure is now terminal. The fallback survives only for genuine
 * transport failures — DNS, offline, timeout — where the connection never got
 * far enough to present a certificate, so pinning cannot have been bypassed.
 * A non-2xx is an answer rather than a transport failure, so it is not retried
 * either: retrying gains nothing and drops the protection.
 */
export async function getCoordinatorJson(path: string): Promise<unknown> {
  try {
    const res = await pinnedFetch(`${API_BASE}${path}`);
    if (res.status !== 200) {
      throw new HttpStatusError(path, res.status);
    }
    return await res.json();
  } catch (error) {
    if (error instanceof SSLPinningError || error instanceof HttpStatusError) throw error;

    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) {
      throw new HttpStatusError(path, res.status);
    }
    return res.json();
  }
}

/** A response was received; this is not a transport failure and must not downgrade. */
class HttpStatusError extends Error {
  constructor(path: string, status: number) {
    super(`coordinator ${path} HTTP ${status}`);
    this.name = 'HttpStatusError';
  }
}
