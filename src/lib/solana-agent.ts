// ============================================================
// Solana Narrative Pulse — Solana Agent Kit Integration
// ============================================================
// Uses @solana-agent-kit/plugin-misc for enhanced Solana data

import { SolanaAgentKit, KeypairWallet } from 'solana-agent-kit';
import MiscPlugin from '@solana-agent-kit/plugin-misc';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { Signal, CollectorResult } from '@/lib/types';

let agentInstance: SolanaAgentKit | null = null;

// ── Initialize the agent kit (lazy singleton) ────────────────
function getAgent(): SolanaAgentKit {
    if (agentInstance) return agentInstance;

    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

    // Build a KeypairWallet — use env key or generate throwaway (read-only ops)
    let keypair: Keypair;
    if (process.env.SOLANA_PRIVATE_KEY) {
        keypair = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY));
    } else {
        keypair = Keypair.generate();
    }
    const wallet = new KeypairWallet(keypair, rpcUrl);

    agentInstance = new SolanaAgentKit(
        wallet,
        rpcUrl,
        {
            OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        }
    );

    // Register the misc plugin for additional tools
    // Cast through `any` to bypass duplicate type declaration between
    // plugin-misc's bundled solana-agent-kit and the top-level package
    agentInstance.use(MiscPlugin as any);

    return agentInstance;
}

// ── Fetch trending tokens via agent kit ──────────────────────
export async function getAgentTrendingTokens(): Promise<any[]> {
    try {
        const agent = getAgent();
        // Use the plugin's get_trending_tokens tool
        const result = await (agent as any).methods.getTrendingTokens();
        return Array.isArray(result) ? result : [];
    } catch (err) {
        console.error('Agent kit trending tokens error:', err);
        return [];
    }
}

// ── Fetch token price via agent kit ──────────────────────────
export async function getAgentTokenPrice(tokenId: string): Promise<any> {
    try {
        const agent = getAgent();
        const result = await (agent as any).methods.fetchPrice(tokenId);
        return result;
    } catch (err) {
        console.error(`Agent kit price fetch error for ${tokenId}:`, err);
        return null;
    }
}

// ── Collect signals via Solana Agent Kit ─────────────────────
export async function collectAgentKitSignals(): Promise<CollectorResult<Signal[]>> {
    const signals: Signal[] = [];
    const collectedAt = new Date().toISOString();

    try {
        // Trending tokens from agent kit
        const trending = await getAgentTrendingTokens();

        trending.slice(0, 10).forEach((token: any, i: number) => {
            signals.push({
                id: `agentkit-trending-${token.symbol || token.name || i}`,
                source: 'market',
                category: 'Agent Kit Trending',
                metric: 'trending_rank',
                value: i + 1,
                delta: token.price_change_24h || 0,
                description: `[Agent Kit] ${token.name || 'Unknown'} (${token.symbol || '?'}) trending on Solana — rank #${i + 1}`,
                relatedTokens: [token.symbol || ''].filter(Boolean),
                relatedProjects: [],
                timestamp: collectedAt,
                strength: Math.min(100, 70 - i * 5),
            });
        });
    } catch (err) {
        console.error('Agent kit signal collection error:', err);
    }

    return { data: signals, source: 'solana-agent-kit', collectedAt };
}

// ── Export agent reference for other uses ─────────────────────
export function getSolanaAgent(): SolanaAgentKit {
    return getAgent();
}
