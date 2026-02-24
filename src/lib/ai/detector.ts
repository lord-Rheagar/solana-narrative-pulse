// ============================================================
// Solana Narrative Pulse — Narrative Detection Engine
// ============================================================
// Uses o3-mini (reasoning model) for deep pattern recognition

import { Signal, Narrative, NarrativeCategory } from '@/lib/types';
import { NARRATIVE_DETECTION_PROMPT } from './prompts';
import { clusterSignals, clusterStrength } from '@/lib/collectors/aggregator';
import { generateIdeasForNarrative } from './generator';
import { routeToModel, getActiveModels } from './model-router';

function generateSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function generateId(): string {
    return `nar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Diversity-aware signal selection ─────────────────────────
// Guarantees every active source gets representation, then fills
// remaining slots with the strongest signals across all sources.
const MAX_SIGNALS_FOR_AI = 25;
const MIN_PER_SOURCE = 2;
const MAX_CLUSTERS = 12;

function selectDiverseSignals(signals: Signal[]): Signal[] {
    if (signals.length <= MAX_SIGNALS_FOR_AI) return signals;

    // Group by source
    const bySource = new Map<string, Signal[]>();
    signals.forEach(s => {
        const list = bySource.get(s.source) || [];
        list.push(s);
        bySource.set(s.source, list);
    });

    const selected = new Set<string>(); // track by signal id
    const result: Signal[] = [];

    // Phase 1: guarantee MIN_PER_SOURCE from each source (strongest first)
    for (const [, sourceSignals] of bySource) {
        sourceSignals
            .sort((a, b) => b.strength - a.strength)
            .slice(0, MIN_PER_SOURCE)
            .forEach(s => {
                if (!selected.has(s.id)) {
                    selected.add(s.id);
                    result.push(s);
                }
            });
    }

    // Phase 2: fill remaining slots with strongest unselected signals
    const remaining = signals
        .filter(s => !selected.has(s.id))
        .sort((a, b) => b.strength - a.strength);

    for (const s of remaining) {
        if (result.length >= MAX_SIGNALS_FOR_AI) break;
        result.push(s);
    }

    // Sort final selection by strength for the AI prompt
    result.sort((a, b) => b.strength - a.strength);
    return result;
}

// ── Detect narratives from signals ───────────────────────────
export async function detectNarratives(signals: Signal[], previousIdeaTitles?: string[]): Promise<{ narratives: Narrative[]; signalContexts: Record<string, string> }> {
    if (signals.length === 0) {
        return buildFallbackNarratives([], 'No signals available');
    }

    const models = getActiveModels();
    console.log(`🧠 Narrative detection using: ${models.reasoning}`);
    console.log(`✍️ Idea generation using: ${models.writing}`);

    // Select signals with source diversity guarantee
    const selectedSignals = selectDiverseSignals(signals);
    const sourceCounts = new Map<string, number>();
    selectedSignals.forEach(s => sourceCounts.set(s.source, (sourceCounts.get(s.source) || 0) + 1));
    console.log(`📊 Selected ${selectedSignals.length}/${signals.length} signals for AI (sources: ${[...sourceCounts.entries()].map(([k, v]) => `${k}:${v}`).join(', ')})`);

    // Cluster signals for context
    const clusters = clusterSignals(signals);
    const clusterSummaries = Object.entries(clusters)
        .map(([key, sigs]) => ({
            cluster: key,
            strength: clusterStrength(sigs),
            signals: sigs.map(s => ({ id: s.id, description: s.description, strength: s.strength })),
        }))
        .sort((a, b) => b.strength - a.strength)
        .slice(0, MAX_CLUSTERS);

    // Build context for LLM — concise signal summaries
    const signalContext = selectedSignals.map(s => {
        const parts = [`[${s.id}] (${s.source}/${s.category}) ${s.description}`];
        if (s.delta !== undefined && s.delta !== 0) parts.push(`Δ${s.delta > 0 ? '+' : ''}${s.delta.toFixed(1)}%`);
        if (s.relatedTokens?.length) parts.push(`tokens: ${s.relatedTokens.slice(0, 3).join(',')}`);
        if (s.relatedProjects?.length) parts.push(`projects: ${s.relatedProjects.slice(0, 2).join(',')}`);
        if (s.fullText) parts.push(`ctx: ${s.fullText.slice(0, 100)}`);
        parts.push(`[str: ${s.strength}]`);
        return parts.join(' | ');
    }).join('\n');

    const clusterContext = clusterSummaries.map(c =>
        `Cluster "${c.cluster}" (strength: ${c.strength.toFixed(0)}):\n${c.signals.map(s => `  - [${s.id}] ${s.description}`).join('\n')}`
    ).join('\n\n');

    const userMessage = `## Raw Signals (${selectedSignals.length} signals across ${sourceCounts.size} sources)\n${signalContext}\n\n## Signal Clusters (${clusterSummaries.length} clusters)\n${clusterContext}\n\nRespond with a JSON object containing a "narratives" array and a "topSignalInsights" map. Include insights for the most important signals (at least 10).`;

    try {
        // Race a 45s timeout to prevent Vercel function timeout returning non-JSON
        const AI_TIMEOUT = 45_000;
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('AI detection timed out after 45s')), AI_TIMEOUT)
        );

        // Route to REASONING model (o3-mini) for deep pattern analysis
        const response = await Promise.race([
            routeToModel('reasoning', [
                { role: 'system', content: NARRATIVE_DETECTION_PROMPT },
                { role: 'user', content: userMessage },
            ], {
                jsonMode: true,
                maxTokens: 6000,
                temperature: 0.3,
            }),
            timeoutPromise,
        ]);

        console.log(`🧠 Detection completed via ${response.provider}/${response.model} (${response.tokensUsed || '?'} tokens)`);

        // Extract JSON from response (o3-mini may wrap in markdown)
        let jsonContent = response.content;
        const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonContent = jsonMatch[1];

        console.log('🔍 Raw AI JSON (First 200 chars):', jsonContent.slice(0, 200));

        let parsed: any;
        try {
            parsed = JSON.parse(jsonContent);
        } catch (parseErr: any) {
            // Retry: send the broken response back and ask the model to fix it
            console.warn('🔄 JSON parse failed, attempting retry...', parseErr.message);
            try {
                const retryMessages = [
                    { role: 'system' as const, content: NARRATIVE_DETECTION_PROMPT },
                    { role: 'user' as const, content: userMessage },
                    { role: 'assistant' as const, content: response.content },
                    { role: 'user' as const, content: `Your previous response was not valid JSON: "${parseErr.message}". Please return ONLY valid JSON with no markdown wrapping, no trailing commas, and no comments. Output the corrected version now.` },
                ];
                const retryResponse = await routeToModel('reasoning', retryMessages, {
                    jsonMode: true,
                    maxTokens: 6000,
                    temperature: 0.2,
                });

                let retryContent = retryResponse.content;
                const retryMatch = retryContent.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (retryMatch) retryContent = retryMatch[1];

                console.log('🔄 Retry JSON (First 200 chars):', retryContent.slice(0, 200));
                parsed = JSON.parse(retryContent);
            } catch (retryErr: any) {
                console.error('🔄 JSON retry also failed, falling back to defaults:', retryErr.message);
                return buildFallbackNarratives(signals, retryErr.message || 'JSON parsing failed after retry');
            }
        }
        const now = new Date().toISOString();

        // 1. Gather all signal contexts (from topSignalInsights AND narrative.supportingSignals)
        const globalContexts: Record<string, string> = parsed.topSignalInsights || {};

        // Also add old-style contexts if present (backward compatibility)
        if (parsed.signalContexts) {
            Object.assign(globalContexts, parsed.signalContexts);
        }

        // Transform LLM output into Narrative objects
        const narratives: Narrative[] = (parsed.narratives || []).map((n: any) => {
            const id = generateId();

            // Handle both old (array of strings) and new (array of objects) formats just in case
            const supportingSignals = n.supportingSignals || n.supportingSignalIds || [];
            const signalIds = supportingSignals.map((s: any) => typeof s === 'string' ? s : s.id);

            // Extract contexts from supportingSignals array
            supportingSignals.forEach((s: any) => {
                if (typeof s === 'object' && s.id && s.context) {
                    globalContexts[s.id] = s.context;
                }
            });

            return {
                id,
                name: n.name,
                slug: generateSlug(n.name),
                category: (n.category || 'Other') as NarrativeCategory,
                confidence: Math.min(100, Math.max(0, n.confidence || 50)),
                summary: n.summary,
                explanation: n.explanation,
                signals: signals
                    .filter(s => signalIds.includes(s.id))
                    .map(s => ({
                        ...s,
                        aiContext: globalContexts[s.id] // Use the unified map
                    })),
                signalStrength: clusterStrength(
                    signals.filter(s => signalIds.includes(s.id))
                ),
                ideas: [],
                detectedAt: now,
                updatedAt: now,
                trend: n.trend || 'stable',
                recommendation: n.recommendation ? {
                    thesis: n.recommendation.thesis || '',
                    actionables: n.recommendation.actionables || [],
                    risks: n.recommendation.risks || [],
                } : undefined,
            };
        });

        // Apply AI context to ALL input signals (not just narrative-linked ones)
        for (const signal of signals) {
            if (globalContexts[signal.id]) {
                signal.aiContext = globalContexts[signal.id];
            }
        }

        console.log(`📝 AI context applied to ${Object.keys(globalContexts).length}/${signals.length} signals`);

        // Assign pre-built ideas based on narrative category (no additional AI calls)
        // This keeps the total function time under 15s instead of 60s+
        const narrativesWithIdeas = narratives.map((narrative) => {
            const cat = narrative.category || 'DeFi';
            const templateIdeas = FALLBACK_IDEAS[cat] || FALLBACK_IDEAS['DeFi'];
            const ideas = templateIdeas.map((idea, j) => ({
                ...idea,
                id: `${narrative.id}-idea-${j}`,
                narrativeId: narrative.id,
                supportingSignalIds: narrative.signals.slice(0, 3).map(s => s.id),
                signalRelevance: {} as Record<string, string>,
                problemToSolve: '',
                possibleSolution: '',
            }));
            return { ...narrative, ideas };
        });

        return { narratives: narrativesWithIdeas, signalContexts: globalContexts };
    } catch (err: any) {
        console.error('Narrative detection failed:', err);
        return buildFallbackNarratives(signals, err?.message || 'Unknown AI error');
    }
}

// ── Fallback idea templates per category ─────────────────────
const FALLBACK_IDEAS: Record<string, Array<{ title: string; description: string; techStack: string[]; complexity: 'Low' | 'Medium' | 'High'; impact: 'Low' | 'Medium' | 'High'; solanaFeatures: string[]; whyNow: string; targetUser: string }>> = {
    DeFi: [
        { title: 'DeFi Portfolio Tracker', description: 'Unified dashboard to track positions across all Solana DeFi protocols — lending, swaps, and LP.', techStack: ['Next.js', 'Helius API', 'Recharts'], complexity: 'Low', impact: 'Medium', solanaFeatures: ['Token accounts', 'DeFi composability'], whyNow: 'Growing DeFi TVL creates demand for unified position tracking.', targetUser: 'DeFi users managing positions across multiple protocols.' },
        { title: 'Yield Aggregator Alert Bot', description: 'Monitors yield farms across Solana and sends alerts when APY spikes or drops significantly.', techStack: ['Node.js', 'DeFi Llama API', 'Telegram Bot API'], complexity: 'Low', impact: 'Medium', solanaFeatures: ['SPL tokens', 'Program accounts'], whyNow: 'Yield volatility means users miss optimal entry/exit windows.', targetUser: 'Yield farmers and liquidity providers on Solana.' },
        { title: 'Smart Swap Router', description: 'Compares swap rates across Jupiter, Raydium, and Orca to find the best execution price.', techStack: ['Next.js', 'Jupiter API', '@solana/web3.js'], complexity: 'Medium', impact: 'High', solanaFeatures: ['Jupiter aggregator', 'Transaction optimization'], whyNow: 'Rising DEX volumes make execution quality increasingly important.', targetUser: 'Active traders seeking best execution on Solana.' },
    ],
    Infrastructure: [
        { title: 'Solana TPS Dashboard', description: 'Real-time network health monitor showing TPS, slot times, validator stats, and congestion alerts.', techStack: ['Next.js', 'Helius RPC', 'D3.js'], complexity: 'Low', impact: 'Medium', solanaFeatures: ['RPC endpoints', 'Validator network'], whyNow: 'Network performance directly impacts user experience and protocol reliability.', targetUser: 'Solana developers and node operators.' },
        { title: 'Program Deployment Tracker', description: 'Monitor new program deployments on Solana with alerts for upgradeable program changes.', techStack: ['Node.js', 'Helius API', 'PostgreSQL'], complexity: 'Medium', impact: 'Medium', solanaFeatures: ['BPF loader', 'Program accounts'], whyNow: 'Security monitoring of program upgrades is critical for protocol safety.', targetUser: 'Security researchers and protocol auditors.' },
    ],
    'NFT & Gaming': [
        { title: 'NFT Floor Price Tracker', description: 'Track Solana NFT collection floor prices with alerts and trend analysis.', techStack: ['Next.js', 'Magic Eden API', 'Recharts'], complexity: 'Low', impact: 'Medium', solanaFeatures: ['Metaplex', 'Token metadata'], whyNow: 'Active NFT market needs better price discovery tools.', targetUser: 'NFT traders and collectors on Solana.' },
        { title: 'Collection Analytics Dashboard', description: 'Deep analytics for NFT collections: holder distribution, wash trading detection, and whale tracking.', techStack: ['Next.js', 'Helius DAS API', 'D3.js'], complexity: 'Medium', impact: 'High', solanaFeatures: ['Digital Asset Standard', 'Compressed NFTs'], whyNow: 'Collectors need transparency to make informed buying decisions.', targetUser: 'NFT collection creators and serious collectors.' },
    ],
    'Developer Tooling': [
        { title: 'GitHub Activity Explorer', description: 'Explore and compare development activity across Solana ecosystem repos with contributor stats.', techStack: ['Next.js', 'GitHub API', 'Recharts'], complexity: 'Low', impact: 'Medium', solanaFeatures: ['Anchor framework', 'Solana SDK'], whyNow: 'Developer activity is a leading indicator of ecosystem health.', targetUser: 'Investors and developers evaluating Solana projects.' },
        { title: 'Transaction Debugger', description: 'Visual debugger for Solana transactions showing instruction flow, CPI calls, and state changes.', techStack: ['Next.js', 'Helius Enhanced API', 'React Flow'], complexity: 'High', impact: 'High', solanaFeatures: ['Transaction introspection', 'CPI tracing'], whyNow: 'Complex transactions with multiple CPIs are hard to debug with existing tools.', targetUser: 'Solana smart contract developers.' },
    ],
};

// ── Build fallback narratives from real signals ──────────────
function buildFallbackNarratives(signals: Signal[], errorReason: string): { narratives: Narrative[]; signalContexts: Record<string, string> } {
    const now = new Date().toISOString();
    console.warn(`⚠️ Building fallback narratives (reason: ${errorReason})`);

    // Group signals by a narrative-like grouping (source → rough category)
    const categoryMap: Record<string, Signal[]> = {};
    for (const s of signals) {
        // Map source+category to a narrative category
        let cat = 'Infrastructure';
        if (s.source === 'market' || s.source === 'defi-llama' || s.category?.toLowerCase().includes('defi') || s.category?.toLowerCase().includes('tvl')) cat = 'DeFi';
        else if (s.source === 'github') cat = 'Developer Tooling';
        else if (s.category?.toLowerCase().includes('nft') || s.source === 'social') cat = 'NFT & Gaming';
        else if (s.source === 'onchain') cat = 'Infrastructure';

        if (!categoryMap[cat]) categoryMap[cat] = [];
        categoryMap[cat].push(s);
    }

    // Pick top 3 categories with the most signals
    const topCategories = Object.entries(categoryMap)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 3);

    if (topCategories.length === 0) {
        // No signals at all — return a single minimal fallback
        topCategories.push(['DeFi', []]);
    }

    const narratives: Narrative[] = topCategories.map(([cat, catSignals], i) => {
        const topSignals = catSignals.sort((a, b) => b.strength - a.strength).slice(0, 8);
        const avgStrength = topSignals.length > 0
            ? Math.round(topSignals.reduce((sum, s) => sum + s.strength, 0) / topSignals.length)
            : 50;

        // Pick ideas for this category
        const ideas = (FALLBACK_IDEAS[cat] || FALLBACK_IDEAS['DeFi']).map((idea, j) => ({
            ...idea,
            id: `fallback-${i}-idea-${j}`,
            narrativeId: `fallback-${i}`,
            supportingSignalIds: topSignals.slice(0, 3).map(s => s.id),
            signalRelevance: {} as Record<string, string>,
            problemToSolve: '',
            possibleSolution: '',
        }));

        const signalSummary = topSignals.length > 0
            ? topSignals.slice(0, 3).map(s => s.description).join('; ')
            : 'Ecosystem signals detected across multiple sources';

        return {
            id: `fallback-${i}`,
            name: `${cat} Activity Detected`,
            slug: `fallback-${cat.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            category: cat as any,
            confidence: Math.min(75, avgStrength),
            summary: `[AI temporarily unavailable] ${topSignals.length} ${cat.toLowerCase()} signals detected. ${signalSummary}.`,
            explanation: `The AI narrative engine encountered an issue and could not analyze these signals in depth.\n\n**Reason:** ${errorReason}\n\nHowever, ${topSignals.length} live signals were collected for the ${cat} category. Press Detect again to retry AI analysis, or explore the signals and ideas below.`,
            signals: topSignals,
            signalStrength: avgStrength,
            ideas,
            detectedAt: now,
            updatedAt: now,
            trend: 'stable' as const,
        };
    });

    return { narratives, signalContexts: {} };
}
