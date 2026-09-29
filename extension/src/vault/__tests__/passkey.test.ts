import {registerPasskey, evaluatePrf, RP_ID, type CredentialsApi} from '../passkey';

type Opts = {
  publicKey?: {
    rp?: {id?: string};
    rpId?: string;
    authenticatorSelection?: {userVerification?: string};
    userVerification?: string;
    extensions?: {prf?: {eval?: {first: BufferSource}}};
    allowCredentials?: {type: string; id: BufferSource}[];
  };
};

function fakeApi(prfAtGet: boolean): {api: CredentialsApi; seen: Opts[]} {
  const seen: Opts[] = [];
  const cred = (prf: Uint8Array | null) => ({
    rawId: new Uint8Array([9, 9, 9]).buffer,
    getClientExtensionResults: () => (prf ? {prf: {results: {first: prf.buffer}}} : {prf: {enabled: true}}),
  }) as unknown as Credential;
  return {
    seen,
    api: {
      create: async o => {
        seen.push(o as Opts);
        return cred(null); // PRF not surfaced at create — the Windows Hello case
      },
      get: async o => {
        seen.push(o as Opts);
        return cred(prfAtGet ? new Uint8Array(32).fill(5) : null);
      },
    },
  };
}

// Fake whose get() surfaces a PRF result, but the wrong length — not a 32-byte key.
function fakeApiWithShortPrf(len: number): {api: CredentialsApi; seen: Opts[]} {
  const seen: Opts[] = [];
  const cred = (prf: Uint8Array | null) => ({
    rawId: new Uint8Array([9, 9, 9]).buffer,
    getClientExtensionResults: () => (prf ? {prf: {results: {first: prf.buffer}}} : {prf: {enabled: true}}),
  }) as unknown as Credential;
  return {
    seen,
    api: {
      create: async o => {
        seen.push(o as Opts);
        return cred(null);
      },
      get: async o => {
        seen.push(o as Opts);
        return cred(new Uint8Array(len).fill(7));
      },
    },
  };
}

describe('passkey', () => {
  it('registers on wallet.noc-tura.io with user verification required', async () => {
    const {api, seen} = fakeApi(true);
    const r = await registerPasskey(api, new Uint8Array(16));
    expect(seen[0]?.publicKey?.rp?.id).toBe(RP_ID);
    expect(seen[0]?.publicKey?.authenticatorSelection?.userVerification).toBe('required');
    expect(seen[1]?.publicKey?.rpId).toBe(RP_ID);
    if ('unsupported' in r) throw new Error('expected support');
    const allowedId = seen[1]?.publicKey?.allowCredentials?.[0]?.id as Uint8Array | undefined;
    expect(allowedId).toBeDefined();
    expect(Array.from(allowedId ?? [])).toEqual(Array.from(r.credentialId));
  });

  it('decides PRF support by a get() after create, not by create', async () => {
    const {api} = fakeApi(true);
    const r = await registerPasskey(api, new Uint8Array(16));
    expect('unsupported' in r).toBe(false);
  });

  it('reports unsupported when get() yields no PRF output', async () => {
    const {api} = fakeApi(false);
    expect(await registerPasskey(api, new Uint8Array(16))).toEqual({unsupported: true});
  });

  it('uses a fresh 32-byte PRF salt per registration', async () => {
    const a = await registerPasskey(fakeApi(true).api, new Uint8Array(16));
    const b = await registerPasskey(fakeApi(true).api, new Uint8Array(16));
    if ('unsupported' in a || 'unsupported' in b) throw new Error('expected support');
    expect(a.prfSalt.length).toBe(32);
    expect(Array.from(a.prfSalt)).not.toEqual(Array.from(b.prfSalt));
  });

  it('evaluatePrf returns null without PRF output', async () => {
    expect(await evaluatePrf(fakeApi(false).api, new Uint8Array([1]), new Uint8Array(32))).toBeNull();
  });

  it('evaluatePrf returns null when the PRF output is not exactly 32 bytes', async () => {
    const {api} = fakeApiWithShortPrf(16);
    expect(await evaluatePrf(api, new Uint8Array([1]), new Uint8Array(32))).toBeNull();
  });

  it('registerPasskey reports unsupported when get() yields a non-32-byte PRF output', async () => {
    const {api} = fakeApiWithShortPrf(16);
    expect(await registerPasskey(api, new Uint8Array(16))).toEqual({unsupported: true});
  });

  // Fable review (Minor 5): the platform hands back the PRF output in an ArrayBuffer the
  // credential object keeps; evaluatePrf copies it out and zeroes that original.
  function fakeApiKeepingBuffer(len: number): {api: CredentialsApi; original: ArrayBuffer} {
    const original = new Uint8Array(len).fill(5).buffer;
    const cred = {rawId: new Uint8Array([9]).buffer, getClientExtensionResults: () => ({prf: {results: {first: original}}})} as unknown as Credential;
    return {original, api: {create: async () => cred, get: async () => cred}};
  }

  it('zeroes the credential\'s own PRF buffer, and returns an independent copy of the output', async () => {
    const {api, original} = fakeApiKeepingBuffer(32);
    const out = await evaluatePrf(api, new Uint8Array([9]), new Uint8Array(32));
    expect(Array.from(new Uint8Array(original))).toEqual(new Array(32).fill(0));
    expect(out && Array.from(out)).toEqual(new Array(32).fill(5));
    expect(out?.buffer).not.toBe(original);
  });

  it('zeroes the credential\'s PRF buffer even when its length makes it unusable', async () => {
    const {api, original} = fakeApiKeepingBuffer(16);
    expect(await evaluatePrf(api, new Uint8Array([9]), new Uint8Array(32))).toBeNull();
    expect(Array.from(new Uint8Array(original))).toEqual(new Array(16).fill(0));
  });
});

