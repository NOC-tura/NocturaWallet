import {base58} from '@scure/base';
import {deriveTransparentKeypair} from '../../../core/keys/transparent';
import {mnemonicToSeed} from '../../../core/keys/mnemonic';
import {b64} from './bytes';

/** What the background holds while unlocked: per-account signing keys, never the seed. */
export interface SessionAccount {
  index: number;
  publicKey: string;
  secretKey: string;
}

export async function deriveSessionAccounts(
  mnemonic: string,
  scheme: 'slip10' | 'cli',
  indexes: number[],
): Promise<SessionAccount[]> {
  if (scheme === 'cli' && (indexes.length !== 1 || indexes[0] !== 0)) {
    throw new Error('a cli wallet has one account');
  }
  const seed = await mnemonicToSeed(mnemonic);
  try {
    return indexes.map(index => {
      const kp = deriveTransparentKeypair(seed, scheme === 'cli' ? {kind: 'cli'} : {kind: 'slip10', account: index});
      const out = {index, publicKey: base58.encode(kp.publicKey), secretKey: b64(kp.secretKey)};
      kp.secretKey.fill(0);
      return out;
    });
  } finally {
    seed.fill(0);
  }
}
