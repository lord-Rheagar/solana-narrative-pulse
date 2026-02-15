// ============================================================
// Solana Narrative Pulse — Configuration
// ============================================================

export const CONFIG = {
    // CoinGecko
    coingecko: {
        baseUrl: process.env.COINGECKO_BASE_URL || 'https://api.coingecko.com/api/v3',
        network: 'solana',
    },

    // GitHub orgs/repos to track for Solana ecosystem activity
    github: {
        baseUrl: 'https://api.github.com',
        token: process.env.GITHUB_TOKEN || '',
        trackedOrgs: [
            'solana-labs',
            'solana-foundation',
            'jito-foundation',
            'marinade-finance',
            'jup-ag',
            'helium',
            'orca-so',
            'raydium-io',
            'drift-labs',
            'metaplex-foundation',
            'pyth-network',
            'squads-protocol',
            'tensor-hq',
        ],
    },

    // Key Solana token addresses for tracking
    trackedTokens: [
        { symbol: 'SOL', coingeckoId: 'solana' },
        { symbol: 'JTO', coingeckoId: 'jito-governance-token' },
        { symbol: 'JUP', coingeckoId: 'jupiter-exchange-solana' },
        { symbol: 'PYTH', coingeckoId: 'pyth-network' },
        { symbol: 'RAY', coingeckoId: 'raydium' },
        { symbol: 'ORCA', coingeckoId: 'orca' },
        { symbol: 'MNDE', coingeckoId: 'marinade' },
        { symbol: 'HNT', coingeckoId: 'helium' },
        { symbol: 'MOBILE', coingeckoId: 'helium-mobile' },
        { symbol: 'BONK', coingeckoId: 'bonk' },
        { symbol: 'WIF', coingeckoId: 'dogwifcoin' },
        { symbol: 'RENDER', coingeckoId: 'render-token' },
        { symbol: 'W', coingeckoId: 'wormhole' },
        { symbol: 'TENSOR', coingeckoId: 'tensor' },
    ],

    // Narrative categories to detect
    narrativeCategories: [
        'DeFi', 'DePIN', 'AI & ML', 'Gaming', 'NFTs',
        'Infrastructure', 'Payments', 'Social', 'Memecoins',
        'RWA', 'Privacy', 'Other',
    ],

    // Superteam
    superteam: {
        baseUrl: process.env.SUPERTEAM_BASE_URL || 'https://superteam.fun',
        agentName: 'solana-narrative-pulse',
        agentVersion: 'earn-agent-mvp',
    },

    // LLM
    openai: {
        model: 'gpt-4o',
        maxTokens: 4000,
    },
} as const;
