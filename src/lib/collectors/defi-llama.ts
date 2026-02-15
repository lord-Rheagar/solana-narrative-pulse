// ============================================================
// Solana Narrative Pulse — DeFi Llama TVL & Protocol Collector
// ============================================================
// Free API — no key needed. Tracks TVL changes across
// Solana protocols to detect capital flow narratives.

import { Signal, CollectorResult } from '@/lib/types';

const DEFI_LLAMA_BASE = 'https://api.llama.fi';

interface LlamaProtocol {
    name: string;
    slug: string;
    chains: string[];
    tvl: number;
    change_1d: number | null;
    change_7d: number | null;
    category: string;
    chainTvls?: Record<string, number>;
}

// ── 1. Solana ecosystem TVL ──────────────────────────────────
async function getSolanaTVL(): Promise<Signal[]> {
    const signals: Signal[] = [];
    const now = new Date().toISOString();

    try {
        const res = await fetch(`${DEFI_LLAMA_BASE}/v2/chains`, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`DefiLlama chains: ${res.status}`);

        const chains: any[] = await res.json();
        const solana = chains.find((c: any) => c.name === 'Solana' || c.gecko_id === 'solana');

        if (solana) {
            const tvlBillions = (solana.tvl / 1e9).toFixed(2);
            signals.push({
                id: 'defi-llama-solana-tvl',
                source: 'defi-llama',
                category: 'DeFi TVL',
                metric: 'total_tvl',
                value: Math.round(solana.tvl),
                delta: 0,
                description: `Solana ecosystem TVL: $${tvlBillions}B across all protocols`,
                relatedTokens: ['SOL'],
                relatedProjects: ['solana'],
                timestamp: now,
                strength: solana.tvl > 5e9 ? 70 : solana.tvl > 2e9 ? 55 : 40,
                sourceUrl: 'https://defillama.com/chain/Solana',
            });
        }
    } catch (err) {
        console.error('DefiLlama chains error:', err);
    }

    return signals;
}

// ── 2. Top Solana protocols by TVL + movers ──────────────────
async function getTopProtocols(): Promise<Signal[]> {
    const signals: Signal[] = [];
    const now = new Date().toISOString();

    try {
        const res = await fetch(`${DEFI_LLAMA_BASE}/protocols`, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) throw new Error(`DefiLlama protocols: ${res.status}`);

        const allProtos: LlamaProtocol[] = await res.json();

        // Filter to Solana protocols with meaningful TVL
        const solanaProtos = allProtos
            .filter(p => p.chains?.includes('Solana') && (p.chainTvls?.Solana ?? p.tvl) > 1_000_000)
            .map(p => ({
                ...p,
                solanaTvl: p.chainTvls?.Solana ?? p.tvl,
            }))
            .sort((a, b) => b.solanaTvl - a.solanaTvl);

        // Top 10 by TVL
        solanaProtos.slice(0, 10).forEach((proto, i) => {
            const tvlM = (proto.solanaTvl / 1e6).toFixed(1);
            const delta1d = proto.change_1d ?? 0;
            const delta7d = proto.change_7d ?? 0;
            const isSurging = delta1d > 10 || delta7d > 25;
            const isDeclining = delta1d < -10 || delta7d < -20;

            signals.push({
                id: `defi-llama-protocol-${proto.slug}`,
                source: 'defi-llama',
                category: 'DeFi Protocol',
                metric: 'tvl',
                value: Math.round(proto.solanaTvl),
                delta: delta1d,
                description: `${proto.name} [${proto.category}] — $${tvlM}M TVL${delta1d ? ` (1d: ${delta1d > 0 ? '+' : ''}${delta1d.toFixed(1)}%)` : ''}${delta7d ? ` (7d: ${delta7d > 0 ? '+' : ''}${delta7d.toFixed(1)}%)` : ''}${isSurging ? ' 📈 SURGING' : ''}${isDeclining ? ' 📉 DECLINING' : ''}`,
                relatedTokens: [],
                relatedProjects: [proto.name],
                timestamp: now,
                strength: isSurging ? 85 : isDeclining ? 60 : Math.min(75, 50 + (10 - i) * 3),
                sourceUrl: `https://defillama.com/protocol/${proto.slug}`,
                fullText: `${proto.name} is a ${proto.category} protocol on Solana with $${tvlM}M TVL. 1-day change: ${delta1d > 0 ? '+' : ''}${delta1d.toFixed(1)}%, 7-day change: ${delta7d > 0 ? '+' : ''}${delta7d.toFixed(1)}%. Ranked #${i + 1} on Solana by TVL.`,
            });
        });

        // Biggest 24h movers (not already in top 10)
        const bigMovers = solanaProtos
            .filter(p => p.change_1d !== null && Math.abs(p.change_1d!) > 15)
            .sort((a, b) => Math.abs(b.change_1d ?? 0) - Math.abs(a.change_1d ?? 0))
            .slice(0, 5);

        bigMovers.forEach(proto => {
            const tvlM = (proto.solanaTvl / 1e6).toFixed(1);
            const delta = proto.change_1d ?? 0;
            const direction = delta > 0 ? 'inflow' : 'outflow';

            signals.push({
                id: `defi-llama-mover-${proto.slug}`,
                source: 'defi-llama',
                category: 'TVL Movement',
                metric: 'tvl_change_1d',
                value: Math.round(proto.solanaTvl),
                delta: delta,
                description: `💰 ${proto.name} — ${delta > 0 ? '+' : ''}${delta.toFixed(1)}% ${direction} (24h) → $${tvlM}M TVL [${proto.category}]`,
                relatedTokens: [],
                relatedProjects: [proto.name],
                timestamp: now,
                strength: Math.min(90, 55 + Math.abs(delta)),
                sourceUrl: `https://defillama.com/protocol/${proto.slug}`,
            });
        });

        // Category breakdown for Solana
        const categories: Record<string, { count: number; tvl: number }> = {};
        solanaProtos.forEach(p => {
            if (!categories[p.category]) categories[p.category] = { count: 0, tvl: 0 };
            categories[p.category].count++;
            categories[p.category].tvl += p.solanaTvl;
        });

        // Top categories by TVL
        const topCats = Object.entries(categories)
            .sort((a, b) => b[1].tvl - a[1].tvl)
            .slice(0, 5);

        topCats.forEach(([cat, data]) => {
            const tvlM = (data.tvl / 1e6).toFixed(0);

            // Get top 3 protocols in this category for fullText
            const topProtosInCat = solanaProtos
                .filter(p => p.category === cat)
                .slice(0, 3)
                .map(p => `${p.name}: $${(p.solanaTvl / 1e6).toFixed(1)}M`);

            signals.push({
                id: `defi-llama-category-${cat.toLowerCase().replace(/\s+/g, '-')}`,
                source: 'defi-llama',
                category: 'DeFi Category',
                metric: 'category_tvl',
                value: Math.round(data.tvl),
                delta: 0,
                description: `Solana ${cat}: ${data.count} protocols • $${tvlM}M combined TVL`,
                relatedTokens: [],
                relatedProjects: [],
                timestamp: now,
                strength: Math.min(65, 35 + data.count * 3),
                sourceUrl: 'https://defillama.com/chain/Solana',
                fullText: `Top ${cat} protocols on Solana: ${topProtosInCat.join(', ')}. ${data.count} total protocols with $${tvlM}M combined TVL.`,
            });
        });

    } catch (err) {
        console.error('DefiLlama protocols error:', err);
    }

    return signals;
}

// ── 3. Solana stablecoin flows ───────────────────────────────
async function getStablecoinFlows(): Promise<Signal[]> {
    const signals: Signal[] = [];
    const now = new Date().toISOString();

    try {
        const res = await fetch('https://stablecoins.llama.fi/stablecoins?includePrices=false', {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`DefiLlama stablecoins: ${res.status}`);

        const data = await res.json();
        const stablecoins = data.peggedAssets || [];

        // Find stablecoins with Solana chain data
        const solanaStables = stablecoins
            .filter((s: any) => s.chainCirculating?.Solana?.current?.peggedUSD > 1_000_000)
            .map((s: any) => ({
                name: s.name,
                symbol: s.symbol,
                solanaMcap: s.chainCirculating.Solana.current.peggedUSD,
            }))
            .sort((a: any, b: any) => b.solanaMcap - a.solanaMcap);

        const totalStablecapM = solanaStables.reduce((sum: number, s: any) => sum + s.solanaMcap, 0) / 1e6;

        if (totalStablecapM > 0) {
            const stableBreakdown = solanaStables
                .slice(0, 5)
                .map((s: any) => `${s.symbol}: $${(s.solanaMcap / 1e6).toFixed(0)}M`)
                .join(', ');

            signals.push({
                id: 'defi-llama-stablecoin-total',
                source: 'defi-llama',
                category: 'Stablecoin Supply',
                metric: 'stablecoin_mcap',
                value: Math.round(totalStablecapM * 1e6),
                delta: 0,
                description: `Solana stablecoin supply: $${totalStablecapM.toFixed(0)}M across ${solanaStables.length} stablecoins — ${totalStablecapM > 3000 ? 'strong liquidity' : 'moderate liquidity'}`,
                relatedTokens: ['USDC', 'USDT'],
                relatedProjects: [],
                timestamp: now,
                strength: totalStablecapM > 3000 ? 65 : 45,
                sourceUrl: 'https://defillama.com/stablecoins/Solana',
                fullText: `Stablecoin breakdown on Solana: ${stableBreakdown}. Total: $${totalStablecapM.toFixed(0)}M.`,
            });
        }

        // Individual stablecoins on Solana
        solanaStables.slice(0, 3).forEach((s: any) => {
            const mcapM = (s.solanaMcap / 1e6).toFixed(0);
            signals.push({
                id: `defi-llama-stable-${s.symbol.toLowerCase()}`,
                source: 'defi-llama',
                category: 'Stablecoin Supply',
                metric: 'stablecoin_supply',
                value: Math.round(s.solanaMcap),
                delta: 0,
                description: `${s.name} (${s.symbol}) on Solana: $${mcapM}M circulating`,
                relatedTokens: [s.symbol],
                relatedProjects: [],
                timestamp: now,
                strength: s.solanaMcap > 1e9 ? 60 : 40,
                sourceUrl: 'https://defillama.com/stablecoins/Solana',
            });
        });

    } catch (err) {
        console.error('DefiLlama stablecoins error:', err);
    }

    return signals;
}

// ── Main collector ───────────────────────────────────────────
export async function collectDefiLlamaSignals(): Promise<CollectorResult<Signal[]>> {
    const collectedAt = new Date().toISOString();

    const results = await Promise.allSettled([
        getSolanaTVL(),
        getTopProtocols(),
        getStablecoinFlows(),
    ]);

    const signals: Signal[] = [];
    results.forEach(r => {
        if (r.status === 'fulfilled') signals.push(...r.value);
    });

    signals.sort((a, b) => b.strength - a.strength);

    return { data: signals, source: 'defi-llama', collectedAt };
}
