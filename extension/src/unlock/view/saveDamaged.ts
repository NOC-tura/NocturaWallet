import {storedDigest, storedText} from '../../shared/storedDigest';

/**
 * B1e §2.3 (E10, R4): "Save the damaged data" — an `<a download>` whose data: URL carries exactly the text the digest
 * hashes (storedText: JSON.stringify of the value as read), so a saved file can be checked against a reported digest.
 * application/json — never an HTML type, and no object URL (the vault-isolation gate refuses both on this page); <a
 * download> needs no permission. Returns the digest of that value.
 */
export function fillSaveLink(link: HTMLAnchorElement, raw: unknown): string {
  const digest = storedDigest(raw);
  link.download = `noctura-damaged-wallet-${digest.slice(0, 8)}.json`;
  link.href = `data:application/json;charset=utf-8,${encodeURIComponent(storedText(raw))}`;
  return digest;
}
