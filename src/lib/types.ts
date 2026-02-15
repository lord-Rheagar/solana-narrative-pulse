// ============================================================
// Solana Narrative Pulse — Core Type Definitions
// ============================================================

export interface Signal {
    id: string;
    source: 'onchain' | 'github' | 'market' | 'social' | 'defi-llama' | 'governance';
    category: string;
    metric: string;
    value: number;
    delta: number;        // % change
    description: string;
    relatedTokens: string[];
    relatedProjects: string[];
    timestamp: string;
    strength: number;     // 0-100 normalized score
    aiContext?: string;   // Specific insight: "Inflow likely driven by new 30% APY incentive..."
    sourceUrl?: string;   // Direct link to source (tweet URL, DeFi Llama page, GitHub repo, etc.)
    fullText?: string;    // Full untruncated content (for tweets, RSS summaries, etc.)
}

export interface Narrative {
    id: string;
    name: string;
    slug: string;
    category: NarrativeCategory;
    confidence: number;   // 0-100
    summary: string;
    explanation: string;
    signals: Signal[];
    signalStrength: number;
    ideas: BuildIdea[];
    detectedAt: string;
    updatedAt: string;
    trend: 'rising' | 'stable' | 'declining';
    recommendation?: {
        thesis: string;
        actionables: string[];
        risks: string[];
    };
}

export type NarrativeCategory =
    | 'DeFi'
    | 'DePIN'
    | 'AI & ML'
    | 'Gaming'
    | 'NFTs'
    | 'Infrastructure'
    | 'Payments'
    | 'Social'
    | 'Memecoins'
    | 'RWA'
    | 'Privacy'
    | 'Other';

export interface BuildIdea {
    id: string;
    title: string;
    description: string;
    techStack: string[];
    complexity: 'Low' | 'Medium' | 'High';
    impact: 'Low' | 'Medium' | 'High';
    narrativeId: string;
    solanaFeatures: string[];
    supportingSignalIds: string[];
    signalRelevance: Record<string, string>;
    whyNow: string;
    targetUser: string;
    problemToSolve?: string;
    possibleSolution?: string;
}

export interface TrendingToken {
    id: string;
    name: string;
    symbol: string;
    address?: string;
    price_usd: number;
    price_change_24h: number;
    volume_24h: number;
    market_cap: number;
    fdv?: number;
}

export interface TrendingPool {
    name: string;
    address: string;
    dex: string;
    base_token: string;
    quote_token: string;
    price_usd: string;
    volume_24h: string;
    price_change_24h: string;
    pool_created_at: string;
    reserve_usd: string;
}

export interface GitHubRepoActivity {
    org: string;
    repo: string;
    fullName: string;
    stars: number;
    forks: number;
    openIssues: number;
    recentCommits: number;
    lastPush: string;
    description: string;
    language: string;
    topics: string[];
}

export interface CollectorResult<T> {
    data: T;
    source: string;
    collectedAt: string;
    error?: string;
}

export interface AgentHeartbeat {
    status: 'ok' | 'degraded' | 'blocked';
    agentName: string;
    time: string;
    version: string;
    capabilities: string[];
    lastAction: string;
    nextAction: string;
}

export interface NarrativeDetectionResult {
    narratives: Narrative[];
    signals: Signal[];
    collectedAt: string;
    processingTime: number;
}
