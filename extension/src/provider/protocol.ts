/**
 * The provider ↔ relay window-message protocol (spec §1.1, §1.2). Copied — not imported — in src/relay/protocol.ts:
 * each content-script bundle carries only its own sources (the page-bundle gate); src/relay/__tests__ pins the two
 * copies and the background's page types together.
 */
export const FROM_PROVIDER = 'noctura-provider';
export const FROM_RELAY = 'noctura-relay';
/** The five method types the relay forwards from a page (§1.2). Plan 1 sends three of them. */
export const METHOD_TYPES = ['page.connect', 'page.disconnect', 'page.signMessage', 'page.signTransaction', 'page.signAndSendTransaction'] as const;
export type MethodType = (typeof METHOD_TYPES)[number];
/** The stable codes a page can get (§1.6, C10). */
/** Spec §1.6; `send-failed` is B1c-2's (rev 3.3: a broadcast the user approved that never reached the network). */
export const ERROR_CODES = ['rejected', 'unauthorized', 'request-pending', 'busy', 'timeout', 'invalid-request', 'send-failed'] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
