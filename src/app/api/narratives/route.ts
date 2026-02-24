// ============================================================
// API: POST /api/narratives — Stream narrative detection results
// ============================================================
// Uses Server-Sent Events (SSE) streaming to keep the connection alive
// and prevent Vercel gateway timeouts during AI processing.

import { NextRequest } from 'next/server';
import { collectAllSignals } from '@/lib/collectors/aggregator';
import { detectNarratives } from '@/lib/ai/detector';
import { saveEdition } from '@/lib/history';
import { Signal } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST: Frontend sends pre-fetched signals
export async function POST(request: NextRequest) {
    return handleStreaming(request, true);
}

// GET: Fallback for direct API usage
export async function GET(request: NextRequest) {
    return handleStreaming(request, false);
}

async function handleStreaming(request: NextRequest, isPost: boolean) {
    const startTime = Date.now();
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    let previousIdeaTitles: string[] = [];
    let clientSignals: Signal[] | null = null;

    if (isPost) {
        try {
            const body = await request.json();
            previousIdeaTitles = body.previousIdeaTitles || [];
            clientSignals = body.signals || null;
        } catch {
            // Invalid body — proceed without
        }
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (event: string, data: any) => {
                controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            };

            try {
                // Immediately send a status event to keep connection alive
                console.log('🔄 SSE: stream started');
                send('status', { step: 'started', message: 'Starting narrative detection...' });

                // Step 1: Get signals
                let signals: Signal[];
                let collectedAt: string;

                if (clientSignals && clientSignals.length > 0) {
                    signals = clientSignals;
                    collectedAt = new Date().toISOString();
                    send('status', { step: 'signals', message: `Using ${signals.length} signals` });
                } else {
                    send('status', { step: 'collecting', message: 'Collecting signals...' });
                    const signalResult = await collectAllSignals({ forceRefresh });
                    signals = signalResult.data;
                    collectedAt = signalResult.collectedAt;
                    send('status', { step: 'signals', message: `Collected ${signals.length} signals` });
                }

                // Step 2: AI Detection — send keep-alive pings every 5s
                console.log('🔄 SSE: starting AI detection...');
                send('status', { step: 'detecting', message: 'Running AI narrative detection...' });

                const keepAlive = setInterval(() => {
                    console.log('🔄 SSE: ping');
                    send('ping', { time: Date.now() });
                }, 5000);

                let narrativeResult;
                try {
                    narrativeResult = await detectNarratives(signals, previousIdeaTitles);
                } catch (aiErr: any) {
                    clearInterval(keepAlive);
                    console.error('🔴 AI detection threw:', aiErr.message);
                    send('error', { success: false, error: `AI failed: ${aiErr.message}` });
                    controller.close();
                    return;
                }

                const { narratives, signalContexts } = narrativeResult;
                clearInterval(keepAlive);
                console.log(`🔄 SSE: detected ${narratives.length} narratives`);
                send('status', { step: 'enriching', message: `Detected ${narratives.length} narratives` });

                // Step 3: Enrich signals
                const enrichedSignals = signals.map(s => ({
                    ...s,
                    aiContext: signalContexts[s.id]
                }));

                const processingTime = Date.now() - startTime;

                // Step 4: Save edition (non-critical)
                let edition = null;
                try {
                    edition = await saveEdition(narratives, enrichedSignals.length, processingTime);
                } catch (err) {
                    console.error('Failed to save edition (non-fatal):', err);
                }

                console.log('🔄 SSE: sending result event');
                // Send final result
                send('result', {
                    success: true,
                    data: {
                        narratives,
                        signals: enrichedSignals,
                        signalCount: signals.length,
                        collectedAt,
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
                });

            } catch (error: any) {
                console.error('Narrative detection error:', error);
                send('error', {
                    success: false,
                    error: error.message || 'Failed to detect narratives',
                });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
