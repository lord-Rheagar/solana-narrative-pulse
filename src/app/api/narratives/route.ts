// ============================================================
// API: GET /api/narratives — Detect and return narratives
// ============================================================
// Cached for 15 minutes. Use ?refresh=true to bypass cache.

import { NextRequest, NextResponse } from 'next/server';
import { collectAllSignals } from '@/lib/collectors/aggregator';
import { detectNarratives } from '@/lib/ai/detector';
import { saveEdition } from '@/lib/history';
import { getCached, setCache, CACHE_TTL, getCacheStats } from '@/lib/cache';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const NARRATIVE_CACHE_KEY = 'narrative-result';

export async function GET(request: NextRequest) {
    const startTime = Date.now();
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

    // Read per-session dedup titles from header (base64-encoded JSON array)
    let previousIdeaTitles: string[] = [];
    const prevIdeasHeader = request.headers.get('X-Previous-Ideas');
    if (prevIdeasHeader) {
        try {
            previousIdeaTitles = JSON.parse(atob(prevIdeasHeader));
        } catch {
            // Malformed header — ignore, use empty array
        }
    }
    const hasSessionDedup = previousIdeaTitles.length > 0;

    // Rate limit — this route triggers AI inference + 9 collectors
    const rl = checkRateLimit(request, 'narratives', RATE_LIMITS.NARRATIVES);
    if (!rl.allowed) return rl.response;

    // Check narrative cache first (skip when session-specific dedup is active)
    if (!forceRefresh && !hasSessionDedup) {
        const cached = getCached<any>(NARRATIVE_CACHE_KEY);
        if (cached) {
            const stats = getCacheStats();
            const ageSeconds = stats.ages[NARRATIVE_CACHE_KEY] || 0;
            console.log(`📦 Returning cached narratives (age: ${ageSeconds}s)`);
            return NextResponse.json({
                ...cached,
                data: { ...cached.data, fromCache: true, cacheAge: ageSeconds },
            });
        }
    }

    try {
        // Step 1: Collect signals (use cached if available — /api/signals primes the cache)
        const signalResult = await collectAllSignals({ forceRefresh: forceRefresh });

        // Step 2: Detect narratives using AI (pass session dedup titles if available)
        const { narratives, signalContexts } = await detectNarratives(signalResult.data, previousIdeaTitles);

        // Merge AI context back into main signal list
        const enrichedSignals = signalResult.data.map(s => ({
            ...s,
            aiContext: signalContexts[s.id]
        }));

        const processingTime = Date.now() - startTime;

        // Step 3: Auto-save this edition to history
        let edition = null;
        try {
            edition = await saveEdition(narratives, enrichedSignals.length, processingTime);
        } catch (err) {
            console.error('Failed to save edition (non-fatal):', err);
        }

        const responseBody = {
            success: true,
            data: {
                narratives,
                signals: enrichedSignals,
                signalCount: signalResult.data.length,
                collectedAt: signalResult.collectedAt,
                processingTime,
                fromCache: false,
                edition: edition ? {
                    id: edition.id,
                    narrativeStatuses: edition.narratives.map(n => ({
                        slug: n.slug,
                        status: n.status,
                        confidenceDelta: n.confidenceDelta,
                    })),
                } : null,
            },
        };

        // Cache the successful response (skip when result is session-specific)
        if (!hasSessionDedup) {
            setCache(NARRATIVE_CACHE_KEY, responseBody, CACHE_TTL.NARRATIVES);
            console.log(`📦 Cached narrative result (TTL: ${CACHE_TTL.NARRATIVES / 1000}s)`);
        } else {
            console.log(`🔄 Session-specific dedup active (${previousIdeaTitles.length} seen titles) — skipping cache`);
        }

        return NextResponse.json(responseBody);
    } catch (error: any) {
        console.error('Narrative detection error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Failed to detect narratives',
            },
            { status: 500 }
        );
    }
}
