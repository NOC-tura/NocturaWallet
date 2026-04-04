import {RateLimiter} from '../rateLimiter';

describe('RateLimiter', () => {
  it('executes requests within concurrency limit', async () => {
    const limiter = new RateLimiter({maxConcurrent: 2});
    const results: number[] = [];

    await Promise.all([
      limiter.execute('a', async () => { results.push(1); return 1; }),
      limiter.execute('b', async () => { results.push(2); return 2; }),
      limiter.execute('c', async () => { results.push(3); return 3; }),
    ]);

    expect(results).toEqual([1, 2, 3]);
  });

  it('respects maxConcurrent limit', async () => {
    const limiter = new RateLimiter({maxConcurrent: 1});
    let concurrent = 0;
    let maxSeen = 0;

    const task = async () => {
      concurrent++;
      maxSeen = Math.max(maxSeen, concurrent);
      await new Promise(r => setTimeout(r, 10));
      concurrent--;
      return maxSeen;
    };

    await Promise.all([
      limiter.execute('a', task),
      limiter.execute('b', task),
      limiter.execute('c', task),
    ]);

    expect(maxSeen).toBe(1);
  });

  it('deduplicates identical in-flight requests', async () => {
    const limiter = new RateLimiter({maxConcurrent: 10});
    let callCount = 0;

    const task = async () => {
      callCount++;
      await new Promise(r => setTimeout(r, 50));
      return 'result';
    };

    const [r1, r2] = await Promise.all([
      limiter.execute('same-key', task),
      limiter.execute('same-key', task),
    ]);

    expect(callCount).toBe(1);
    expect(r1).toBe('result');
    expect(r2).toBe('result');
  });

  it('does not deduplicate different keys', async () => {
    const limiter = new RateLimiter({maxConcurrent: 10});
    let callCount = 0;

    const task = async () => {
      callCount++;
      return 'result';
    };

    await Promise.all([
      limiter.execute('key-1', task),
      limiter.execute('key-2', task),
    ]);

    expect(callCount).toBe(2);
  });

  it('retries with exponential backoff on retriable errors', async () => {
    const limiter = new RateLimiter({maxConcurrent: 10, maxRetries: 3, baseDelayMs: 10});
    let attempts = 0;

    const task = async () => {
      attempts++;
      if (attempts < 3) {
        const err = new Error('Too many requests');
        (err as unknown as Record<string, number>).status = 429;
        throw err;
      }
      return 'success';
    };

    const result = await limiter.execute('retry-key', task, {isRetriable: (e) => (e as Record<string, number>).status === 429});
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('throws after max retries exhausted', async () => {
    const limiter = new RateLimiter({maxConcurrent: 10, maxRetries: 2, baseDelayMs: 10});

    const task = async () => {
      const err = new Error('Rate limited');
      (err as unknown as Record<string, number>).status = 429;
      throw err;
    };

    await expect(
      limiter.execute('fail-key', task, {isRetriable: () => true}),
    ).rejects.toThrow('Rate limited');
  });

  it('enforces cooldown between requests', async () => {
    const limiter = new RateLimiter({maxConcurrent: 1, cooldownMs: 50});
    const timestamps: number[] = [];

    const task = async () => {
      timestamps.push(Date.now());
      return true;
    };

    await limiter.execute('a', task);
    await limiter.execute('b', task);

    const gap = timestamps[1] - timestamps[0];
    expect(gap).toBeGreaterThanOrEqual(45);
  });
});
