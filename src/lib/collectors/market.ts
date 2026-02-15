// ============================================================
// Solana Narrative Pulse — CoinGecko Market Data Collector
// ============================================================

import { CONFIG } from '@/lib/config';
import { Signal, TrendingToken, TrendingPool, CollectorResult } from '@/lib/types';

const BASE = CONFIG.coingecko.baseUrl;

async function fetchJSON(url: string) {
    const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 300 }, // cache for 5 min
    });
    if (!res.ok) throw new Error(`CoinGecko API error: ${res.status} ${res.statusText}`);
    return res.json();
}

// ── Trending Tokens ──────────────────────────────────────────
export async function getTrendingTokens(): Promise<TrendingToken[]> {
    try {
        const data = await fetchJSON(`${BASE}/search/trending`);
        const coins = data.coins || [];
        return coins.slice(0, 15).map((c: any) => ({
            id: c.item?.id || '',
            name: c.item?.name || '',
            symbol: c.item?.symbol || '',
            price_usd: c.item?.data?.price || 0,
            price_change_24h: c.item?.data?.price_change_percentage_24h?.usd || 0,
            volume_24h: c.item?.data?.total_volume?.usd || 0,
            market_cap: c.item?.data?.market_cap?.usd || 0,
        }));
    } catch (err) {
        console.error('Error fetching trending tokens:', err);
        return [];
    }
}

// ── Solana Ecosystem Token Prices ────────────────────────────
export async function getSolanaTokenPrices(): Promise<Record<string, any>> {
    try {
        const ids = CONFIG.trackedTokens.map(t => t.coingeckoId).join(',');
        const data = await fetchJSON(
            `${BASE}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true&include_market_cap=true`
        );
        return data;
    } catch (err) {
        console.error('Error fetching Solana token prices:', err);
        return {};
    }
}

// ── Category-level market data ───────────────────────────────
export async function getCategoryData(): Promise<any[]> {
    try {
        const data = await fetchJSON(`${BASE}/coins/categories?order=market_cap_change_24h_desc`);
        // Filter for Solana-relevant categories
        const relevant = (data || []).filter((cat: any) =>
            /solana|defi|depin|gaming|nft|layer|meme|ai|infra|real.world/i.test(cat.name)
        );
        return relevant.slice(0, 10);
    } catch (err) {
        console.error('Error fetching categories:', err);
        return [];
    }
}

// ── Transform market data into Signals ───────────────────────
export async function collectMarketSignals(): Promise<CollectorResult<Signal[]>> {
    const signals: Signal[] = [];
    const collectedAt = new Date().toISOString();

    try {
        // 1. Trending tokens → signals
        const trending = await getTrendingTokens();
        trending.forEach((token, i) => {
            signals.push({
                id: `market-trending-${token.id}`,
                source: 'market',
                category: 'Trending Token',
                metric: 'trending_rank',
                value: i + 1,
                delta: token.price_change_24h,
                description: `${token.name} (${token.symbol}) is trending #${i + 1} — price ${token.price_change_24h > 0 ? '+' : ''}${token.price_change_24h.toFixed(1)}% 24h`,
                relatedTokens: [token.symbol],
                relatedProjects: [],
                timestamp: collectedAt,
                strength: Math.min(100, Math.max(0, 80 - i * 5 + Math.abs(token.price_change_24h))),
                sourceUrl: `https://www.coingecko.com/en/coins/${token.id}`,
                fullText: `${token.name} (${token.symbol}) trending rank #${i + 1}. Price: $${token.price_usd?.toFixed?.(6) || '?'}, 24h change: ${token.price_change_24h > 0 ? '+' : ''}${token.price_change_24h.toFixed(1)}%. Market cap: $${token.market_cap ? (token.market_cap / 1e6).toFixed(1) + 'M' : '?'}. 24h volume: $${token.volume_24h ? (token.volume_24h / 1e6).toFixed(1) + 'M' : '?'}.`,
            });
        });

        // 2. Solana token price movements → signals  
        const prices = await getSolanaTokenPrices();
        for (const token of CONFIG.trackedTokens) {
            const data = prices[token.coingeckoId];
            if (!data) continue;
            const change = data.usd_24h_change || 0;
            if (Math.abs(change) > 5) {
                signals.push({
                    id: `market-price-${token.symbol}`,
                    source: 'market',
                    category: 'Price Movement',
                    metric: 'price_change_24h',
                    value: data.usd || 0,
                    delta: change,
                    description: `${token.symbol} ${change > 0 ? 'surged' : 'dropped'} ${change > 0 ? '+' : ''}${change.toFixed(1)}% in 24h (now $${data.usd?.toFixed(4)})`,
                    relatedTokens: [token.symbol],
                    relatedProjects: [],
                    timestamp: collectedAt,
                    strength: Math.min(100, Math.abs(change) * 3),
                    sourceUrl: `https://www.coingecko.com/en/coins/${token.coingeckoId}`,
                });
            }
        }

        // 3. Category trends → signals
        const categories = await getCategoryData();
        categories.forEach((cat: any) => {
            const change = cat.market_cap_change_24h || 0;
            if (Math.abs(change) > 3) {
                const mcapM = cat.market_cap ? (cat.market_cap / 1e6).toFixed(0) : '?';
                const volumeM = cat.total_volume ? (cat.total_volume / 1e6).toFixed(0) : '?';
                signals.push({
                    id: `market-category-${cat.id}`,
                    source: 'market',
                    category: 'Category Trend',
                    metric: 'category_market_cap_change',
                    value: cat.market_cap || 0,
                    delta: change,
                    description: `"${cat.name}" category ${change > 0 ? 'growing' : 'shrinking'} ${change > 0 ? '+' : ''}${change.toFixed(1)}% market cap 24h`,
                    relatedTokens: [],
                    relatedProjects: [],
                    timestamp: collectedAt,
                    strength: Math.min(100, Math.abs(change) * 4),
                    sourceUrl: `https://www.coingecko.com/en/categories/${cat.id}`,
                    fullText: `"${cat.name}" category: market cap $${mcapM}M (${change > 0 ? '+' : ''}${change.toFixed(1)}% 24h), 24h volume $${volumeM}M. ${cat.content || ''}`.trim(),
                });
            }
        });
    } catch (err) {
        console.error('Market signal collection error:', err);
    }

    return { data: signals, source: 'coingecko', collectedAt };
}
