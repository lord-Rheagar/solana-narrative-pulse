// ============================================================
// Solana Narrative Pulse — Social & Community Collector
// ============================================================
// Collects signals from:
// 1. RSS Feeds (Blogs, Research Reports from Helius, Messari, etc.)
// 2. Twitter/X KOL tracking (via agent-twitter-client scraper)

import { Signal, CollectorResult } from '@/lib/types';

// ── RSS Configuration ────────────────────────────────────────
const RSS_FEEDS = [
    { name: 'Helius Blog', url: 'https://www.helius.dev/blog/rss.xml', category: 'Infrastructure', solanaOnly: true },
    { name: 'Messari', url: 'https://messari.io/rss', category: 'Market Research', solanaOnly: false },
    { name: 'Electric Capital', url: 'https://electriccapital.substack.com/feed', category: 'VC Report', solanaOnly: false },
    { name: 'Solana Foundation', url: 'https://solana.com/news/rss', category: 'Ecosystem News', solanaOnly: true },
    { name: 'Superteam', url: 'https://blog.superteam.fun/rss.xml', category: 'Community', solanaOnly: true },
    { name: 'Jupiter', url: 'https://www.jup.ag/blog/rss.xml', category: 'DeFi', solanaOnly: true },
    { name: 'Jito Labs', url: 'https://www.jito.network/blog/rss.xml', category: 'Infrastructure', solanaOnly: true },
    { name: 'Marinade Finance', url: 'https://blog.marinade.finance/rss/', category: 'DeFi', solanaOnly: true },
];

// ── KOL Configuration ────────────────────────────────────────
const KOLS = [
    { name: 'Mert Mumtaz', handle: '0xMert_', tags: ['Infrastructure', 'Helius', 'Validation'], weight: 90 },
    { name: 'Anatoly Yakovenko', handle: 'aeyakovenko', tags: ['Protocol', 'Vision', 'Firedancer'], weight: 95 },
    { name: 'Akshay BD', handle: 'akshaybd', tags: ['Community', 'Superteam', 'Growth'], weight: 85 },
    { name: 'Raj Gokal', handle: 'rajgokal', tags: ['Solana', 'Strategy'], weight: 85 },
    { name: 'Chase Barker', handle: 'therealchaseeb', tags: ['DeFi', 'Jupiter'], weight: 80 },
    { name: 'Max Resnick', handle: 'MaxResnick', tags: ['Infrastructure', 'MEV', 'Protocol'], weight: 85 },
    { name: 'Kash Dhanda', handle: 'kashdhanda', tags: ['Ecosystem', 'Growth'], weight: 80 },
    { name: 'SOLBigBrain', handle: 'SOLBigBrain', tags: ['DeFi', 'Alpha', 'Trading'], weight: 80 },
];

// Narrative keywords to boost signal strength
const NARRATIVE_KEYWORDS = [
    'firedancer', 'compressed nft', 'cnft', 'depin', 'rwa', 'blink', 'action',
    'restaking', 'mev', 'jito', 'liquid staking', 'lst', 'sanctum',
    'token extensions', 'token-2022', 'zk compression', 'light protocol',
    'ai agent', 'agent kit', 'payfi', 'solana mobile', 'saga',
];

// Spam patterns to filter out noise (price predictions, meme shills, pump language)
const SPAM_PATTERNS = /\b(buy now|100x|1000x|gem alert|next 100|guaranteed|pump it|to the moon|moon soon|nfa|dyor|ape in|send it|free airdrop|giveaway|whitelist spot|presale|call of the day|easy 10x|dont miss|don't miss)\b/i;

// ── 1. RSS Feed Collector ────────────────────────────────────
async function fetchRssSignals(): Promise<Signal[]> {
    const signals: Signal[] = [];
    const now = new Date().toISOString();

    for (const feed of RSS_FEEDS) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);

            const res = await fetch(feed.url, {
                signal: controller.signal,
                headers: { 'User-Agent': 'SolanaNarrativePulse/1.0' },
            });
            clearTimeout(timeout);

            if (!res.ok) continue;

            const text = await res.text();

            // Parse <item> (RSS 2.0) or <entry> (Atom)
            const items = text.match(/<item>[\s\S]*?<\/item>/g)
                || text.match(/<entry>[\s\S]*?<\/entry>/g)
                || [];

            for (const item of items.slice(0, 3)) {
                const titleMatch = item.match(/<title>(.*?)<\/title>/)
                    || item.match(/<title\s[^>]*>(.*?)<\/title>/);
                let title = titleMatch
                    ? titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
                    : '';
                if (!title) continue;

                // Extract article link
                const linkMatch = item.match(/<link>(.*?)<\/link>/)
                    || item.match(/<link[^>]*href=["']([^"']+)["']/);
                const articleUrl = linkMatch
                    ? linkMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
                    : undefined;

                // Extract description/summary for fullText
                const descMatch = item.match(/<description>([\s\S]*?)<\/description>/)
                    || item.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
                const articleSummary = descMatch
                    ? descMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim()
                    : undefined;

                // Filter non-Solana feeds for relevance
                if (!feed.solanaOnly) {
                    if (!/solana|sol\b|svm|jup|ray|drif|hnt|rndr|marinade|jito|pyth|tensor|metaplex|phantom|jupiter|orca/i.test(title + item)) continue;
                }

                // Calculate strength boost from narrative keywords
                const titleLower = title.toLowerCase();
                const keywordHits = NARRATIVE_KEYWORDS.filter(kw => titleLower.includes(kw));
                const keywordBoost = Math.min(20, keywordHits.length * 7);

                signals.push({
                    id: `social-rss-${feed.name.replace(/\s+/g, '-').toLowerCase()}-${signals.length}`,
                    source: 'social',
                    category: feed.category,
                    metric: 'new_report',
                    value: 1,
                    delta: 0,
                    description: `📰 ${feed.name}: ${title}`,
                    relatedTokens: ['SOL'],
                    relatedProjects: keywordHits.length > 0 ? keywordHits : [],
                    timestamp: now,
                    strength: Math.min(95, 65 + keywordBoost),
                    sourceUrl: articleUrl,
                    fullText: articleSummary,
                });
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.warn(`RSS ${feed.name} failed:`, err.message);
            }
        }
    }
    return signals;
}

// ── 2. Twitter/X API v2 ──────────────────────────────────────
// Uses the official Twitter API v2 recent search endpoint with bearer token.
// Falls back to agent-twitter-client scraper if bearer token is not set.

const TWITTER_API_BASE = 'https://api.twitter.com/2';

interface TweetData {
    id: string;
    text: string;
    author_id?: string;
    created_at?: string;
    public_metrics?: {
        like_count: number;
        retweet_count: number;
        reply_count: number;
        quote_count: number;
    };
}

interface TwitterSearchResponse {
    data?: TweetData[];
    includes?: {
        users?: { id: string; name: string; username: string }[];
    };
    meta?: {
        result_count: number;
    };
}

async function twitterApiSearch(query: string, maxResults: number = 10): Promise<TwitterSearchResponse | null> {
    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    if (!bearerToken) return null;

    try {
        const params = new URLSearchParams({
            query,
            max_results: String(Math.min(maxResults, 100)),
            'tweet.fields': 'created_at,public_metrics,author_id',
            expansions: 'author_id',
            'user.fields': 'name,username',
        });

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(`${TWITTER_API_BASE}/tweets/search/recent?${params}`, {
            headers: {
                Authorization: `Bearer ${bearerToken}`,
                'Content-Type': 'application/json',
            },
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            console.warn(`[Twitter API] ❌ ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
            return null;
        }

        return await res.json();
    } catch (err: any) {
        if (err.name === 'AbortError') {
            console.warn('[Twitter API] ⏱ Request timed out');
        } else {
            console.warn('[Twitter API] ❌ Fetch error:', err.message);
        }
        return null;
    }
}

async function fetchTwitterSignals(): Promise<Signal[]> {
    const signals: Signal[] = [];
    const now = new Date().toISOString();
    const bearerToken = process.env.TWITTER_BEARER_TOKEN;

    console.log(`[Twitter] ── fetchTwitterSignals() called (bearer: ${bearerToken ? 'SET' : 'MISSING'}) ──`);

    if (!bearerToken) {
        console.warn('[Twitter] No bearer token — skipping Twitter signals');
        return [];
    }

    // Build a user lookup for author resolution
    const userMap = new Map<string, { name: string; username: string }>();

    // Strategy 1: KOL monitoring — search for tweets from each KOL about Solana
    for (const kol of KOLS) {
        try {
            const query = `from:${kol.handle} (solana OR firedancer OR depin OR restaking OR "token extensions" OR "zk compression" OR jito OR sanctum) -is:retweet`;
            console.log(`[Twitter] Searching KOL @${kol.handle}...`);

            const response = await twitterApiSearch(query, 5);
            if (!response?.data?.length) {
                console.log(`[Twitter]   → No recent tweets from @${kol.handle}`);
                continue;
            }

            // Build user map from includes
            response.includes?.users?.forEach(u => userMap.set(u.id, { name: u.name, username: u.username }));

            console.log(`[Twitter]   → Got ${response.data.length} tweets from @${kol.handle}`);

            for (const tweet of response.data) {
                const text = tweet.text || '';
                if (text.length < 30) continue;

                const textLower = text.toLowerCase();

                // Skip spam/noise
                if (SPAM_PATTERNS.test(text)) continue;

                const hits = NARRATIVE_KEYWORDS.filter(kw => textLower.includes(kw));
                const likes = tweet.public_metrics?.like_count || 0;
                const retweets = tweet.public_metrics?.retweet_count || 0;
                const engagement = likes + retweets * 2;

                const truncated = text.length > 120 ? text.slice(0, 120) + '...' : text;

                signals.push({
                    id: `social-x-${kol.handle}-${tweet.id}`,
                    source: 'social',
                    category: 'KOL Signal',
                    metric: 'kol_tweet',
                    value: engagement,
                    delta: 0,
                    description: `🐦 ${kol.name}: "${truncated}"`,
                    relatedTokens: extractTokens(text),
                    relatedProjects: hits.length > 0 ? hits : kol.tags.slice(0, 2),
                    timestamp: tweet.created_at || now,
                    strength: Math.min(95, kol.weight + hits.length * 5 + Math.min(20, engagement / 50)),
                    sourceUrl: `https://x.com/${kol.handle}/status/${tweet.id}`,
                    fullText: text.length > 120 ? text : undefined,
                });
            }
        } catch (err: any) {
            console.warn(`[Twitter] ❌ KOL ${kol.name} failed:`, err?.message || err);
        }

        // Small delay between API calls to respect rate limits
        await new Promise(r => setTimeout(r, 200));
    }

    // Strategy 2: Search for builder/infra-focused Solana narratives
    // (Avoid price/meme queries — they attract spam)
    const searchTerms = [
        'solana (firedancer OR depin OR "zk compression" OR restaking) -is:retweet lang:en',
        'solana (shipped OR launched OR mainnet OR devnet OR protocol) -is:retweet lang:en',
        'solana (builder OR developer OR hackathon OR grant) -is:retweet lang:en',
    ];

    for (const term of searchTerms) {
        try {
            console.log(`[Twitter] Searching: "${term}"...`);
            const response = await twitterApiSearch(term, 10);
            if (!response?.data?.length) continue;

            // Build user map
            response.includes?.users?.forEach(u => userMap.set(u.id, { name: u.name, username: u.username }));

            console.log(`[Twitter]   → Search returned ${response.data.length} results`);

            for (const tweet of response.data) {
                const text = tweet.text || '';
                if (text.length < 80) continue; // require substantive tweets

                // Skip spam
                if (SPAM_PATTERNS.test(text)) continue;

                const likes = tweet.public_metrics?.like_count || 0;
                const retweets = tweet.public_metrics?.retweet_count || 0;
                const engagement = likes + retweets * 2;

                // Require minimum engagement for search results (not KOLs)
                if (engagement < 10) continue;

                const hits = NARRATIVE_KEYWORDS.filter(kw => text.toLowerCase().includes(kw));

                // Resolve author
                const author = tweet.author_id ? userMap.get(tweet.author_id) : undefined;
                const authorLabel = author ? `@${author.username}` : 'Unknown';
                const truncated = text.length > 120 ? text.slice(0, 120) + '...' : text;

                signals.push({
                    id: `social-x-search-${tweet.id}`,
                    source: 'social',
                    category: 'X Trend',
                    metric: 'trending_tweet',
                    value: engagement,
                    delta: 0,
                    description: `🔥 ${authorLabel}: "${truncated}"`,
                    relatedTokens: extractTokens(text),
                    relatedProjects: hits,
                    timestamp: tweet.created_at || now,
                    strength: Math.min(85, 50 + Math.min(25, engagement / 100) + hits.length * 5),
                    sourceUrl: author
                        ? `https://x.com/${author.username}/status/${tweet.id}`
                        : `https://x.com/i/status/${tweet.id}`,
                    fullText: text.length > 120 ? text : undefined,
                });
            }
            await new Promise(r => setTimeout(r, 200));
        } catch (err: any) {
            console.warn('[Twitter] ❌ Search failed:', err?.message || err);
        }
    }

    console.log(`[Twitter] ── Total Twitter signals: ${signals.length} ──`);
    return signals;
}

// Extract $CASHTAGS from tweet text
function extractTokens(text: string): string[] {
    const matches = text.match(/\$[A-Z]{2,10}/g) || [];
    return [...new Set(matches.map(m => m.replace('$', '')))].slice(0, 5);
}

// ── Main Collector ───────────────────────────────────────────
export async function collectSocialSignals(): Promise<CollectorResult<Signal[]>> {
    const collectedAt = new Date().toISOString();

    const results = await Promise.allSettled([
        fetchRssSignals(),
        fetchTwitterSignals(),
    ]);

    const signals: Signal[] = [];
    results.forEach(r => {
        if (r.status === 'fulfilled') signals.push(...r.value);
    });

    // Sort by strength
    signals.sort((a, b) => b.strength - a.strength);

    return {
        data: signals,
        source: 'social',
        collectedAt,
    };
}
