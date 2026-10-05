/**
 * The popup's and the tab's calls to the browser (spec B1b-2a §1.3): open an extension page (in a new
 * tab, or this tab), close this window, read the version. Never storage (scripts/check-vault-isolation.mjs forbids it outside
 * the background) and never a runtime listener (only the background listens). The one external link,
 * Solscan, is an <a> (screens/TxDetail.tsx), not a call here.
 */
interface PlatformApi {
  runtime: {getURL(path: string): string; getManifest(): {version: string}};
  tabs: {create(o: {url: string}): Promise<unknown> | void};
}

/**
 * Every fixed extension page the UI opens. A closed list: nothing here builds a URL from data (the two data-built pages
 * are a ReauthPage and a RemoveAccountPage, below). B1b-2b §1.3 adds the security pages; the add-account page is
 * `…&op=add` (2a's bare `mode=accounts` is replaced).
 */
export type ExtensionPage =
  | 'unlock.html?mode=welcome'
  | 'unlock.html?mode=unlock'
  | 'unlock.html?mode=forgot'
  | 'unlock.html?mode=accounts&op=add'
  | 'unlock.html?mode=unlock&return=created'
  | 'unlock.html?mode=unlock&return=imported'
  | 'unlock.html?mode=import&source=retry'
  | 'unlock.html?mode=password'
  | 'unlock.html?mode=delete'
  | 'unlock.html?mode=passkey&op=add'
  | 'unlock.html?mode=passkey&op=remove'
  | 'unlock.html?mode=reveal'
  | 'unlock.html?mode=verify';

declare const REAUTH_PAGE: unique symbol;
/** #20's re-authentication page: a string only reauthPage() makes (the brand cannot be written by hand). */
export type ReauthPage = string & {readonly [REAUTH_PAGE]: true};

/**
 * #20's re-authentication page (spec §4.5 step 2): the one page built from data — a challenge id, checked as 32
 * lowercase hex first (what the background issues). Anything else is null: no page opens.
 */
export function reauthPage(challengeId: string): ReauthPage | null {
  return /^[0-9a-f]{32}$/.test(challengeId) ? (`unlock.html?mode=reauth&challenge=${challengeId}` as ReauthPage) : null;
}

declare const REMOVE_ACCOUNT_PAGE: unique symbol;
/** The accounts manager's remove page (B1b-2b §1.3, C14): a string only removeAccountPage() makes. */
export type RemoveAccountPage = string & {readonly [REMOVE_ACCOUNT_PAGE]: true};
/** The SLIP-0010 hardened limit of the account level (vault page: accountsFlow.MAX_ACCOUNT_INDEX). */
const MAX_ACCOUNT_INDEX = 2 ** 31 - 1;

/**
 * The remove page for the account with this envelope `index` (0-based): null unless `index` is a safe integer in
 * 0 … 2^31 − 1. The page shows "Account index+1" and the stored address — never the name — and acts only after a proof.
 */
export function removeAccountPage(index: number): RemoveAccountPage | null {
  return Number.isSafeInteger(index) && index >= 0 && index <= MAX_ACCOUNT_INDEX ? (`unlock.html?mode=accounts&op=remove&index=${index}` as RemoveAccountPage) : null;
}

export interface Platform {
  /** A new tab (the popup closes itself after). */
  openPage(page: ExtensionPage | ReauthPage | RemoveAccountPage): void;
  /** This tab moves to the page (the UI tab's #7 and #40 hand over to the vault page and back). */
  navigate(page: ExtensionPage | ReauthPage): void;
  closeWindow(): void;
  version(): string;
}

function api(): PlatformApi {
  const g = globalThis as unknown as {browser?: PlatformApi; chrome?: PlatformApi};
  const b = g.browser ?? g.chrome;
  if (b === undefined) throw new Error('not running in an extension');
  return b;
}

export const browserPlatform: Platform = {
  openPage: page => {
    void Promise.resolve(api().tabs.create({url: api().runtime.getURL(page)})).catch((e: unknown) => console.warn('tab not opened', e));
  },
  navigate: page => location.assign(page),
  closeWindow: () => window.close(),
  version: () => api().runtime.getManifest().version,
};
