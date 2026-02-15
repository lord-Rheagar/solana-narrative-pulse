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
const MAX_SIGNALS_FOR_AI = 50;
const MIN_PER_SOURCE = 3;
const MAX_CLUSTERS = 25;

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
        return getDefaultNarratives();
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

    // Build context for LLM — include delta, tokens, projects, and fullText for cross-source matching
    const signalContext = selectedSignals.map(s => {
        const parts = [`[${s.id}] (${s.source}/${s.category}) ${s.description}`];
        if (s.delta !== undefined) parts.push(`delta: ${s.delta > 0 ? '+' : ''}${s.delta.toFixed(1)}%`);
        if (s.value !== undefined) parts.push(`value: ${s.value.toLocaleString()}`);
        if (s.relatedTokens?.length) parts.push(`tokens: ${s.relatedTokens.join(',')}`);
        if (s.relatedProjects?.length) parts.push(`projects: ${s.relatedProjects.join(',')}`);
        if (s.fullText) parts.push(`context: ${s.fullText.slice(0, 200)}`);
        parts.push(`[strength: ${s.strength}]`);
        return parts.join(' | ');
    }).join('\n');

    const clusterContext = clusterSummaries.map(c =>
        `Cluster "${c.cluster}" (strength: ${c.strength.toFixed(0)}):\n${c.signals.map(s => `  - [${s.id}] ${s.description}`).join('\n')}`
    ).join('\n\n');

    const userMessage = `## Raw Signals (${selectedSignals.length} signals, diversity-selected across ${sourceCounts.size} sources)\n${signalContext}\n\n## Signal Clusters (${clusterSummaries.length} clusters)\n${clusterContext}\n\nRespond with a JSON object containing a "narratives" array and a "topSignalInsights" map. IMPORTANT: topSignalInsights MUST have an entry for EVERY signal ID listed above — all ${selectedSignals.length} of them.`;

    try {
        // Route to REASONING model (o3-mini) for deep pattern analysis
        const response = await routeToModel('reasoning', [
            { role: 'system', content: NARRATIVE_DETECTION_PROMPT },
            { role: 'user', content: userMessage },
        ], {
            jsonMode: true,
            maxTokens: 12000,
            temperature: 0.3,
        });

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
            parsed = JSON.parse(retryContent); // If this also throws, outer catch handles it
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

        // Generate ideas using WRITING model (Claude Sonnet / GPT-4o-mini)
        const narrativesWithIdeas = await Promise.all(
            narratives.map(async (narrative) => {
                try {
                    const ideas = await generateIdeasForNarrative(narrative, previousIdeaTitles);
                    return { ...narrative, ideas };
                } catch (err) {
                    console.error(`Idea generation failed for ${narrative.name}:`, err);
                    return narrative;
                }
            })
        );

        return { narratives: narrativesWithIdeas, signalContexts: globalContexts };
    } catch (err) {
        console.error('Narrative detection failed:', err);
        return getDefaultNarratives();
    }
}

// ── Fallback narratives when API fails ───────────────────────
function getDefaultNarratives(): { narratives: Narrative[]; signalContexts: Record<string, string> } {
    const now = new Date().toISOString();
    return {
        narratives: [
            {
                id: 'default-1',
                name: 'Solana DeFi Renaissance',
                slug: 'solana-defi-renaissance',
                category: 'DeFi',
                confidence: 70,
                summary: 'DeFi protocols on Solana are seeing renewed TVL growth and developer activity.',
                explanation: 'The Solana DeFi ecosystem continues to mature with established protocols like Jupiter, Raydium, and Orca seeing increased trading volumes. New innovations in liquid staking (via Sanctum and Marinade) and perpetual trading (via Drift) are attracting both capital and developers.\n\nThis narrative is supported by consistent developer activity across major DeFi protocols on GitHub, combined with positive price action in governance tokens like JUP, RAY, and ORCA.',
                signals: [],
                signalStrength: 65,
                ideas: [
                    {
                        id: 'idea-1', title: 'DeFi Portfolio Tracker', description: 'Track and visualize positions across all Solana DeFi protocols in one dashboard.',
                        techStack: ['Next.js', 'Helius API', 'Recharts'], complexity: 'Low', impact: 'Medium',
                        narrativeId: 'default-1', solanaFeatures: ['Token accounts', 'DeFi composability'],
                        supportingSignalIds: [], signalRelevance: {},
                        whyNow: 'Growing DeFi TVL on Solana creates demand for unified position tracking.',
                        targetUser: 'DeFi users managing positions across multiple Solana protocols.',
                        problemToSolve: '',
                        possibleSolution: '',
                    },
                ],
                detectedAt: now,
                updatedAt: now,
                trend: 'rising',
            },
        ],
        signalContexts: {}
    };
}
