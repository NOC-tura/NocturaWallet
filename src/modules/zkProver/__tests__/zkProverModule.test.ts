/**
 * ZkProverModule Tests
 * 7 tests covering: hosted success, hosted→queue fallback, sk_spend exclusion,
 * witness zeroization, max attempts, processQueue, and ProverUnavailableError when all fail.
 */

jest.mock('../../sslPinning/pinnedFetch', () => ({
  pinnedFetch: jest.fn(),
}));

// Use no-cooldown limiters so sequential calls in tests don't wait 3s/5s.
jest.mock('../../solana/rpcLimiter', () => {
  const {RateLimiter} = jest.requireActual<typeof import('../../solana/rateLimiter')>('../../solana/rateLimiter');
  const rpcLimiter = new RateLimiter({maxConcurrent: 10, maxRetries: 3, baseDelayMs: 1000});
  const proveLimiter = new RateLimiter({maxConcurrent: 1, maxRetries: 1, baseDelayMs: 1000});
  const relayerLimiter = new RateLimiter({maxConcurrent: 1, maxRetries: 1, baseDelayMs: 1000});
  return {
    rpcLimiter,
    proveLimiter,
    relayerLimiter,
    _resetRateLimitersForTest: () => {
      rpcLimiter.reset();
      proveLimiter.reset();
      relayerLimiter.reset();
    },
  };
});

// ProofQueue uses mmkvSecure (encrypted storage). In tests, route it to the
// always-available mmkvPublic mock so no initSecureMmkv call is needed.
jest.mock('../../../store/mmkv/instances', () => {
  const actual = jest.requireActual('../../../store/mmkv/instances') as Record<string, unknown>;
  return {
    ...actual,
    mmkvSecure: () => actual.mmkvPublic,
  };
});

import {pinnedFetch} from '../../sslPinning/pinnedFetch';
import {_resetRateLimitersForTest} from '../../solana/rpcLimiter';
import {ZkProverModule} from '../zkProverModule';
import {ProofQueue} from '../proofQueue';
import {ProverUnavailableError} from '../types';
import type {ProofWitness} from '../types';

const mockPinnedFetch = pinnedFetch as jest.Mock;

function mockResponse(status: number, data: unknown) {
  return Promise.resolve({
    status,
    headers: {},
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

function makeWitness(overrides: Partial<ProofWitness> = {}): ProofWitness {
  return {
    noteCommitment: 'aabb'.padStart(64, '0'),
    merklePath: ['1122'.padStart(64, '0')],
    merklePathIndices: [0],
    nullifier: 'ccdd'.padStart(64, '0'),
    amount: '500000',
    noteSecret: 'super-secret-key-do-not-send',
    ...overrides,
  };
}

describe('ZkProverModule', () => {
  let module: ZkProverModule;
  let queue: ProofQueue;

  beforeEach(() => {
    module = new ZkProverModule();
    queue = new ProofQueue();
    queue.clear();
    jest.clearAllMocks();
    _resetRateLimitersForTest();
  });

  it('returns ZKProof when hosted prover succeeds', async () => {
    mockPinnedFetch.mockReturnValueOnce(
      mockResponse(200, {
        success: true,
        proofData: 'base64proofdata==',
      }),
    );

    const proof = await module.prove('transfer', makeWitness());
    expect(proof.proofType).toBe('transfer');
    expect(proof.proofData).toBe('base64proofdata==');
    expect(proof.generatedAt).toBeGreaterThan(0);
  });

  it('NEVER includes noteSecret in hosted prover request body', async () => {
    mockPinnedFetch.mockReturnValueOnce(
      mockResponse(200, {success: true, proofData: 'abc'}),
    );

    await module.prove('transfer', makeWitness());

    const callBody = (mockPinnedFetch.mock.calls[0] as [string, {body: string}])[1].body;
    const parsed = JSON.parse(callBody) as {params: ProofWitness};
    expect(parsed.params).not.toHaveProperty('noteSecret');
  });

  it('zeroizes witness noteSecret after proof generation', async () => {
    mockPinnedFetch.mockReturnValueOnce(
      mockResponse(200, {success: true, proofData: 'abc'}),
    );

    const witness = makeWitness();
    await module.prove('transfer', witness);
    // After prove(), noteSecret should be zeroed
    expect(witness.noteSecret).not.toBe('super-secret-key-do-not-send');
    expect(witness.noteSecret).toMatch(/^\x00+$/);
  });

  it('enqueues job and throws ProverUnavailableError when hosted fails', async () => {
    mockPinnedFetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(module.prove('transfer', makeWitness())).rejects.toThrow(
      ProverUnavailableError,
    );

    // Job should be in the queue
    expect(queue.size).toBeGreaterThan(0);
    const pending = queue.getPending();
    expect(pending[0]?.proofType).toBe('transfer');
  });

  it('queued job witnessJson does not contain noteSecret', async () => {
    mockPinnedFetch.mockRejectedValueOnce(new Error('Prover down'));

    await expect(module.prove('swap', makeWitness())).rejects.toThrow(
      ProverUnavailableError,
    );

    const jobs = queue.getAll();
    const storedWitness = JSON.parse(jobs[0]!.witnessJson) as ProofWitness;
    expect(storedWitness).not.toHaveProperty('noteSecret');
  });

  it('processQueue skips jobs with >= 3 attempts and marks them failed', async () => {
    const job = queue.enqueue('transfer', JSON.stringify({
      noteCommitment: '0'.repeat(64),
      merklePath: [],
      merklePathIndices: [],
      nullifier: '0'.repeat(64),
      amount: '500000',
    }));
    // Simulate 3 previous attempts
    queue.updateJob(job.id, {attempts: 3});

    const count = await module.processQueue();
    expect(count).toBe(0);
    // pinnedFetch should never have been called
    expect(mockPinnedFetch).not.toHaveBeenCalled();

    const updated = queue.getAll().find(j => j.id === job.id)!;
    expect(updated.status).toBe('failed');
    expect(updated.lastError).toBe('Max attempts (3) exceeded');
  });

  it('processQueue marks jobs done when hosted succeeds on retry', async () => {
    // Pre-populate queue with a pending job
    queue.enqueue('deposit', JSON.stringify({
      noteCommitment: '0'.repeat(64),
      merklePath: [],
      merklePathIndices: [],
      nullifier: '0'.repeat(64),
      amount: '1000000',
    }));

    mockPinnedFetch.mockReturnValueOnce(
      mockResponse(200, {success: true, proofData: 'retried-proof'}),
    );

    const count = await module.processQueue();
    expect(count).toBe(1);

    const jobs = queue.getAll();
    expect(jobs[0]!.status).toBe('done');
    expect(jobs[0]!.result?.proofData).toBe('retried-proof');
  });
});
