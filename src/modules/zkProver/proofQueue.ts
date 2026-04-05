import {mmkvSecure} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {ProofJob, ProofJobStatus, ProofType, ZKProof} from './types';

// ---- Secure storage accessor ---------------------------------------------

/**
 * Proof queue stores witness data (nullifiers, merkle paths, amounts) which is
 * privacy-sensitive. Uses mmkvSecure (encrypted) rather than getStorage().
 * Proof generation only happens post-onboarding, so mmkvSecure is always
 * initialized by the time the queue is used.
 */
function getStorage() {
  const store = mmkvSecure();
  if (!store) {
    throw new Error('ProofQueue requires mmkvSecure — wallet must be onboarded');
  }
  return store;
}

// ---- ID generation -------------------------------------------------------

function generateId(): string {
  return `pq_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ---- Persistence ---------------------------------------------------------

function loadQueue(): ProofJob[] {
  const raw = getStorage().getString(MMKV_KEYS.PROOF_QUEUE);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ProofJob[];
  } catch {
    return [];
  }
}

function saveQueue(jobs: ProofJob[]): void {
  getStorage().set(MMKV_KEYS.PROOF_QUEUE, JSON.stringify(jobs));
}

/** Jobs older than this are auto-expired by expireStaleEntries(). */
export const PROOF_STALE_TIMEOUT_MS = 10 * 60 * 1_000;

// ---- ProofQueue ----------------------------------------------------------

/**
 * MMKV-persistent proof job queue.
 *
 * All mutations are written to getStorage() synchronously so that no job is
 * lost on app crash.  The queue is intentionally simple (array of jobs) —
 * no concurrent worker; jobs are processed one at a time by zkProverModule.
 */
export class ProofQueue {
  /**
   * Enqueue a new proof job.
   * Returns the created ProofJob.
   */
  enqueue(proofType: ProofType, witnessJson: string): ProofJob {
    const job: ProofJob = {
      id: generateId(),
      proofType,
      witnessJson,
      status: 'pending',
      attempts: 0,
      enqueuedAt: Date.now(),
    };
    const jobs = loadQueue();
    jobs.push(job);
    saveQueue(jobs);
    return job;
  }

  /**
   * Returns all jobs in the queue (all statuses).
   */
  getAll(): ProofJob[] {
    return loadQueue();
  }

  /**
   * Returns only pending jobs, ordered oldest-first.
   */
  getPending(): ProofJob[] {
    return loadQueue()
      .filter(j => j.status === 'pending')
      .sort((a, b) => a.enqueuedAt - b.enqueuedAt);
  }

  /**
   * Update a job's status and optional fields.
   * No-op if the job ID is not found.
   */
  updateJob(
    id: string,
    updates: Partial<Pick<ProofJob, 'status' | 'attempts' | 'lastError' | 'result'>>,
  ): void {
    const jobs = loadQueue();
    const idx = jobs.findIndex(j => j.id === id);
    if (idx === -1) return;
    jobs[idx] = {...jobs[idx]!, ...updates};
    saveQueue(jobs);
  }

  /**
   * Mark a job as 'proving' and increment attempt count atomically.
   */
  markProving(id: string): void {
    const jobs = loadQueue();
    const idx = jobs.findIndex(j => j.id === id);
    if (idx === -1) return;
    const job = jobs[idx]!;
    jobs[idx] = {...job, status: 'proving', attempts: job.attempts + 1};
    saveQueue(jobs);
  }

  /**
   * Mark a job as 'done' and attach the result proof.
   */
  markDone(id: string, result: ZKProof): void {
    this.updateJob(id, {status: 'done', result});
  }

  /**
   * Mark a job as 'failed' with an error message.
   */
  markFailed(id: string, error: string): void {
    this.updateJob(id, {status: 'failed', lastError: error});
  }

  /**
   * Remove all completed (done/failed) jobs.
   * Returns the number of jobs removed.
   */
  purgeCompleted(): number {
    const jobs = loadQueue();
    const remaining = jobs.filter(j => j.status === 'pending' || j.status === 'proving');
    const removed = jobs.length - remaining.length;
    saveQueue(remaining);
    return removed;
  }

  /**
   * Mark all pending/proving jobs older than PROOF_STALE_TIMEOUT_MS as failed.
   * This also recovers jobs stranded in 'proving' status after an app crash
   * (no concurrent worker — jobs are only 'proving' transiently during a
   * synchronous processQueue call, so a stale 'proving' job means a crash).
   * Returns the number of jobs that were expired.
   */
  expireStaleEntries(): number {
    const now = Date.now();
    const jobs = loadQueue();
    let expired = 0;
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i]!;
      if (
        (job.status === 'pending' || job.status === 'proving') &&
        now - job.enqueuedAt > PROOF_STALE_TIMEOUT_MS
      ) {
        jobs[i] = {...job, status: 'failed', lastError: 'Timed out after 10 minutes'};
        expired++;
      }
    }
    if (expired > 0) {
      saveQueue(jobs);
    }
    return expired;
  }

  /**
   * Remove all jobs (full reset).
   */
  clear(): void {
    saveQueue([]);
  }

  /**
   * Returns queue depth (total jobs, regardless of status).
   */
  get size(): number {
    return loadQueue().length;
  }
}

export const proofQueue = new ProofQueue();
