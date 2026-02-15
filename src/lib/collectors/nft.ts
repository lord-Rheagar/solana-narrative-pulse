// ============================================================
// Solana Narrative Pulse — NFT Collection Activity Collector
// ============================================================
// Uses Magic Eden API (free, no key for basic endpoints)
// to track trending collections, volume, and floor prices.

import { Signal, CollectorResult } from '@/lib/types';

const ME_API = 'https://api-mainnet.magiceden.dev/v2';

interface MECollection {
    symbol: string;
    name: string;
    image?: string;
    floorPrice?: number;    // in lamports
    listedCount?: number;
    volumeAll?: number;     // in lamports
    volume24hr?: number;
}

// ── 1. Trending / Popular collections ───────────────────────
async function getTrendingCollections(): Promise<Signal[]> {
    const signals: Signal[] = [];
    const now = new Date().toISOString();

    try {
        const res = await fetch(`${ME_API}/marketplace/popular_collections?timeRange=1d&limit=10`, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) throw new Error(`Magic Eden popular: ${res.status}`);

        const collections: MECollection[] = await res.json();

        collections.forEach((col, i) => {
            const floorSOL = col.floorPrice ? (col.floorPrice / 1e9) : 0;
            const vol24hSOL = col.volume24hr ? (col.volume24hr / 1e9) : 0;
            const volAllSOL = col.volumeAll ? (col.volumeAll / 1e9) : 0;

            if (vol24hSOL < 1 && floorSOL < 0.5) return; // Skip dust

            const floorStr = floorSOL > 0 ? `${floorSOL.toFixed(2)} SOL floor` : '';
            const volStr = vol24hSOL > 0
                ? `${vol24hSOL > 1000 ? `${(vol24hSOL / 1000).toFixed(1)}K` : vol24hSOL.toFixed(0)} SOL 24h vol`
                : '';

            signals.push({
                id: `nft-trending-${col.symbol}`,
                source: 'market',
                category: 'NFT Collection',
                metric: 'nft_volume_24h',
                value: Math.round(vol24hSOL * 100) / 100,
                delta: 0,
                description: `🎨 ${col.name} — #${i + 1} trending • ${[floorStr, volStr, col.listedCount ? `${col.listedCount} listed` : ''].filter(Boolean).join(' • ')}`,
                relatedTokens: ['SOL'],
                relatedProjects: [col.name],
                timestamp: now,
                strength: Math.min(85, 45 + (10 - i) * 3 + Math.log10(vol24hSOL + 1) * 10),
                sourceUrl: `https://magiceden.io/marketplace/${col.symbol}`,
            });
        });
    } catch (err) {
        console.error('Magic Eden trending error:', err);
    }

    return signals;
}

// ── 2. Collection stats for top Solana NFTs ─────────────────
async function getCollectionStats(): Promise<Signal[]> {
    const signals: Signal[] = [];
    const now = new Date().toISOString();

    const TOP_COLLECTIONS = [
        { symbol: 'mad_lads', name: 'Mad Lads' },
        { symbol: 'tensorians', name: 'Tensorians' },
        { symbol: 'claynosaurz', name: 'Claynosaurz' },
        { symbol: 'famous_fox_federation', name: 'Famous Fox Federation' },
        { symbol: 'degods', name: 'DeGods' },
    ];

    for (const col of TOP_COLLECTIONS) {
        try {
            const res = await fetch(`${ME_API}/collections/${col.symbol}/stats`, {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(5000),
            });

            if (!res.ok) continue;
            const stats: any = await res.json();

            const floorSOL = stats.floorPrice ? (stats.floorPrice / 1e9) : 0;
            const listedCount = stats.listedCount || 0;
            const vol24hSOL = stats.volume24hr ? (stats.volume24hr / 1e9) : 0;

            if (floorSOL === 0) continue;

            signals.push({
                id: `nft-stats-${col.symbol}`,
                source: 'market',
                category: 'NFT Floor Price',
                metric: 'nft_floor_price',
                value: Math.round(floorSOL * 100) / 100,
                delta: 0,
                description: `🖼️ ${col.name} — ${floorSOL.toFixed(2)} SOL floor • ${listedCount} listed${vol24hSOL > 0 ? ` • ${vol24hSOL.toFixed(0)} SOL 24h vol` : ''}`,
                relatedTokens: ['SOL'],
                relatedProjects: [col.name],
                timestamp: now,
                strength: Math.min(70, 35 + Math.log10(floorSOL + 1) * 15 + Math.log10(vol24hSOL + 1) * 5),
                sourceUrl: `https://magiceden.io/marketplace/${col.symbol}`,
            });
        } catch (err) {
            console.error(`NFT stats error for ${col.name}:`, err);
        }
        await new Promise(r => setTimeout(r, 200)); // Rate limit
    }

    return signals;
}

// ── Main collector ───────────────────────────────────────────
export async function collectNftSignals(): Promise<CollectorResult<Signal[]>> {
    const collectedAt = new Date().toISOString();

    const results = await Promise.allSettled([
        getTrendingCollections(),
        getCollectionStats(),
    ]);

    const signals: Signal[] = [];
    results.forEach(r => {
        if (r.status === 'fulfilled') signals.push(...r.value);
    });

    // Deduplicate: if same collection appears in trending and stats, keep trending
    const seen = new Set<string>();
    const deduped: Signal[] = [];
    for (const s of signals) {
        const key = s.relatedProjects[0]?.toLowerCase() || s.id;
        if (!seen.has(key)) {
            seen.add(key);
            deduped.push(s);
        }
    }

    deduped.sort((a, b) => b.strength - a.strength);
    return { data: deduped, source: 'nft', collectedAt };
}
