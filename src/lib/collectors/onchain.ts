// ============================================================
// Solana Narrative Pulse — Helius On-Chain Data Collector
// ============================================================
// Tracks: TPS spikes, program activity, new deployments,
//         whale wallets, and token concentration

import { Signal, CollectorResult } from '@/lib/types';
import { getCached, setCache } from '@/lib/cache';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// ── RPC helper ───────────────────────────────────────────────
async function rpc(method: string, params: any[] = []): Promise<any> {
    const res = await fetch(HELIUS_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (!res.ok) throw new Error(`Helius RPC error: ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(`RPC: ${json.error.message}`);
    return json.result;
}

// ── Monitored addresses ──────────────────────────────────────
const PROGRAMS = [
    { name: 'Jupiter v6', address: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', cat: 'DeFi' },
    { name: 'Raydium AMM', address: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', cat: 'DeFi' },
    { name: 'Orca Whirlpool', address: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', cat: 'DeFi' },
    { name: 'Marinade', address: 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD', cat: 'Staking' },
    { name: 'Drift Protocol', address: 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH', cat: 'DeFi' },
    { name: 'Tensor', address: 'TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN', cat: 'NFT' },
    { name: 'Metaplex Core', address: 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d', cat: 'NFT' },
    { name: 'Jito Tip', address: 'T1pyyaTNZsKv2WcRAB8oVnk93mLJw2XzjtVYqCsaHqt', cat: 'MEV' },
    { name: 'Pyth Oracle', address: 'FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH', cat: 'Infra' },
    { name: 'Sanctum Router', address: 'sRouteGWUhqfFY8WoYMxHhGWReTMFcRC3o5LEqvSqf8', cat: 'Staking' },
];

const WHALES = [
    // CEX wallets — track exchange inflows/outflows
    { label: 'Binance Hot Wallet', address: '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9', type: 'cex' },
    { label: 'Coinbase Prime', address: 'GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE', type: 'cex' },
    { label: 'Kraken', address: '2AQdpHJ2JpcEgPiATUXjQxA8QmafFegfQwSLWSprPicm', type: 'cex' },
    { label: 'OKX', address: '5VCwKtCXgCJ6kit5FybXjvriW3xELsFDhYrPSqtJNmcD', type: 'cex' },
    { label: 'Bybit', address: 'AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2', type: 'cex' },
    // Market makers — track smart money positioning
    { label: 'Jump Trading', address: 'jUPMchCHN8zVEm14TGrJXgrMa4bNEBEeREaKkBJvipF', type: 'mm' },
    { label: 'Wintermute', address: 'CMS4BFbVgiSsPcV4JBmfcKUYVQVhJJFSQ7p8dXksJzQF', type: 'mm' },
    // Ecosystem / Foundation
    { label: 'Solana Foundation', address: 'GK2zqSsXLA2rwVZk347RYhh6jJXRsAkGMFSi7GDDsHTy', type: 'eco' },
    // VCs
    { label: 'Galaxy Digital', address: 'HUoZj36B4JStFmJp1BUi6BqSrpWWsn6n36v6EbQTueCx', type: 'vc' },
    { label: 'Multicoin Capital', address: '4vJfp62jor7ReMxLYLAErqVoWJrsfYoFpvFJ3r4Jh6cD', type: 'vc' },
    { label: 'Paradigm', address: '9kMFe8EPPdGREuqD74MPBXpT5Js2zSPNV3xBmdKL6xyJ', type: 'vc' },
    { label: 'a16z', address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', type: 'vc' },
] as const;

// Major SPL tokens to track on whale wallets
const TRACKED_TOKENS = [
    { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
    { symbol: 'JUP', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
    { symbol: 'JTO', mint: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL' },
    { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
    { symbol: 'jitoSOL', mint: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn' },
];

const WHALE_CACHE_KEY = 'whale-balances';

const BPF_LOADER = 'BPFLoaderUpgradeab1e11111111111111111111111';
const BASELINE_TPS = 2800;

// ── 1. TPS + usage spike detection ───────────────────────────
async function getTpsAndSpikes(): Promise<Signal[]> {
    const signals: Signal[] = [];
    const now = new Date().toISOString();
    try {
        const samples = await rpc('getRecentPerformanceSamples', [10]);
        if (!samples?.length) return signals;

        const tps = samples.map((s: any) => s.numTransactions / s.samplePeriodSecs);
        const current = tps[0];
        const avg = tps.reduce((a: number, b: number) => a + b, 0) / tps.length;
        const spike = ((current - BASELINE_TPS) / BASELINE_TPS) * 100;
        const isSpike = spike > 25;

        signals.push({
            id: 'onchain-tps', source: 'onchain', category: 'Network Activity',
            metric: 'tps', value: Math.round(current), delta: parseFloat(spike.toFixed(1)),
            description: `Solana TPS: ${Math.round(current).toLocaleString()}${isSpike ? ' 🔥 SPIKE' : ''} (avg: ${Math.round(avg).toLocaleString()}, baseline: ${BASELINE_TPS})`,
            relatedTokens: ['SOL'], relatedProjects: ['solana'], timestamp: now,
            strength: isSpike ? 85 : current > 3000 ? 60 : 40,
            sourceUrl: 'https://explorer.solana.com',
        });

        const range = Math.max(...tps) - Math.min(...tps);
        if (range > 1000) {
            signals.push({
                id: 'onchain-tps-volatility', source: 'onchain', category: 'Usage Spike',
                metric: 'tps_range', value: Math.round(range), delta: 0,
                description: `TPS volatility: ${Math.round(Math.min(...tps)).toLocaleString()} → ${Math.round(Math.max(...tps)).toLocaleString()} — burst activity detected`,
                relatedTokens: ['SOL'], relatedProjects: ['solana'], timestamp: now,
                strength: Math.min(80, range / 30),
                sourceUrl: 'https://explorer.solana.com',
            });
        }
    } catch (err) { console.error('TPS error:', err); }
    return signals;
}

// ── 2. Program activity ──────────────────────────────────────
async function getProgramActivity(): Promise<Signal[]> {
    const signals: Signal[] = [];
    const now = new Date().toISOString();

    for (const p of PROGRAMS) {
        try {
            const sigs = await rpc('getSignaturesForAddress', [p.address, { limit: 10 }]);
            if (!sigs?.length) continue;

            const age = sigs[0].blockTime ? (Date.now() / 1000 - sigs[0].blockTime) / 60 : null;
            const active = age !== null && age < 5;
            const errors = sigs.filter((s: any) => s.err !== null).length;
            const errRate = (errors / sigs.length) * 100;

            signals.push({
                id: `onchain-prog-${p.name.toLowerCase().replace(/\s+/g, '-')}`,
                source: 'onchain', category: 'Program Activity', metric: 'recent_txs',
                value: sigs.length, delta: -errRate,
                description: `${p.name} [${p.cat}] — ${sigs.length} txs${active ? ' (live!)' : ''}${age !== null ? ` • ${age.toFixed(0)}m ago` : ''}${errRate > 20 ? ` ⚠️ ${errRate.toFixed(0)}% errors` : ''}`,
                relatedTokens: [], relatedProjects: [p.name], timestamp: now,
                strength: active ? 75 : sigs.length >= 10 ? 60 : 40,
                sourceUrl: `https://explorer.solana.com/address/${p.address}`,
            });
        } catch (err) { console.error(`${p.name} error:`, err); }
        await new Promise(r => setTimeout(r, 80));
    }
    return signals;
}

// ── 3. New program deployments ───────────────────────────────
async function detectNewPrograms(): Promise<Signal[]> {
    const signals: Signal[] = [];
    const now = new Date().toISOString();
    try {
        const deploys = await rpc('getSignaturesForAddress', [BPF_LOADER, { limit: 20 }]);
        if (!deploys?.length) return signals;

        const nowSec = Date.now() / 1000;
        const last1h = deploys.filter((s: any) => s.blockTime && (nowSec - s.blockTime) < 3600).length;
        const last24h = deploys.filter((s: any) => s.blockTime && (nowSec - s.blockTime) < 86400).length;

        if (last1h > 0) {
            signals.push({
                id: 'onchain-new-programs-1h', source: 'onchain', category: 'New Programs',
                metric: 'deployed_1h', value: last1h, delta: 0,
                description: `🚀 ${last1h} new program${last1h > 1 ? 's' : ''} deployed in the last hour — builders are shipping!`,
                relatedTokens: ['SOL'], relatedProjects: [], timestamp: now,
                strength: Math.min(90, 50 + last1h * 10),
                sourceUrl: 'https://explorer.solana.com',
            });
        }
        if (last24h > 0) {
            signals.push({
                id: 'onchain-new-programs-24h', source: 'onchain', category: 'New Programs',
                metric: 'deployed_24h', value: last24h, delta: 0,
                description: `${last24h} new programs deployed in last 24h — development activity trend`,
                relatedTokens: ['SOL'], relatedProjects: [], timestamp: now,
                strength: Math.min(85, 40 + last24h * 5),
                sourceUrl: 'https://explorer.solana.com',
            });
        }
    } catch (err) { console.error('New programs error:', err); }
    return signals;
}

// ── 4. Whale wallet monitoring (with balance deltas + enhanced txs) ──
async function monitorWhales(): Promise<Signal[]> {
    const signals: Signal[] = [];
    const now = new Date().toISOString();

    // Load previous balances from cache for delta tracking
    const prevBalances = getCached<Record<string, number>>(WHALE_CACHE_KEY) || {};
    const newBalances: Record<string, number> = {};

    for (const w of WHALES) {
        const slug = w.label.toLowerCase().replace(/\s+/g, '-');
        try {
            // 4a. SOL balance with delta tracking
            const bal = await rpc('getBalance', [w.address]);
            const sol = (bal?.value || 0) / 1e9;
            newBalances[w.address] = sol;

            const prevSol = prevBalances[w.address];
            const delta = prevSol && prevSol > 0
                ? ((sol - prevSol) / prevSol) * 100
                : 0;
            const deltaAbs = Math.abs(delta);

            if (sol > 1000) {
                const deltaLabel = deltaAbs > 0.1
                    ? ` (${delta > 0 ? '↑' : '↓'}${deltaAbs.toFixed(1)}%)`
                    : '';
                const isLargeMove = deltaAbs > 5;

                signals.push({
                    id: `onchain-whale-bal-${slug}`,
                    source: 'onchain',
                    category: isLargeMove ? 'Whale Movement' : 'Whale Activity',
                    metric: 'sol_balance',
                    value: Math.round(sol),
                    delta: parseFloat(delta.toFixed(1)),
                    description: `${isLargeMove ? '🐋 ' : ''}${w.label} [${w.type.toUpperCase()}]: ${sol.toLocaleString(undefined, { maximumFractionDigits: 0 })} SOL${deltaLabel}${isLargeMove && delta > 0 ? ' — accumulating' : isLargeMove && delta < 0 ? ' — distributing' : ''}`,
                    relatedTokens: ['SOL'],
                    relatedProjects: [],
                    timestamp: now,
                    strength: isLargeMove ? 85 : sol > 100000 ? 65 : sol > 10000 ? 50 : 35,
                    sourceUrl: `https://explorer.solana.com/address/${w.address}`,
                });
            }

            // 4b. Enhanced transaction parsing via Helius
            try {
                const txRes = await fetch(
                    `https://api.helius.xyz/v0/addresses/${w.address}/transactions?api-key=${HELIUS_API_KEY}&limit=3`,
                    { signal: AbortSignal.timeout(8000) }
                );
                if (txRes.ok) {
                    const txs: any[] = await txRes.json();
                    const recentTxs = txs.filter((tx: any) => {
                        const ageSec = tx.timestamp ? (Date.now() / 1000 - tx.timestamp) : Infinity;
                        return ageSec < 3600; // last hour
                    });

                    for (const tx of recentTxs.slice(0, 2)) {
                        const type = tx.type || 'UNKNOWN';
                        const desc = tx.description || '';
                        const ageMins = tx.timestamp
                            ? Math.round((Date.now() / 1000 - tx.timestamp) / 60)
                            : null;
                        const ageLabel = ageMins !== null ? `${ageMins}m ago` : '';

                        // Extract token transfers
                        const transfers = tx.tokenTransfers || [];
                        const nativeTransfers = tx.nativeTransfers || [];
                        const solMoved = nativeTransfers.reduce(
                            (sum: number, t: any) => sum + Math.abs(t.amount || 0) / 1e9, 0
                        );

                        let txDesc = `🐋 ${w.label}: ${type}`;
                        if (desc) txDesc += ` — ${desc.slice(0, 100)}`;
                        else if (solMoved > 100) txDesc += ` — moved ${solMoved.toLocaleString(undefined, { maximumFractionDigits: 0 })} SOL`;
                        if (ageLabel) txDesc += ` (${ageLabel})`;

                        const txTokens = transfers
                            .map((t: any) => t.tokenStandard === 'Fungible' ? t.mint : null)
                            .filter(Boolean)
                            .slice(0, 3);

                        signals.push({
                            id: `onchain-whale-tx-${slug}-${tx.signature?.slice(0, 8) || signals.length}`,
                            source: 'onchain',
                            category: 'Whale Movement',
                            metric: 'enhanced_tx',
                            value: Math.round(solMoved),
                            delta: 0,
                            description: txDesc,
                            relatedTokens: txTokens.length > 0 ? txTokens : ['SOL'],
                            relatedProjects: [],
                            timestamp: tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : now,
                            strength: solMoved > 10000 ? 90 : solMoved > 1000 ? 75 : 60,
                            sourceUrl: `https://explorer.solana.com/tx/${tx.signature}`,
                            fullText: desc || undefined,
                        });
                    }
                }
            } catch (err) { /* Enhanced tx API failed — non-critical */ }

            // 4c. SPL token holdings
            for (const token of TRACKED_TOKENS) {
                try {
                    const tokenAccounts = await rpc('getTokenAccountsByOwner', [
                        w.address,
                        { mint: token.mint },
                        { encoding: 'jsonParsed' },
                    ]);
                    const accounts = tokenAccounts?.value || [];
                    const totalAmount = accounts.reduce((sum: number, acc: any) => {
                        return sum + (acc.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0);
                    }, 0);

                    if (totalAmount > 1000) {
                        const prevKey = `${w.address}-${token.symbol}`;
                        const prevAmount = prevBalances[prevKey] || 0;
                        const tokenDelta = prevAmount > 0
                            ? ((totalAmount - prevAmount) / prevAmount) * 100
                            : 0;
                        newBalances[prevKey] = totalAmount;
                        const isLargeTokenMove = Math.abs(tokenDelta) > 10;

                        signals.push({
                            id: `onchain-whale-token-${slug}-${token.symbol.toLowerCase()}`,
                            source: 'onchain',
                            category: isLargeTokenMove ? 'Whale Movement' : 'Token Holdings',
                            metric: 'token_balance',
                            value: Math.round(totalAmount),
                            delta: parseFloat(tokenDelta.toFixed(1)),
                            description: `${isLargeTokenMove ? '🐋 ' : ''}${w.label}: ${totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${token.symbol}${Math.abs(tokenDelta) > 0.1 ? ` (${tokenDelta > 0 ? '↑' : '↓'}${Math.abs(tokenDelta).toFixed(1)}%)` : ''}`,
                            relatedTokens: [token.symbol],
                            relatedProjects: [],
                            timestamp: now,
                            strength: isLargeTokenMove ? 80 : totalAmount > 1e6 ? 55 : 40,
                            sourceUrl: `https://explorer.solana.com/address/${w.address}`,
                        });
                    }
                } catch { /* Token account lookup failed — skip */ }
            }

        } catch (err) { console.error(`Whale error ${w.label}:`, err); }
        await new Promise(r => setTimeout(r, 100));
    }

    // Persist current balances for next delta comparison
    setCache(WHALE_CACHE_KEY, newBalances, 600_000); // 10 minute TTL

    return signals;
}

// ── 5. Token concentration + epoch info ──────────────────────
async function getNetworkHealth(): Promise<Signal[]> {
    const signals: Signal[] = [];
    const now = new Date().toISOString();

    try {
        const largest = await rpc('getTokenLargestAccounts', ['So11111111111111111111111111111111111111112']);
        if (largest?.value?.length) {
            const top10 = largest.value.slice(0, 10);
            const total = top10.reduce((s: number, a: any) => s + parseFloat(a.uiAmountString || '0'), 0);
            signals.push({
                id: 'onchain-sol-concentration', source: 'onchain', category: 'Wallet Behavior',
                metric: 'top10_concentration', value: Math.round(total), delta: 0,
                description: `Top 10 wrapped SOL holders: ${(total / 1e6).toFixed(2)}M SOL — ${total > 5e6 ? 'high concentration' : 'moderate distribution'}`,
                relatedTokens: ['SOL'], relatedProjects: [], timestamp: now,
                strength: total > 5e6 ? 60 : 40,
                sourceUrl: 'https://explorer.solana.com',
            });
        }
    } catch (err) { console.error('Concentration error:', err); }

    try {
        const epoch = await rpc('getEpochInfo');
        if (epoch) {
            const pct = ((epoch.slotIndex / epoch.slotsInEpoch) * 100).toFixed(1);
            signals.push({
                id: 'onchain-epoch', source: 'onchain', category: 'Network State',
                metric: 'epoch', value: epoch.epoch, delta: parseFloat(pct),
                description: `Epoch ${epoch.epoch} — ${pct}% complete • ${epoch.transactionCount?.toLocaleString() || 'N/A'} total txs`,
                relatedTokens: ['SOL'], relatedProjects: ['solana'], timestamp: now,
                strength: 35,
                sourceUrl: 'https://explorer.solana.com',
            });
        }
    } catch (err) { console.error('Epoch error:', err); }

    return signals;
}

// ── 6. Stake distribution & validator health ─────────────────
async function getStakeDistribution(): Promise<Signal[]> {
    const signals: Signal[] = [];
    const now = new Date().toISOString();

    try {
        const voteAccounts = await rpc('getVoteAccounts');
        if (voteAccounts) {
            const active = voteAccounts.current?.length || 0;
            const delinquent = voteAccounts.delinquent?.length || 0;
            const total = active + delinquent;
            const delinquentPct = total > 0 ? ((delinquent / total) * 100).toFixed(1) : '0';

            signals.push({
                id: 'onchain-validators-active', source: 'onchain', category: 'Validator Health',
                metric: 'active_validators', value: active, delta: 0,
                description: `${active.toLocaleString()} active validators, ${delinquent} delinquent (${delinquentPct}%) — ${parseFloat(delinquentPct) < 5 ? 'healthy network' : '⚠️ elevated delinquency'}`,
                relatedTokens: ['SOL'], relatedProjects: ['solana'], timestamp: now,
                strength: parseFloat(delinquentPct) > 10 ? 75 : 45,
                sourceUrl: 'https://www.validators.app/?network=mainnet',
            });

            // Stake concentration — top validators by activated stake
            if (voteAccounts.current?.length) {
                const sorted = [...voteAccounts.current]
                    .sort((a: any, b: any) => b.activatedStake - a.activatedStake);
                const totalStake = sorted.reduce((sum: number, v: any) => sum + v.activatedStake, 0);

                // Nakamoto coefficient (how many validators control 33% of stake)
                let cumulative = 0;
                let nakaCount = 0;
                for (const v of sorted) {
                    cumulative += v.activatedStake;
                    nakaCount++;
                    if (cumulative >= totalStake * 0.33) break;
                }

                const totalStakeM = (totalStake / 1e9 / 1e6).toFixed(1);
                signals.push({
                    id: 'onchain-stake-concentration', source: 'onchain', category: 'Stake Distribution',
                    metric: 'nakamoto_coefficient', value: nakaCount, delta: 0,
                    description: `Nakamoto coefficient: ${nakaCount} validators control 33% of ${totalStakeM}M SOL stake — ${nakaCount > 30 ? 'well distributed' : nakaCount > 20 ? 'moderate' : '⚠️ concentrated'}`,
                    relatedTokens: ['SOL'], relatedProjects: ['solana'], timestamp: now,
                    strength: nakaCount < 20 ? 70 : 40,
                    sourceUrl: 'https://www.validators.app/?network=mainnet',
                });

                // Top 3 validators by stake
                sorted.slice(0, 3).forEach((v: any, i: number) => {
                    const stakeM = (v.activatedStake / 1e9 / 1e6).toFixed(2);
                    const stakePct = ((v.activatedStake / totalStake) * 100).toFixed(1);
                    signals.push({
                        id: `onchain-top-validator-${i}`, source: 'onchain', category: 'Top Validators',
                        metric: 'validator_stake', value: Math.round(v.activatedStake / 1e9), delta: 0,
                        description: `Validator #${i + 1}: ${stakeM}M SOL (${stakePct}% of total) • Commission: ${v.commission}%`,
                        relatedTokens: ['SOL'], relatedProjects: [], timestamp: now,
                        strength: 35,
                        sourceUrl: 'https://www.validators.app/?network=mainnet',
                    });
                });
            }
        }
    } catch (err) { console.error('Stake distribution error:', err); }

    return signals;
}

// ── 7. Supply metrics & inflation ────────────────────────────
async function getSupplyMetrics(): Promise<Signal[]> {
    const signals: Signal[] = [];
    const now = new Date().toISOString();

    try {
        const supply = await rpc('getSupply', [{ excludeNonCirculatingAccounts: false }]);
        if (supply?.value) {
            const circulating = supply.value.circulating / 1e9;
            const total = supply.value.total / 1e9;
            const nonCirculating = supply.value.nonCirculating / 1e9;
            const circulatingPct = ((circulating / total) * 100).toFixed(1);

            signals.push({
                id: 'onchain-supply-circulating', source: 'onchain', category: 'Supply Metrics',
                metric: 'circulating_supply', value: Math.round(circulating), delta: 0,
                description: `SOL supply: ${(circulating / 1e6).toFixed(1)}M circulating (${circulatingPct}%) of ${(total / 1e6).toFixed(1)}M total • ${(nonCirculating / 1e6).toFixed(1)}M locked`,
                relatedTokens: ['SOL'], relatedProjects: ['solana'], timestamp: now,
                strength: 35,
                sourceUrl: 'https://explorer.solana.com/supply',
            });
        }
    } catch (err) { console.error('Supply error:', err); }

    try {
        const inflation = await rpc('getInflationRate');
        if (inflation) {
            signals.push({
                id: 'onchain-inflation', source: 'onchain', category: 'Inflation',
                metric: 'inflation_rate', value: parseFloat((inflation.total * 100).toFixed(2)), delta: 0,
                description: `SOL inflation rate: ${(inflation.total * 100).toFixed(2)}% total (validator: ${(inflation.validator * 100).toFixed(2)}%, foundation: ${(inflation.foundation * 100).toFixed(2)}%)`,
                relatedTokens: ['SOL'], relatedProjects: ['solana'], timestamp: now,
                strength: 30,
                sourceUrl: 'https://explorer.solana.com',
            });
        }
    } catch (err) { console.error('Inflation error:', err); }

    return signals;
}

// ── Main collector ───────────────────────────────────────────
export async function collectOnChainSignals(): Promise<CollectorResult<Signal[]>> {
    const collectedAt = new Date().toISOString();
    if (!HELIUS_API_KEY) {
        return { data: [], source: 'helius', collectedAt, error: 'No Helius API key' };
    }

    const results = await Promise.allSettled([
        getTpsAndSpikes(),
        getProgramActivity(),
        detectNewPrograms(),
        monitorWhales(),
        getNetworkHealth(),
        getStakeDistribution(),
        getSupplyMetrics(),
    ]);

    const signals: Signal[] = [];
    results.forEach(r => { if (r.status === 'fulfilled') signals.push(...r.value); });
    signals.sort((a, b) => b.strength - a.strength);

    return { data: signals, source: 'helius', collectedAt };
}

