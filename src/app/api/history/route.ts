// ============================================================
// API: GET /api/history — Retrieve narrative history
// ============================================================

import { NextResponse } from 'next/server';
import { readHistory, getNarrativeTrajectory } from '@/lib/history';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const slug = searchParams.get('slug');

        // If slug is provided, return trajectory for that narrative
        if (slug) {
            const trajectory = await getNarrativeTrajectory(slug);
            return NextResponse.json({ success: true, data: { trajectory } });
        }

        // Otherwise return full history
        const history = await readHistory();

        return NextResponse.json({
            success: true,
            data: {
                editions: history.editions,
                totalEditions: history.editions.length,
                lastUpdated: history.lastUpdated,
            },
        });
    } catch (error: any) {
        console.error('History API error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to read history' },
            { status: 500 }
        );
    }
}
