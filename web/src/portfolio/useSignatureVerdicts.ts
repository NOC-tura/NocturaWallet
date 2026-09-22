import {useQuery} from '@tanstack/react-query';
import {verifySignatures, type SignatureVerdict} from '../../../core/presale/verifySignatures';
import {signatureStatusReader} from '../lib/solana';

/**
 * What the chain says about each signature the coordinator listed.
 *
 * A separate query from the purchases themselves, deliberately: if this one fails the
 * list still renders, every row simply carries no verdict. Verification is allowed to
 * add a statement, never to remove a purchase from someone's own history.
 */
export function useSignatureVerdicts(signatures: string[]): Record<string, SignatureVerdict> {
  const key = [...signatures].sort().join(',');
  const q = useQuery({
    queryKey: ['signature-verdicts', key],
    enabled: signatures.length > 0,
    // Long: a finalized signature does not change its mind. Only an `unknown` is worth
    // asking about again, and a remount does that.
    staleTime: 5 * 60_000,
    queryFn: () => verifySignatures(signatureStatusReader, signatures),
  });
  return q.data ?? {};
}
