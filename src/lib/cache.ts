// ============================================================
// Solana Narrative Pulse — In-Memory TTL Cache
// ============================================================
// Prevents redundant external API calls by caching results
// with configurable TTL per key.

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
    createdAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

// ── Cache TTL presets (in milliseconds) ──────────────────────

export const CACHE_TTL = {
    SIGNALS: 5 * 60 * 1000,       // 5 minutes — market data changes frequently
    NARRATIVES: 15 * 60 * 1000,   // 15 minutes — AI detection is expensive
    COLLECTOR: 5 * 60 * 1000,     // 5 minutes — individual collector results
} as const;

// ── Core API ─────────────────────────────────────────────────

/**
 * Get a cached value if it exists and hasn't expired.
 * Returns `null` if the key doesn't exist or has expired.
 */
export function getCached<T>(key: string): T | null {
    const entry = store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
    }

    return entry.data as T;
}

/**
 * Store a value in the cache with a TTL.
 */
export function setCache<T>(key: string, data: T, ttlMs: number): void {
    store.set(key, {
        data,
        expiresAt: Date.now() + ttlMs,
        createdAt: Date.now(),
    });
}

/**
 * Invalidate a specific cache key.
 */
export function invalidateCache(key: string): boolean {
    return store.delete(key);
}

/**
 * Invalidate all cache keys matching a prefix.
 * Example: invalidateCacheByPrefix('collector:') clears all collector caches.
 */
export function invalidateCacheByPrefix(prefix: string): number {
    let count = 0;
    for (const key of store.keys()) {
        if (key.startsWith(prefix)) {
            store.delete(key);
            count++;
        }
    }
    return count;
}

/**
 * Clear the entire cache.
 */
export function clearCache(): void {
    store.clear();
}

/**
 * Get cache statistics for debugging/dashboard display.
 */
export function getCacheStats(): {
    entries: number;
    keys: string[];
    ages: Record<string, number>;
} {
    const now = Date.now();
    const ages: Record<string, number> = {};

    for (const [key, entry] of store.entries()) {
        if (now > entry.expiresAt) {
            store.delete(key); // Clean up expired entries
        } else {
            ages[key] = Math.round((now - entry.createdAt) / 1000); // age in seconds
        }
    }

    return {
        entries: store.size,
        keys: [...store.keys()],
        ages,
    };
}
