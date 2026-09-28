import {assertArrayBufferBacked} from './bytes';

/**
 * Passkey unlock (spec §2). The RP ID is claimed through the extension's host permission for
 * wallet.noc-tura.io (Chrome 122+, Firefox 150+). This module runs only in a tab — the
 * action popup closes when the credential prompt opens.
 */
export const RP_ID = 'wallet.noc-tura.io';

export interface CredentialsApi {
  create(o: CredentialCreationOptions): Promise<Credential | null>;
  get(o: CredentialRequestOptions): Promise<Credential | null>;
}

type PrfResults = {prf?: {results?: {first?: ArrayBuffer}}};

// A PRF output that is not exactly 32 bytes is not usable as HKDF input material for the
// passkey wrap (spec §2: PRF salt is 32 random bytes, and the wrap KEK is derived at 32 bytes
// either way) — treat it the same as no PRF output at all, rather than feeding a short or
// otherwise-sized key into HKDF.
const PRF_OUTPUT_LEN = 32;

function prfOutputOf(cred: Credential | null): Uint8Array | null {
  if (!cred || !('getClientExtensionResults' in cred)) return null;
  const ext = (cred as PublicKeyCredential).getClientExtensionResults() as PrfResults;
  const first = ext.prf?.results?.first;
  if (!first) return null;
  const bytes = new Uint8Array(first);
  return bytes.length === PRF_OUTPUT_LEN ? bytes : null;
}

export async function evaluatePrf(api: CredentialsApi, credentialId: Uint8Array, prfSalt: Uint8Array): Promise<Uint8Array | null> {
  assertArrayBufferBacked(credentialId);
  assertArrayBufferBacked(prfSalt);
  const cred = await api.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: RP_ID,
      allowCredentials: [{type: 'public-key', id: credentialId}],
      userVerification: 'required',
      extensions: {prf: {eval: {first: prfSalt}}} as AuthenticationExtensionsClientInputs,
    },
  });
  return prfOutputOf(cred);
}

/**
 * Create a passkey, then prove PRF works with an immediate get(): some authenticators
 * (Windows Hello on older Chrome) surface PRF only on get(), so the create result cannot
 * decide it (spec §2).
 */
export async function registerPasskey(
  api: CredentialsApi,
  userHandle: Uint8Array,
): Promise<{credentialId: Uint8Array; prfSalt: Uint8Array; prfOutput: Uint8Array} | {unsupported: true}> {
  assertArrayBufferBacked(userHandle);
  const cred = await api.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: {id: RP_ID, name: 'Noctura'},
      user: {id: userHandle, name: 'Noctura wallet', displayName: 'Noctura wallet'},
      pubKeyCredParams: [
        {type: 'public-key', alg: -7},
        {type: 'public-key', alg: -257},
      ],
      authenticatorSelection: {userVerification: 'required', residentKey: 'preferred'},
      extensions: {prf: {}} as AuthenticationExtensionsClientInputs,
    },
  });
  if (!cred || !('rawId' in cred)) return {unsupported: true};
  const credentialId = new Uint8Array((cred as PublicKeyCredential).rawId);
  const prfSalt = crypto.getRandomValues(new Uint8Array(32));
  const prfOutput = await evaluatePrf(api, credentialId, prfSalt);
  if (!prfOutput) return {unsupported: true};
  return {credentialId, prfSalt, prfOutput};
}
