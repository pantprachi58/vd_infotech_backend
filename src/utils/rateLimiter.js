/* A small in-memory sliding-window limiter, enough for one API process.
   `hit(key)` records an attempt and returns true once the key is over the limit. */
export function createRateLimiter({ windowMs, max, maxKeys = 5000 }) {
  const hits = new Map();

  return {
    hit(key) {
      const now = Date.now();
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > maxKeys) {
        for (const [k, times] of hits) if (now - times.at(-1) > windowMs) hits.delete(k);
      }
      return recent.length > max;
    },
  };
}
