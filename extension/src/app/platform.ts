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

/** Every extension page the UI opens. A closed list: nothing here builds a URL from data. */
export type ExtensionPage =
  | 'unlock.html?mode=welcome'
  | 'unlock.html?mode=unlock'
  | 'unlock.html?mode=forgot'
  | 'unlock.html?mode=accounts'
  | 'unlock.html?mode=unlock&return=created'
  | 'unlock.html?mode=unlock&return=imported'
  | 'unlock.html?mode=import&source=retry';

export interface Platform {
  /** A new tab (the popup closes itself after). */
  openPage(page: ExtensionPage): void;
  /** This tab moves to the page (the UI tab's #7 and #40 hand over to the vault page and back). */
  navigate(page: ExtensionPage): void;
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
