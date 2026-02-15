// ============================================================
// Solana Narrative Pulse — DEX Volume & Trending Collector
// ============================================================
// Uses DexScreener API (free, no key) to track:
// - Top boosted tokens on Solana
// - New pairs created recently
// - High-volume pairs

import { Signal, CollectorResult } from '@/lib/types';

const DEXSCREENER_BASE = 'https://api.dexscreener.com';

interface DexPair {
    chainId: string;
    dexId: string;
    pairAddress: string;
    baseToken: { address: string; name: string; symbol: string };
    quoteToken: { address: string; name: string; symbol: string };
    priceUsd: string;
    priceChange: { h24?: number; h6?: number; h1?: number };
    volume: { h24?: number; h6?: number; h1?: number };
    liquidity?: { usd?: number };
    pairCreatedAt?: number;
    txns?: { h24?: { buys: number; sells: number } };
    url?: string;
}

// ── 1. Top Solana pairs by volume ────────────────────────────
async function getTopPairs(): Promise<Signal[]> {
    const signals: Signal[] = [];
    const now = new Date().toISOString();

    try {
        const res = await fetch(`${DEXSCREENER_BASE}/token-profiles/latest/v1`, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) throw new Error(`DexScreener profiles: ${res.status}`);

        const profiles: any[] = await res.json();
        const solanaProfiles = profiles
            .filter((p: any) => p.chainId === 'solana')
            .slice(0, 8);

        for (const profile of solanaProfiles) {
            try {
                // Fetch actual pair data for this token
                const pairRes = await fetch(
                    `${DEXSCREENER_BASE}/tokens/v1/solana/${profile.tokenAddress}`,
                    { signal: AbortSignal.timeout(5000) }
                );
                if (!pairRes.ok) continue;

                const pairs: DexPair[] = await pairRes.json();
                if (!pairs?.length) continue;

                const topPair = pairs[0];
                const vol24h = topPair.volume?.h24 || 0;
                const priceChange = topPair.priceChange?.h24 || 0;

                if (vol24h < 50000) continue; // Skip low-volume noise

                const volStr = vol24h > 1e6
                    ? `$${(vol24h / 1e6).toFixed(1)}M`
                    : `$${(vol24h / 1e3).toFixed(0)}K`;

                signals.push({
                    id: `dex-trending-${topPair.baseToken.symbol.toLowerCase()}-${topPair.pairAddress.slice(0, 6)}`,
                    source: 'market',
                    category: 'DEX Trending',
                    metric: 'dex_volume_24h',
                    value: Math.round(vol24h),
                    delta: priceChange,
                    description: `📊 ${topPair.baseToken.name} (${topPair.baseToken.symbol}) — ${volStr} vol 24h • ${priceChange > 0 ? '+' : ''}${priceChange.toFixed(1)}% • ${topPair.dexId}`,
                    relatedTokens: [topPair.baseToken.symbol],
                    relatedProjects: [topPair.dexId],
                    timestamp: now,
                    strength: Math.min(90, 40 + Math.log10(vol24h + 1) * 8 + Math.abs(priceChange) / 2),
                    sourceUrl: topPair.url || `https://dexscreener.com/solana/${topPair.pairAddress}`,
                });
            } catch {
                // Skip individual pair errors
            }
            await new Promise(r => setTimeout(r, 200)); // Rate limiting
        }
    } catch (err) {
        console.error('DexScreener top pairs error:', err);
    }

    return signals;
}

// ── 2. Boosted tokens (trending on DexScreener) ─────────────
async function getBoostedTokens(): Promise<Signal[]> {
    const signals: Signal[] = [];
    const now = new Date().toISOString();

    try {
        const res = await fetch(`${DEXSCREENER_BASE}/token-boosts/top/v1`, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) throw new Error(`DexScreener boosts: ${res.status}`);

        const boosts: any[] = await res.json();
        const solanaBoosted = boosts
            .filter((b: any) => b.chainId === 'solana')
            .slice(0, 5);

        for (const boost of solanaBoosted) {
            const amount = boost.totalAmount || boost.amount || 0;
            signals.push({
                id: `dex-boosted-${boost.tokenAddress?.slice(0, 8) || signals.length}`,
                source: 'market',
                category: 'DEX Boosted',
                metric: 'boost_amount',
                value: amount,
                delta: 0,
                description: `🚀 Boosted on DexScreener: ${boost.description || boost.tokenAddress?.slice(0, 12) + '...'} — ${amount > 0 ? `${amount} boosts` : 'active boost'}`,
                relatedTokens: [],
                relatedProjects: [],
                timestamp: now,
                strength: Math.min(75, 40 + amount * 2),
                sourceUrl: boost.url || `https://dexscreener.com/solana/${boost.tokenAddress}`,
            });
        }
    } catch (err) {
        console.error('DexScreener boosts error:', err);
    }

    return signals;
}

// ── 3. New pairs (recently created) ──────────────────────────
async function getNewPairs(): Promise<Signal[]> {
    const signals: Signal[] = [];
    const now = new Date().toISOString();

    try {
        const res = await fetch(`${DEXSCREENER_BASE}/latest/dex/pairs/solana`, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) throw new Error(`DexScreener new pairs: ${res.status}`);

        const data = await res.json();
        const pairs: DexPair[] = data.pairs || [];

        // Filter to pairs with meaningful volume
        const meaningful = pairs
            .filter(p => (p.volume?.h24 || 0) > 100000 && (p.liquidity?.usd || 0) > 50000)
            .slice(0, 5);

        meaningful.forEach(pair => {
            const vol = pair.volume?.h24 || 0;
            const liq = pair.liquidity?.usd || 0;
            const volStr = vol > 1e6 ? `$${(vol / 1e6).toFixed(1)}M` : `$${(vol / 1e3).toFixed(0)}K`;
            const liqStr = liq > 1e6 ? `$${(liq / 1e6).toFixed(1)}M` : `$${(liq / 1e3).toFixed(0)}K`;
            const change = pair.priceChange?.h24 || 0;

            signals.push({
                id: `dex-new-pair-${pair.pairAddress.slice(0, 8)}`,
                source: 'market',
                category: 'New Pair',
                metric: 'new_pair_volume',
                value: Math.round(vol),
                delta: change,
                description: `🆕 New pair: ${pair.baseToken.symbol}/${pair.quoteToken.symbol} on ${pair.dexId} — ${volStr} vol • ${liqStr} liq • ${change > 0 ? '+' : ''}${change.toFixed(1)}%`,
                relatedTokens: [pair.baseToken.symbol],
                relatedProjects: [pair.dexId],
                timestamp: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : now,
                strength: Math.min(85, 35 + Math.log10(vol + 1) * 7 + Math.log10(liq + 1) * 3),
                sourceUrl: pair.url || `https://dexscreener.com/solana/${pair.pairAddress}`,
            });
        });
    } catch (err) {
        console.error('DexScreener new pairs error:', err);
    }

    return signals;
}

// ── Main collector ───────────────────────────────────────────
export async function collectDexSignals(): Promise<CollectorResult<Signal[]>> {
    const collectedAt = new Date().toISOString();

    const results = await Promise.allSettled([
        getTopPairs(),
        getBoostedTokens(),
        getNewPairs(),
    ]);

    const signals: Signal[] = [];
    results.forEach(r => {
        if (r.status === 'fulfilled') signals.push(...r.value);
    });

    signals.sort((a, b) => b.strength - a.strength);
    return { data: signals, source: 'dexscreener', collectedAt };
}
