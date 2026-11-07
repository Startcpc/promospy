import { setTimeout as sleep } from 'node:timers/promises';

export type SchedulerOptions = {
  maxConcurrent: number;
  capacity: number;
  refillPerSecond: number;
};

type Pending = {
  signal: AbortSignal;
  resolve: (release: () => void) => void;
  reject: (error: unknown) => void;
  onAbort: () => void;
};

type Bucket = {
  active: number;
  tokens: number;
  lastRefill: number;
  suspendedUntil: number;
  queue: Pending[];
  timer?: ReturnType<typeof setTimeout>;
};

const DEFAULT_OPTIONS: SchedulerOptions = {
  maxConcurrent: 2,
  capacity: 2,
  refillPerSecond: 1.5,
};

/** Shared FIFO scheduler. Waiting for a token never holds an active slot. */
export class DomainScheduler {
  private readonly buckets = new Map<string, Bucket>();
  private readonly config: SchedulerOptions;

  constructor(options: Partial<SchedulerOptions> = {}) {
    this.config = { ...DEFAULT_OPTIONS, ...options };
    if (!Number.isFinite(this.config.maxConcurrent) || this.config.maxConcurrent < 1 ||
      !Number.isFinite(this.config.capacity) || this.config.capacity < 1 ||
      !Number.isFinite(this.config.refillPerSecond) || this.config.refillPerSecond <= 0) {
      throw new RangeError('Invalid domain scheduler configuration');
    }
  }

  private bucket(host: string): Bucket {
    const key = host.toLowerCase();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { active: 0, tokens: this.config.capacity, lastRefill: Date.now(), suspendedUntil: 0, queue: [] };
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  cooldown(host: string, milliseconds: number): void {
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) return;
    const bucket = this.bucket(host);
    bucket.suspendedUntil = Math.max(bucket.suspendedUntil, Date.now() + milliseconds);
    this.pump(bucket);
  }

  private pump(bucket: Bucket): void {
    if (bucket.timer) {
      clearTimeout(bucket.timer);
      bucket.timer = undefined;
    }
    const now = Date.now();
    const elapsed = Math.max(0, now - bucket.lastRefill);
    bucket.tokens = Math.min(this.config.capacity, bucket.tokens + elapsed * this.config.refillPerSecond / 1000);
    bucket.lastRefill = now;
    while (bucket.queue.length && bucket.active < this.config.maxConcurrent &&
      bucket.tokens >= 1 && now >= bucket.suspendedUntil) {
      const waiting = bucket.queue.shift()!;
      waiting.signal.removeEventListener('abort', waiting.onAbort);
      if (waiting.signal.aborted) {
        waiting.reject(waiting.signal.reason);
        continue;
      }
      bucket.tokens -= 1;
      bucket.active += 1;
      let released = false;
      waiting.resolve(() => {
        if (released) return;
        released = true;
        bucket.active -= 1;
        this.pump(bucket);
      });
    }
    if (bucket.queue.length && bucket.active < this.config.maxConcurrent) {
      const cooldownWait = Math.max(0, bucket.suspendedUntil - Date.now());
      const tokenWait = bucket.tokens >= 1 ? 0 : Math.ceil((1 - bucket.tokens) * 1000 / this.config.refillPerSecond);
      bucket.timer = setTimeout(() => this.pump(bucket), Math.max(1, cooldownWait, tokenWait));
    }
  }

  private acquire(host: string, signal: AbortSignal): Promise<() => void> {
    signal.throwIfAborted();
    const bucket = this.bucket(host);
    return new Promise((resolve, reject) => {
      const waiting: Pending = {
        signal, resolve, reject,
        onAbort: () => {
          const index = bucket.queue.indexOf(waiting);
          if (index !== -1) {
            bucket.queue.splice(index, 1);
            reject(signal.reason);
            this.pump(bucket);
          }
        },
      };
      bucket.queue.push(waiting);
      signal.addEventListener('abort', waiting.onAbort, { once: true });
      this.pump(bucket);
    });
  }

  async run<T>(host: string, signal: AbortSignal, work: () => Promise<T>): Promise<T> {
    const release = await this.acquire(host, signal);
    try {
      signal.throwIfAborted();
      return await work();
    } finally {
      release();
    }
  }
}

export const publicSiteScheduler = new DomainScheduler();

export function retryAfterMilliseconds(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const raw = value.trim();
  if (/^\d+$/.test(raw)) return Math.min(Number(raw) * 1000, 86_400_000);
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, Math.min(date - now, 86_400_000)) : undefined;
}

export class HttpPageError extends Error {
  readonly status: number;
  readonly retryAfterMs?: number;

  constructor(status: number, retryAfterHeader: string | null = null) {
    super('HTTP ' + status);
    this.name = 'HttpPageError';
    this.status = status;
    this.retryAfterMs = retryAfterMilliseconds(retryAfterHeader);
  }
}

function retryable(error: unknown): boolean {
  if (error instanceof HttpPageError) {
    return [408, 425, 429, 500, 502, 503, 504].includes(error.status);
  }
  if (error instanceof TypeError) return true; // Node fetch network failures.
  if (error instanceof Error) {
    return error.name === 'TimeoutError' ||
      /ECONNRESET|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|UND_ERR_CONNECT_TIMEOUT/.test(error.message);
  }
  return false;
}

export type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  maxWaitMs?: number;
};

/** Retry transient transport/HTTP failures, never authentication or access denial. */
export async function resilientRequest<T>(
  host: string,
  signal: AbortSignal,
  request: () => Promise<T>,
  scheduler: DomainScheduler = publicSiteScheduler,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, Math.min(5, Math.floor(options.attempts ?? 3)));
  const base = options.baseDelayMs ?? 350;
  const maxWait = options.maxWaitMs ?? 10_000;
  for (let attempt = 0; attempt < attempts; attempt++) {
    signal.throwIfAborted();
    try {
      return await scheduler.run(host, signal, request);
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      if (!retryable(error)) throw error;
      const explicitWait = error instanceof HttpPageError ? error.retryAfterMs : undefined;
      if (error instanceof HttpPageError && (error.status === 429 || error.status === 503) &&
        explicitWait !== undefined) {
        // Honor Retry-After across other queued requests even if it is too long to retry here.
        scheduler.cooldown(host, explicitWait);
      }
      if (attempt === attempts - 1) throw error;
      const exponential = Math.min(maxWait, base * 2 ** attempt);
      const waitMs = explicitWait ?? Math.round(exponential * (0.8 + Math.random() * 0.4));
      if (waitMs > maxWait) throw error;
      await sleep(Math.max(50, waitMs), undefined, { signal });
    }
  }
  throw new Error('HTTP retry budget exhausted');
}
