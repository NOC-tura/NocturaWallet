/**
 * The provider ↔ relay window-message protocol and the relay ↔ background port (spec §1.2, §1.4). Copied — not
 * imported — from src/provider/protocol.ts: each content-script bundle carries only its own sources (the page-bundle
 * gate); src/relay/__tests__/relay.test.ts pins the two copies and the background's page types together.
 */
export const FROM_PROVIDER = 'noctura-provider';
export const FROM_RELAY = 'noctura-relay';
export const PAGE_PORT = 'noctura-page';
/** The five method types the relay forwards from a page — and only these (§1.2). */
export const METHOD_TYPES = ['page.connect', 'page.disconnect', 'page.signMessage', 'page.signTransaction', 'page.signAndSendTransaction'] as const;
