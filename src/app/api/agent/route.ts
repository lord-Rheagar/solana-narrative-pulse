// ============================================================
// API: GET /api/agent — Solana Agent Kit status + capabilities
// ============================================================

import { NextResponse } from 'next/server';
import { getSolanaAgent } from '@/lib/solana-agent';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const agent = getSolanaAgent();
        const wallet = agent.wallet?.publicKey?.toString() || 'throwaway';

        return NextResponse.json({
            success: true,
            data: {
                agentName: 'solana-narrative-pulse',
                framework: 'solana-agent-kit',
                plugins: ['@solana-agent-kit/plugin-misc'],
                walletAddress: wallet,
                capabilities: [
                    'get_trending_tokens',
                    'fetch_price',
                    'get_token_data',
                    'narrative_detection',
                    'idea_generation',
                ],
                status: 'active',
            },
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
