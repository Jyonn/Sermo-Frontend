type CachedResource<T> = {value: T; validUntil: number};

/** Keeps short-lived share metadata in memory and coalesces concurrent reads. */
export class ShareResourceCache<T> {
  private readonly values = new Map<string, CachedResource<T>>();
  private readonly pending = new Map<string, Promise<T>>();
  private readonly limit: number;
  private readonly now: () => number;

  constructor(limit = 128, now = () => performance.now()) {
    this.limit = limit;
    this.now = now;
  }

  get(key: string) {
    const entry = this.values.get(key);
    if (!entry) return undefined;
    this.values.delete(key);
    if (entry.validUntil <= this.now()) return undefined;
    this.values.set(key, entry);
    return entry.value;
  }

  invalidate(key: string) {
    this.values.delete(key);
    this.pending.delete(key);
  }

  load(key: string, fetchResource: () => Promise<CachedResource<T>>, refresh = false): Promise<T> {
    if (!refresh) {
      const cached = this.get(key);
      if (cached !== undefined) return Promise.resolve(cached);
    }
    const pending = this.pending.get(key);
    if (pending) return pending;
    const read = Promise.resolve().then(fetchResource).then(entry => {
      if (this.pending.get(key) !== read) return entry.value;
      this.values.delete(key);
      if (entry.validUntil > this.now()) {
        this.values.set(key, entry);
        if (this.values.size > this.limit) this.values.delete(this.values.keys().next().value!);
      }
      return entry.value;
    }).finally(() => {
      if (this.pending.get(key) === read) this.pending.delete(key);
    });
    this.pending.set(key, read);
    return read;
  }
}
