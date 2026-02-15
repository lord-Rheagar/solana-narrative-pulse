// ============================================================
// API: GET /api/heartbeat — Agent heartbeat endpoint
// ============================================================

import { NextResponse } from 'next/server';
import { AgentHeartbeat } from '@/lib/types';
import { CONFIG } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET() {
    const heartbeat: AgentHeartbeat = {
        status: 'ok',
        agentName: CONFIG.superteam.agentName,
        time: new Date().toISOString(),
        version: CONFIG.superteam.agentVersion,
        capabilities: ['register', 'listings', 'submit', 'narratives', 'signals'],
        lastAction: 'serving dashboard',
        nextAction: 'waiting for narrative detection request',
    };

    return NextResponse.json(heartbeat);
}
