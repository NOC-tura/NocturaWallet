/**
 * ProofQueue Tests
 * 7 tests covering enqueue, pending fetch, status transitions, purge, stale expiry, and crash-safe persistence.
 */

jest.mock('../../sslPinning/pinnedFetch', () => ({
  pinnedFetch: jest.fn(),
}));

// ProofQueue uses mmkvSecure (encrypted storage). In tests, route it to the
// always-available mmkvPublic mock so no initSecureMmkv call is needed.
jest.mock('../../../store/mmkv/instances', () => {
  const actual = jest.requireActual('../../../store/mmkv/instances') as Record<string, unknown>;
  return {
    ...actual,
    mmkvSecure: () => actual.mmkvPublic,
  };
});

import {ProofQueue} from '../proofQueue';
import {ZKProof} from '../types';

describe('ProofQueue', () => {
  let queue: ProofQueue;

  beforeEach(() => {
    queue = new ProofQueue();
    queue.clear();
  });

  it('enqueues a job with status=pending and increments size', () => {
    expect(queue.size).toBe(0);
    const job = queue.enqueue('transfer', JSON.stringify({amount: '1000'}));
    expect(job.status).toBe('pending');
    expect(job.proofType).toBe('transfer');
    expect(job.attempts).toBe(0);
    expect(queue.size).toBe(1);
  });

  it('getPending returns only pending jobs in FIFO order', () => {
    const j1 = queue.enqueue('transfer', '{}');
    const j2 = queue.enqueue('swap', '{}');
    // Mark j1 as done so it should not appear in pending
    queue.markDone(j1.id, {
      proofType: 'transfer',
      proofData: 'abc',
      publicInputs: {root: '', nullifier: '', amount: '0'},
      generatedAt: Date.now(),
    } satisfies ZKProof);

    const pending = queue.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]!.id).toBe(j2.id);
  });

  it('markProving increments attempts and sets status=proving', () => {
    const job = queue.enqueue('deposit', '{}');
    queue.markProving(job.id);
    const updated = queue.getAll().find(j => j.id === job.id)!;
    expect(updated.status).toBe('proving');
    expect(updated.attempts).toBe(1);
  });

  it('markFailed sets status=failed and stores error message', () => {
    const job = queue.enqueue('withdraw', '{}');
    queue.markFailed(job.id, 'Hosted prover timeout');
    const updated = queue.getAll().find(j => j.id === job.id)!;
    expect(updated.status).toBe('failed');
    expect(updated.lastError).toBe('Hosted prover timeout');
  });

  it('purgeCompleted removes done and failed jobs, keeps pending/proving', () => {
    const j1 = queue.enqueue('transfer', '{}');
    const j2 = queue.enqueue('swap', '{}');
    const j3 = queue.enqueue('deposit', '{}');

    queue.markDone(j1.id, {
      proofType: 'transfer',
      proofData: 'xyz',
      publicInputs: {root: '', nullifier: '', amount: '0'},
      generatedAt: Date.now(),
    });
    queue.markFailed(j2.id, 'error');
    // j3 stays pending

    const removed = queue.purgeCompleted();
    expect(removed).toBe(2);
    expect(queue.size).toBe(1);
    expect(queue.getAll()[0]!.id).toBe(j3.id);
  });

  it('expireStaleEntries marks old pending/proving jobs as failed', () => {
    const ELEVEN_MINUTES_MS = 11 * 60 * 1000;
    const job = queue.enqueue('transfer', '{}');
    const realNow = Date.now;
    try {
      // Advance perceived 'now' by 11 minutes so the job appears stale
      Date.now = () => realNow() + ELEVEN_MINUTES_MS;
      const expired = queue.expireStaleEntries();
      expect(expired).toBe(1);
      const updated = queue.getAll().find(j => j.id === job.id)!;
      expect(updated.status).toBe('failed');
      expect(updated.lastError).toBe('Timed out after 10 minutes');
    } finally {
      Date.now = realNow;
    }
  });

  it('queue state survives a new ProofQueue instance (MMKV persistence)', () => {
    // Simulate app restart by creating a fresh queue instance backed by same MMKV
    const job = queue.enqueue('transfer', JSON.stringify({amount: '500'}));
    const queue2 = new ProofQueue();
    const restored = queue2.getAll().find(j => j.id === job.id);
    expect(restored).toBeDefined();
    expect(restored!.proofType).toBe('transfer');
    expect(restored!.status).toBe('pending');
  });
});
