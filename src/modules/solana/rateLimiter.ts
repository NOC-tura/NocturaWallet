interface RateLimiterConfig {
  maxConcurrent: number;
  maxRetries?: number;
  baseDelayMs?: number;
  cooldownMs?: number;
}

interface ExecuteOptions {
  isRetriable?: (error: unknown) => boolean;
}

export class RateLimiter {
  private active = 0;
  private queue: Array<() => void> = [];
  private inflight = new Map<string, Promise<unknown>>();
  private lastCompleted = 0;
  private config: Required<RateLimiterConfig>;

  constructor(config: RateLimiterConfig) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      baseDelayMs: config.baseDelayMs ?? 1000,
      cooldownMs: config.cooldownMs ?? 0,
      maxConcurrent: config.maxConcurrent,
    };
  }

  async execute<T>(key: string, fn: () => Promise<T>, options?: ExecuteOptions): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = this.doExecute(key, fn, options);
    this.inflight.set(key, promise);

    try {
      return await promise;
    } finally {
      this.inflight.delete(key);
    }
  }

  private async doExecute<T>(_key: string, fn: () => Promise<T>, options?: ExecuteOptions): Promise<T> {
    await this.acquireSlot();
    try {
      return await this.executeWithRetry(fn, options);
    } finally {
      this.active--;
      this.lastCompleted = Date.now();
      this.releaseNext();
    }
  }

  private async acquireSlot(): Promise<void> {
    if (this.config.cooldownMs > 0 && this.lastCompleted > 0) {
      const elapsed = Date.now() - this.lastCompleted;
      const remaining = this.config.cooldownMs - elapsed;
      if (remaining > 0) await this.sleep(remaining);
    }

    if (this.active < this.config.maxConcurrent) {
      this.active++;
      return;
    }

    return new Promise<void>(resolve => {
      this.queue.push(() => { this.active++; resolve(); });
    });
  }

  private releaseNext(): void {
    const next = this.queue.shift();
    if (next) next();
  }

  private async executeWithRetry<T>(fn: () => Promise<T>, options?: ExecuteOptions): Promise<T> {
    const {maxRetries, baseDelayMs} = this.config;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries && options?.isRetriable?.(error)) {
          await this.sleep(baseDelayMs * Math.pow(2, attempt));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  /**
   * Reset all in-flight tracking and cooldown state.
   * Intended for use in tests only — clears active count, queue, inflight map,
   * and lastCompleted timestamp so cooldown delays don't bleed between test cases.
   */
  reset(): void {
    this.active = 0;
    this.queue = [];
    this.inflight.clear();
    this.lastCompleted = 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
