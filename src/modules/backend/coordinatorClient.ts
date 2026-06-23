import {API_BASE} from '../../constants/programs';
import {pinnedFetch} from '../sslPinning/pinnedFetch';

/**
 * GET a coordinator JSON endpoint. SSL-pinned first; on ANY pinned-fetch failure
 * fall back to a plain HTTPS fetch to the SAME URL (public read-only data).
 * Throws only when both fail or the response is non-2xx.
 */
export async function getCoordinatorJson(path: string): Promise<unknown> {
  try {
    const res = await pinnedFetch(`${API_BASE}${path}`);
    if (res.status !== 200) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) {
      throw new Error(`coordinator ${path} HTTP ${res.status}`);
    }
    return res.json();
  }
}
