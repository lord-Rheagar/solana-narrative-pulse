// ============================================================
// API: POST /api/idea-detail — Generate deep-dive for a single idea
// ============================================================
// Called on-demand when a user clicks an idea in the UI.

import { NextRequest, NextResponse } from 'next/server';
import { generateIdeaDeepDive } from '@/lib/ai/generator';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { idea, narrative } = body;

        if (!idea?.title || !narrative?.name) {
            return NextResponse.json(
                { success: false, error: 'Missing idea or narrative context' },
                { status: 400 },
            );
        }

        const result = await generateIdeaDeepDive(idea, narrative);

        return NextResponse.json({
            success: true,
            data: result,
        });
    } catch (err: any) {
        console.error('Idea deep-dive failed:', err);
        return NextResponse.json(
            { success: false, error: err.message || 'Deep-dive generation failed' },
            { status: 500 },
        );
    }
}
