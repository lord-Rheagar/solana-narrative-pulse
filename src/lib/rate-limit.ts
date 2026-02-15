// ============================================================
// Solana Narrative Pulse — In-Memory Sliding Window Rate Limiter
// ============================================================
// Prevents abuse of expensive API routes (AI inference, external
// API calls) by limiting requests per IP using a sliding window.

import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
    timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Periodic cleanup to prevent memory leaks from stale IPs
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
let lastCleanup = Date.now();

function cleanup(maxWindowMs: number) {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    lastCleanup = now;

    for (const [key, entry] of store.entries()) {
        entry.timestamps = entry.timestamps.filter(t => now - t < maxWindowMs);
        if (entry.timestamps.length === 0) {
            store.delete(key);
        }
    }
}

export interface RateLimitConfig {
    /** Max requests allowed within the window */
    maxRequests: number;
    /** Time window in milliseconds */
    windowMs: number;
}

/** Pre-configured limits for each route tier */
export const RATE_LIMITS = {
    /** /api/narratives — expensive (AI + 9 collectors): 10 req / 15 min */
    NARRATIVES: { maxRequests: 10, windowMs: 15 * 60 * 1000 },
    /** /api/signals — moderately expensive (9 collectors): 10 req / 5 min */
    SIGNALS: { maxRequests: 10, windowMs: 5 * 60 * 1000 },
} as const;

/**
 * Extract a client identifier from the request.
 * Uses X-Forwarded-For (common behind proxies/Vercel), then
 * falls back to x-real-ip, then a generic key.
 */
function getClientId(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();

    const realIp = request.headers.get('x-real-ip');
    if (realIp) return realIp;

    return 'unknown';
}

/**
 * Check whether a request is allowed under the given rate limit.
 *
 * Returns `{ allowed: true }` if the request can proceed, or
 * `{ allowed: false, response }` with a 429 JSON response to return.
 *
 * Usage in a route handler:
 * ```ts
 * const rl = checkRateLimit(request, 'narratives', RATE_LIMITS.NARRATIVES);
 * if (!rl.allowed) return rl.response;
 * ```
 */
export function checkRateLimit(
    request: NextRequest,
    routeKey: string,
    config: RateLimitConfig,
): { allowed: true } | { allowed: false; response: NextResponse } {
    const clientId = getClientId(request);
    const key = `${routeKey}:${clientId}`;
    const now = Date.now();

    // Lazy cleanup
    cleanup(Math.max(RATE_LIMITS.NARRATIVES.windowMs, RATE_LIMITS.SIGNALS.windowMs));

    // Get or create entry
    let entry = store.get(key);
    if (!entry) {
        entry = { timestamps: [] };
        store.set(key, entry);
    }

    // Slide the window: drop timestamps outside the current window
    entry.timestamps = entry.timestamps.filter(t => now - t < config.windowMs);

    if (entry.timestamps.length >= config.maxRequests) {
        const oldestInWindow = entry.timestamps[0];
        const retryAfterMs = config.windowMs - (now - oldestInWindow);
        const retryAfterSec = Math.ceil(retryAfterMs / 1000);

        const response = NextResponse.json(
            {
                success: false,
                error: 'Rate limit exceeded. Please try again later.',
                retryAfter: retryAfterSec,
            },
            {
                status: 429,
                headers: {
                    'Retry-After': String(retryAfterSec),
                    'X-RateLimit-Limit': String(config.maxRequests),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': String(Math.ceil((oldestInWindow + config.windowMs) / 1000)),
                },
            },
        );

        return { allowed: false, response };
    }

    // Allow and record the request
    entry.timestamps.push(now);
    return { allowed: true };
}

/**
 * Get current rate limit stats (for debugging / status endpoints).
 */
export function getRateLimitStats(): { trackedIPs: number; entries: number } {
    return {
        trackedIPs: store.size,
        entries: [...store.values()].reduce((sum, e) => sum + e.timestamps.length, 0),
    };
}
