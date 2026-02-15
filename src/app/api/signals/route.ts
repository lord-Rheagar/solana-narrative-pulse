// ============================================================
// API: GET /api/signals — Return raw signal data
// ============================================================
// Returns cached signals if available. Use ?refresh=true to bypass.

import { NextRequest, NextResponse } from 'next/server';
import { collectAllSignals } from '@/lib/collectors/aggregator';
import { getCacheStats } from '@/lib/cache';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

    // Rate limit — this route triggers 9 parallel collectors
    const rl = checkRateLimit(request, 'signals', RATE_LIMITS.SIGNALS);
    if (!rl.allowed) return rl.response;

    try {
        const result = await collectAllSignals({ forceRefresh });
        const stats = getCacheStats();
        const cacheAge = stats.ages['all-signals'] || 0;

        return NextResponse.json({
            success: true,
            data: {
                signals: result.data,
                count: result.data.length,
                collectedAt: result.collectedAt,
                sources: [...new Set(result.data.map(s => s.source))],
                fromCache: !forceRefresh && cacheAge > 0,
                cacheAge,
            },
        });
    } catch (error: any) {
        console.error('Signal collection error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to collect signals' },
            { status: 500 }
        );
    }
}

