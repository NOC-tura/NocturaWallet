/**
 * The narrowest transports a core module may ask for.
 *
 * core/ must not import React Native, MMKV, Zustand or react-native-config: it is
 * consumed by the app and by the web, and anything platform-specific behind an import
 * would drag that platform into the other's bundle. So each module takes the smallest
 * interface it actually needs, and the caller supplies it — the app over its
 * certificate-pinned transport, the web over plain fetch.
 */

/** GET a bare path. The base URL already carries `/api/v1`; never write `/v1/` here. */
export interface JsonGetter {
  get<T>(path: string): Promise<T>;
}
