// ============================================================
// Solana Narrative Pulse — Signal Aggregator
// ============================================================

import { Signal, CollectorResult } from '@/lib/types';
import { collectMarketSignals } from './market';
import { collectGitHubSignals } from './github';
import { collectOnChainSignals } from './onchain';
import { collectSocialSignals } from './social';
import { collectDefiLlamaSignals } from './defi-llama';
import { collectAgentKitSignals } from '@/lib/solana-agent';
import { collectDexSignals } from './dex';
import { collectNftSignals } from './nft';
import { enrichSignalDescriptions } from '@/lib/format-signals';
import { getCached, setCache, CACHE_TTL } from '@/lib/cache';

const SIGNAL_CACHE_KEY = 'all-signals';

// ── Run all collectors and merge signals ─────────────────────
// Results are cached for 5 minutes to prevent redundant API calls.
// Pass `forceRefresh: true` to bypass the cache.
export async function collectAllSignals(
    options: { forceRefresh?: boolean } = {}
): Promise<CollectorResult<Signal[]>> {

    // Check cache first (unless forced refresh)
    if (!options.forceRefresh) {
        const cached = getCached<CollectorResult<Signal[]>>(SIGNAL_CACHE_KEY);
        if (cached) {
            console.log(`📦 Returning cached signals (${cached.data.length} signals, collected at ${cached.collectedAt})`);
            return cached;
        }
    }

    console.log('🔄 Cache miss — collecting fresh signals from all sources...');
    const collectedAt = new Date().toISOString();
    const allSignals: Signal[] = [];
    const errors: string[] = [];

    // Run collectors in parallel with error isolation
    const results = await Promise.allSettled([
        collectMarketSignals(),
        collectGitHubSignals(),
        collectOnChainSignals(),
        collectAgentKitSignals(),
        collectSocialSignals(),
        collectDefiLlamaSignals(),
        collectDexSignals(),
        collectNftSignals(),
    ]);

    const sourceNames = ['market', 'github', 'onchain', 'agent-kit', 'social', 'defi-llama', 'dex', 'nft'];

    results.forEach((result, i) => {
        const source = sourceNames[i];
        if (result.status === 'fulfilled') {
            // Flatten the result if it's an array, or extract .data if it's a CollectorResult
            const data = (result.value as any).data || result.value;
            if (Array.isArray(data)) {
                allSignals.push(...data);
            }
        } else {
            // errors.push(`${source}: ${result.reason?.message || 'Unknown error'}`);
            console.error(`Collector ${source} failed:`, result.reason);
        }
    });

    // Sort by signal strength descending
    allSignals.sort((a, b) => b.strength - a.strength);

    // Enrich descriptions for consistency
    const enriched = enrichSignalDescriptions(allSignals);

    const result: CollectorResult<Signal[]> = {
        data: enriched,
        source: 'aggregator',
        collectedAt,
        error: errors.length > 0 ? errors.join('; ') : undefined,
    };

    // Cache the result
    setCache(SIGNAL_CACHE_KEY, result, CACHE_TTL.SIGNALS);
    console.log(`📦 Cached ${enriched.length} signals (TTL: ${CACHE_TTL.SIGNALS / 1000}s)`);

    return result;
}

// ── Cluster signals into related groups ──────────────────────
export function clusterSignals(signals: Signal[]): Record<string, Signal[]> {
    const clusters: Record<string, Signal[]> = {};

    signals.forEach(signal => {
        // Cluster by related projects
        signal.relatedProjects.forEach(project => {
            const key = `project:${project.toLowerCase()}`;
            if (!clusters[key]) clusters[key] = [];
            clusters[key].push(signal);
        });

        // Cluster by related tokens
        signal.relatedTokens.forEach(token => {
            const key = `token:${token.toLowerCase()}`;
            if (!clusters[key]) clusters[key] = [];
            clusters[key].push(signal);
        });

        // Cluster by category
        const catKey = `category:${signal.category.toLowerCase()}`;
        if (!clusters[catKey]) clusters[catKey] = [];
        clusters[catKey].push(signal);
    });

    // Filter to clusters with at least 2 signals (interesting convergence)
    const meaningful: Record<string, Signal[]> = {};
    for (const [key, sigs] of Object.entries(clusters)) {
        if (sigs.length >= 2) {
            meaningful[key] = sigs;
        }
    }

    return meaningful;
}

// ── Compute aggregate strength for a cluster ─────────────────
export function clusterStrength(signals: Signal[]): number {
    if (signals.length === 0) return 0;
    // Weighted average: more signals from different sources = stronger
    const sources = new Set(signals.map(s => s.source));
    const avgStrength = signals.reduce((sum, s) => sum + s.strength, 0) / signals.length;
    const diversityBonus = (sources.size - 1) * 10; // bonus for multi-source convergence
    return Math.min(100, avgStrength + diversityBonus);
}
