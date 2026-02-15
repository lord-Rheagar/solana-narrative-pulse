// ============================================================
// Solana Narrative Pulse — Idea Generator
// ============================================================
// Uses Claude Sonnet (writing model) for creative idea generation

import { Narrative, BuildIdea, Signal, NarrativeCategory } from '@/lib/types';
import { IDEA_GENERATION_PROMPT, IDEA_CRITIQUE_PROMPT, IDEA_DEEPDIVE_PROMPT } from './prompts';
import { routeToModel } from './model-router';
import { CONFIG } from '@/lib/config';
import { getRecentIdeaTitles } from '@/lib/history';

// ── Category-specific Solana feature mapping ─────────────────
const CATEGORY_SOLANA_FEATURES: Record<NarrativeCategory, string[]> = {
    'DeFi': ['Token extensions', 'Concentrated liquidity (Whirlpools)', 'Flash loans', 'Priority fees', 'Swap hooks', 'Token-2022 transfer hooks'],
    'DePIN': ['Compressed accounts', 'Helium network integration', 'State compression', 'Proof of coverage', 'Oracle feeds (Pyth)'],
    'AI & ML': ['GPU marketplace integration (Render)', 'Oracle integration (Pyth)', 'Compute proofs', 'On-chain inference verification'],
    'Gaming': ['Session keys', 'Ephemeral rollups', 'Clockwork automation', 'Compressed NFTs', 'Token-gated access'],
    'NFTs': ['Compressed NFTs (Bubblegum)', 'Metaplex Core', 'Executable NFTs', 'Royalty enforcement', 'cNFT merkle trees'],
    'Infrastructure': ['Validator client diversity (Firedancer)', 'SVM forks', 'Account compression', 'Lookup tables', 'Versioned transactions'],
    'Payments': ['Token-2022 transfer hooks', 'Confidential transfers', 'Memo program', 'Blinks', 'Solana Pay'],
    'Social': ['Blinks', 'Actions', 'Token-gated access', 'Compressed NFTs for credentials', 'Memo program'],
    'Memecoins': ['Token launch platforms', 'Bonding curves', 'LP locks', 'Community DAOs (SPL Governance)', 'Token-2022 metadata'],
    'RWA': ['Token extensions (transfer hooks, metadata)', 'Confidential transfers', 'SPL Governance', 'Permissioned token mints'],
    'Privacy': ['Confidential transfers', 'ZK compression', 'Encrypted memos', 'Light Protocol'],
    'Other': ['Versioned transactions', 'Priority fees', 'Account compression', 'Token extensions'],
};

// ── Known ecosystem projects (injected as "don't reinvent" context) ──
function buildKnownProjectsContext(): string {
    const tokenProjects = CONFIG.trackedTokens.map(t => {
        const names: Record<string, string> = {
            SOL: 'Solana (L1 blockchain)',
            JTO: 'Jito (MEV & liquid staking)',
            JUP: 'Jupiter (DEX aggregator)',
            PYTH: 'Pyth Network (oracle)',
            RAY: 'Raydium (AMM & DEX)',
            ORCA: 'Orca (concentrated liquidity DEX)',
            MNDE: 'Marinade Finance (liquid staking)',
            HNT: 'Helium (DePIN wireless network)',
            MOBILE: 'Helium Mobile (mobile DePIN)',
            BONK: 'Bonk (memecoin & community token)',
            WIF: 'dogwifhat (memecoin)',
            RENDER: 'Render Network (GPU compute)',
            W: 'Wormhole (cross-chain bridge)',
            TENSOR: 'Tensor (NFT marketplace & AMM)',
        };
        return `- ${names[t.symbol] || t.symbol}`;
    }).join('\n');

    const orgProjects = CONFIG.github.trackedOrgs.map(org => {
        const descriptions: Record<string, string> = {
            'solana-labs': 'Solana Labs (core runtime)',
            'solana-foundation': 'Solana Foundation (ecosystem grants)',
            'jito-foundation': 'Jito (MEV, restaking)',
            'marinade-finance': 'Marinade (mSOL liquid staking)',
            'jup-ag': 'Jupiter (swap aggregation, limit orders, DCA, perps)',
            'helium': 'Helium (IoT & mobile DePIN)',
            'orca-so': 'Orca (Whirlpools concentrated liquidity)',
            'raydium-io': 'Raydium (AMM, AcceleRaytor launchpad)',
            'drift-labs': 'Drift Protocol (perps, spot, borrow/lend)',
            'metaplex-foundation': 'Metaplex (NFT standards, Bubblegum, Core)',
            'pyth-network': 'Pyth (low-latency price feeds)',
            'squads-protocol': 'Squads (multisig, smart account)',
            'tensor-hq': 'Tensor (NFT trading, cNFT support)',
        };
        return `- ${descriptions[org] || org}`;
    }).join('\n');

    return `### Tokens & Protocols\n${tokenProjects}\n\n### Active Development Orgs\n${orgProjects}`;
}

// ── Build category-specific feature context ──────────────────
function getCategoryFeatures(category: NarrativeCategory): string {
    const features = CATEGORY_SOLANA_FEATURES[category] || CATEGORY_SOLANA_FEATURES['Other'];
    return features.map(f => `- ${f}`).join('\n');
}

// ── Extract JSON from LLM response (may be wrapped in markdown) ──
function extractJson(content: string): string {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    return match ? match[1] : content;
}

// ── Map raw LLM idea objects to BuildIdea[] ──────────────────
function mapIdeas(ideas: any[], narrativeId: string): BuildIdea[] {
    return ideas.map((idea: any, i: number) => ({
        id: `idea-${narrativeId}-${i}`,
        title: idea.title,
        description: idea.description,
        techStack: idea.techStack || [],
        complexity: idea.complexity || 'Medium',
        impact: idea.impact || 'Medium',
        narrativeId,
        solanaFeatures: idea.solanaFeatures || [],
        supportingSignalIds: idea.supportingSignalIds || [],
        signalRelevance: idea.signalRelevance || {},
        whyNow: idea.whyNow || '',
        targetUser: idea.targetUser || '',
        problemToSolve: idea.problemToSolve || '',
        possibleSolution: idea.possibleSolution || '',
    }));
}

// ── Generate build ideas for a narrative ─────────────────────
export async function generateIdeasForNarrative(narrative: Narrative, clientPreviousTitles?: string[]): Promise<BuildIdea[]> {
    // Build a list of signal IDs so the LLM can reference them
    const signalIdList = narrative.signals
        .map(s => `- [${s.id}] (${s.source}) ${s.description.slice(0, 120)}`)
        .join('\n');

    // Dedup: use client-provided session titles if available, otherwise fall back to global history
    let previousIdeaTitles: string[] = [];
    if (clientPreviousTitles && clientPreviousTitles.length > 0) {
        previousIdeaTitles = clientPreviousTitles;
    } else {
        try {
            const [slugTitles, allTitles] = await Promise.all([
                getRecentIdeaTitles(narrative.slug, 3),
                getRecentIdeaTitles(undefined, 2),
            ]);
            previousIdeaTitles = [...new Set([...slugTitles, ...allTitles])];
        } catch {
            // History unavailable — continue without dedup
        }
    }

    const previousIdeasContext = previousIdeaTitles.length > 0
        ? previousIdeaTitles.map(t => `- ${t}`).join('\n')
        : 'None — this is the first run.';

    const prompt = IDEA_GENERATION_PROMPT
        .replace('{narrative_name}', narrative.name)
        .replace('{narrative_explanation}', narrative.explanation)
        .replace('{signal_ids}', signalIdList || 'No signals available')
        .replace('{known_projects}', buildKnownProjectsContext())
        .replace('{category_features}', getCategoryFeatures(narrative.category))
        .replace('{previous_ideas}', previousIdeasContext);

    try {
        // Build supporting evidence from ALL signals linked to this narrative
        const signalEvidence = narrative.signals.map(s => {
            const parts = [`- (${s.source}) ${s.description}`];
            if (s.delta !== undefined) parts.push(`(${s.delta > 0 ? '+' : ''}${s.delta.toFixed(1)}%)`);
            if (s.relatedTokens?.length) parts.push(`[${s.relatedTokens.join(', ')}]`);
            if (s.aiContext) parts.push(`— ${s.aiContext}`);
            return parts.join(' ');
        }).join('\n');

        const evidenceBlock = signalEvidence
            ? `\n\nSupporting evidence:\n${signalEvidence}`
            : '';

        // ── Pass 1: Generate ideas via WRITING model ─────────────
        const response = await routeToModel('writing', [
            { role: 'system', content: prompt },
            {
                role: 'user',
                content: `Generate build ideas for the "${narrative.name}" narrative.\n\nCategory: ${narrative.category}\nConfidence: ${narrative.confidence}%\nTrend: ${narrative.trend}\n\nContext: ${narrative.summary}${evidenceBlock}\n\nRespond with a JSON object containing an "ideas" array.`,
            },
        ], {
            jsonMode: true,
            maxTokens: 3500,
            temperature: 0.65,
        });

        console.log(`✍️ Ideas generated via ${response.provider}/${response.model} for "${narrative.name}"`);

        const parsed = JSON.parse(extractJson(response.content));
        let ideas = parsed.ideas || [];

        // ── Pass 2: Self-critique and refine ─────────────────────
        try {
            const critiquePrompt = IDEA_CRITIQUE_PROMPT
                .replace('{narrative_name}', narrative.name);

            const critiqueResponse = await routeToModel('writing', [
                { role: 'system', content: critiquePrompt },
                {
                    role: 'user',
                    content: `Review and refine these ideas for the "${narrative.name}" narrative:\n\n${JSON.stringify({ ideas }, null, 2)}\n\nReturn the refined set as a JSON object with an "ideas" array.`,
                },
            ], {
                jsonMode: true,
                maxTokens: 3500,
                temperature: 0.3,
            });

            const critiqueParsed = JSON.parse(extractJson(critiqueResponse.content));
            if (critiqueParsed.ideas?.length > 0) {
                ideas = critiqueParsed.ideas;
                console.log(`🔍 Ideas refined via critique pass for "${narrative.name}"`);
            }
        } catch (critiqueErr) {
            // Critique failed — use original ideas (no regression)
            console.warn(`Critique pass failed for "${narrative.name}", using original ideas:`, critiqueErr);
        }

        return mapIdeas(ideas, narrative.id);
    } catch (err) {
        console.error(`Idea generation failed for "${narrative.name}":`, err);
        // Return a single default idea
        return [{
            id: `idea-${narrative.id}-default`,
            title: `${narrative.name} Explorer`,
            description: `Build a dashboard to track and visualize the ${narrative.name} trend in real-time.`,
            techStack: ['Next.js', 'Helius API', 'Recharts'],
            complexity: 'Low',
            impact: 'Medium',
            narrativeId: narrative.id,
            solanaFeatures: ['RPC', 'Token Accounts'],
            supportingSignalIds: narrative.signals.slice(0, 3).map(s => s.id),
            signalRelevance: {},
            whyNow: `The ${narrative.name} narrative is currently active with ${narrative.signals.length} supporting signals.`,
            targetUser: 'Solana ecosystem participants tracking this trend.',
            problemToSolve: '',
            possibleSolution: '',
        }];
    }
}

// ── On-demand deep-dive for a single idea (called via /api/idea-detail) ──
export async function generateIdeaDeepDive(
    idea: BuildIdea,
    narrative: { name: string; summary: string; signals: Signal[] },
): Promise<{ problemToSolve: string; possibleSolution: string }> {
    const signalEvidence = narrative.signals.map(s => {
        const parts = [`- (${s.source}) ${s.description}`];
        if (s.delta !== undefined) parts.push(`(${s.delta > 0 ? '+' : ''}${s.delta.toFixed(1)}%)`);
        if (s.relatedTokens?.length) parts.push(`[${s.relatedTokens.join(', ')}]`);
        if (s.aiContext) parts.push(`— ${s.aiContext}`);
        return parts.join(' ');
    }).join('\n');

    const prompt = IDEA_DEEPDIVE_PROMPT
        .replace('{narrative_name}', narrative.name)
        .replace('{narrative_summary}', narrative.summary)
        .replace('{signal_evidence}', signalEvidence || 'No signal evidence available');

    const ideaSummary =
        `### Idea: "${idea.title}"\n` +
        `Description: ${idea.description}\n` +
        `Tech Stack: ${idea.techStack.join(', ')}\n` +
        `Why Now: ${idea.whyNow}\n` +
        `Target User: ${idea.targetUser}\n` +
        `Solana Features: ${idea.solanaFeatures.join(', ')}`;

    const response = await routeToModel('writing', [
        { role: 'system', content: prompt },
        {
            role: 'user',
            content: `Write a detailed problem/solution brief for the idea below. Return a JSON object with a "deepDives" array containing one entry.\n\n${ideaSummary}`,
        },
    ], {
        jsonMode: true,
        maxTokens: 2000,
        temperature: 0.5,
    });

    const parsed = JSON.parse(extractJson(response.content));
    const dive = parsed.deepDives?.[0] || parsed;

    console.log(`🔬 Deep-dive generated for "${idea.title}"`);

    return {
        problemToSolve: dive.problemToSolve || '',
        possibleSolution: dive.possibleSolution || '',
    };
}

