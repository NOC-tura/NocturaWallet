import type {WalletToken} from '../../../core/solana/balances';

/** What the user asked for. `amount` is base units as a decimal string (messages are JSON). */
export interface SendIntent {
  token: WalletToken;
  recipient: string;
  amount: string;
}

export type SendRefusal =
  | 'locked'
  | 'unknown-account'
  | 'in-flight'
  | 'split-balance'
  | 'insufficient-token'
  | 'insufficient-sol'
  | 'simulation-failed'
  | 'unknown-prepared'
  | 'prepared-expired'
  | 'reauth-required'
  | 'sender-below-rent'
  | 'recipient-below-rent';

/** A send the engine will not make, with a fixed code the screens translate and a detail for the curious. */
export class SendRefused extends Error {
  readonly code: SendRefusal;
  readonly detail: string;
  constructor(code: SendRefusal, detail = '') {
    super(detail === '' ? code : `${code}: ${detail}`);
    this.name = 'SendRefused';
    this.code = code;
    this.detail = detail;
  }
}

export type ResendRefusal = 'unknown' | 'not-open' | 'too-soon';

export class ResendRefused extends Error {
  readonly code: ResendRefusal;
  constructor(code: ResendRefusal) {
    super(`resend refused: ${code}`);
    this.name = 'ResendRefused';
    this.code = code;
  }
}
