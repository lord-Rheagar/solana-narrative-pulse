// ============================================================
// API: POST /api/regenerate-ideas — Regenerate ideas for existing narratives
// ============================================================
// Called on 2nd+ Detect: skips signal collection and narrative detection,
// only generates fresh ideas. Much faster than full pipeline.

import { NextRequest, NextResponse } from 'next/server';
import { generateIdeasForNarrative } from '@/lib/ai/generator';
import { Narrative } from '@/lib/types';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

export async function POST(request: NextRequest) {
    const rl = checkRateLimit(request, 'narratives', RATE_LIMITS.NARRATIVES);
    if (!rl.allowed) return rl.response;

    try {
        const { narratives, previousIdeaTitles } = await request.json();

        if (!narratives?.length) {
            return NextResponse.json(
                { success: false, error: 'No narratives provided' },
                { status: 400 },
            );
        }

        console.log(`🔄 Regenerating ideas for ${narratives.length} narratives (${previousIdeaTitles?.length || 0} seen titles)`);
        const startTime = Date.now();

        const updatedNarratives = await Promise.all(
            narratives.map(async (narrative: Narrative) => {
                try {
                    const ideas = await generateIdeasForNarrative(narrative, previousIdeaTitles || []);
                    return { ...narrative, ideas };
                } catch (err) {
                    console.error(`Idea regeneration failed for ${narrative.name}:`, err);
                    return narrative;
                }
            })
        );

        const processingTime = Date.now() - startTime;
        console.log(`✅ Ideas regenerated in ${(processingTime / 1000).toFixed(1)}s`);

        return NextResponse.json({
            success: true,
            data: {
                narratives: updatedNarratives,
                processingTime,
                ideasOnly: true,
            },
        });
    } catch (err: any) {
        console.error('Idea regeneration failed:', err);
        return NextResponse.json(
            { success: false, error: err.message || 'Failed to regenerate ideas' },
            { status: 500 },
        );
    }
}
