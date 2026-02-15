// ============================================================
// Solana Narrative Pulse — Signal Description Enrichment
// ============================================================
// Standardizes signal descriptions for consistency and clarity.
// Pattern: [Source Emoji] [Entity] — [action/metric] [scale] [context]

import { Signal } from '@/lib/types';

const SOURCE_BADGES: Record<string, string> = {
    onchain: '⛓️',
    github: '🔧',
    market: '📈',
    social: '💬',
    'defi-llama': '🏦',
    governance: '🏛️',
};

const CATEGORY_BADGES: Record<string, string> = {
    'Governance': '🏛️',
    'NFT Collection': '🎨',
    'NFT Floor Price': '🖼️',
    'DEX Trending': '📊',
    'DEX Boosted': '🚀',
    'New Pair': '🆕',
    'Whale Activity': '🐋',
    'Whale Movement': '🐋',
    'KOL Signal': '🐦',
    'X Trend': '🔥',
    'New Programs': '🚀',
    'Validator Health': '🛡️',
    'Stablecoin Supply': '💵',
    'DeFi TVL': '🏦',
    'DeFi Protocol': '🏦',
    'TVL Movement': '💰',
    'Trending Token': '🔥',
};

/**
 * Enriches signal descriptions for consistency.
 * - Ensures consistent emoji badge at start
 * - Adds human-readable scale where applicable
 * - Normalizes delta formatting
 */
export function enrichSignalDescriptions(signals: Signal[]): Signal[] {
    return signals.map(signal => ({
        ...signal,
        description: enrichDescription(signal),
    }));
}

function enrichDescription(signal: Signal): string {
    const desc = signal.description;

    // Skip if already well-formatted (has emoji at start)
    if (/^[\u{1F000}-\u{1FFFF}]|^[⛓🔧📈💬🏛🎨🖼📊🚀🆕🐋🐦🔥💰🏦💵🛡📰🌐]/u.test(desc)) {
        return desc;
    }

    // Add category badge if no emoji present
    const badge = CATEGORY_BADGES[signal.category] || SOURCE_BADGES[signal.source] || '';
    if (badge) {
        return `${badge} ${desc}`;
    }

    return desc;
}

/**
 * Format a large number into human-readable scale
 */
export function formatScale(value: number): string {
    if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return value.toLocaleString();
}

/**
 * Format a delta percentage consistently
 */
export function formatDelta(delta: number): string {
    if (delta === 0) return '';
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta.toFixed(1)}%`;
}
