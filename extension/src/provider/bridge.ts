import {ERROR_CODES, FROM_PROVIDER, FROM_RELAY, type ErrorCode, type MethodType} from './protocol';

/**
 * The provider's side of the window channel (spec §1.1): each method posts `{source: 'noctura-provider', id, type,
 * payload}` with targetOrigin = location.origin and awaits the relay's `{source: 'noctura-relay', id, result | error}`;
 * `change` events come the same way. The provider holds no state of its own beyond what the background last sent, no
 * key and no trust: every script on the page has the page's authority over it (§1.1, stated).
 */
export const ERROR_TEXT: Record<ErrorCode, {code: number | ErrorCode; message: string}> = {
  rejected: {code: 4001, message: 'The user rejected the request.'},
  unauthorized: {code: 4100, message: 'The requested account or method has not been authorized by the user.'},
  'request-pending': {code: 'request-pending', message: 'A request from this site is already waiting for the user.'},
  busy: {code: 'busy', message: 'The wallet is busy with other requests. Try again later.'},
  timeout: {code: 'timeout', message: 'The request timed out.'},
  'invalid-request': {code: 'invalid-request', message: 'The request is not valid.'},
  /** B1c-2 (spec §1.6, rev 3.3; owner, 2026-10-15): the wallet's route refused the broadcast, or would not try — nothing was sent. */
  'send-failed': {code: 'send-failed', message: 'The transaction could not be sent.'},
};

/** What a page sees for a refusal: a fixed English message and a stable code, never internal text (C10). */
export class NocturaError extends Error {
  readonly code: number | ErrorCode;
  constructor(code: ErrorCode) {
    super(ERROR_TEXT[code].message);
    this.name = 'NocturaError';
    this.code = ERROR_TEXT[code].code;
  }
}

type Waiter = {resolve: (r: Record<string, unknown>) => void; reject: (e: Error) => void};
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

export interface Bridge {
  request(type: MethodType, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
  onChange(listener: (accounts: string[]) => void): void;
}

export function createBridge(win: Window): Bridge {
  const waiting = new Map<string, Waiter>();
  const listeners = new Set<(accounts: string[]) => void>();
  win.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== win || e.origin !== win.location.origin) return;
    const d: unknown = e.data;
    if (!isObj(d) || d.source !== FROM_RELAY) return;
    if (d.event === 'change' && Array.isArray(d.accounts)) {
      const accounts = (d.accounts as unknown[]).filter((a): a is string => typeof a === 'string');
      for (const l of listeners) l(accounts);
      return;
    }
    if (typeof d.id !== 'string') return;
    const w = waiting.get(d.id);
    if (w === undefined) return;
    waiting.delete(d.id);
    if (typeof d.error === 'string') w.reject(new NocturaError((ERROR_CODES as readonly string[]).includes(d.error) ? (d.error as ErrorCode) : 'invalid-request'));
    else if (isObj(d.result)) w.resolve(d.result);
    else w.reject(new NocturaError('invalid-request'));
  });
  const newId = (): string => Array.from(win.crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
  return {
    request(type, payload) {
      const id = newId();
      return new Promise((resolve, reject) => {
        waiting.set(id, {resolve, reject});
        try {
          win.postMessage({source: FROM_PROVIDER, id, type, payload}, win.location.origin);
        } catch {
          // Review 1 IMPORTANT: on an opaque-origin page (`location.origin === 'null'`) some browsers throw a
          // SyntaxError for that targetOrigin rather than following postMessage's "null" serialization — the relay
          // could never have served this origin anyway (ports.ts' origin rule), so surface the same stable code
          // (C10), never a raw DOMException.
          waiting.delete(id);
          reject(new NocturaError('unauthorized'));
        }
      });
    },
    onChange(listener) {
      listeners.add(listener);
    },
  };
}
