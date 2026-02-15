'use client';

import { Signal, Narrative } from '@/lib/types';

interface SignalDetailPanelProps {
    signal: Signal | null;
    narratives: Narrative[];
    allSignals: Signal[];
    onClose: () => void;
    onSignalClick?: (signal: Signal) => void;
}

// ── Generate "Why It Matters" context ────────────────────────

function getWhyItMatters(signal: Signal): string {
    // Fallback when aiContext is not yet available (before detection runs)
    const sourceLabels: Record<string, string> = {
        'github': 'developer activity',
        'onchain': 'on-chain data',
        'defi-llama': 'DeFi TVL data',
        'market': 'market data',
        'social': 'social/media coverage',
    };
    const sourceLabel = sourceLabels[signal.source] || signal.source;
    return `This is a ${sourceLabel} signal. Run detection to generate a specific AI insight for this signal.`;
}

// ── Generate source URL ──────────────────────────────────────

function getSourceUrl(signal: Signal): { url: string; label: string } | null {
    const { source, category, id, relatedProjects, relatedTokens } = signal;

    if (source === 'github') {
        // Try to extract repo info from the description or projects
        if (relatedProjects.length > 0) {
            const project = relatedProjects[0];
            // Check common Solana orgs
            const knownRepos: Record<string, string> = {
                'Marinade': 'https://github.com/marinade-finance',
                'Jupiter': 'https://github.com/jup-ag',
                'Drift': 'https://github.com/drift-labs',
                'Orca': 'https://github.com/orca-so',
                'Raydium': 'https://github.com/raydium-io',
                'Tensor': 'https://github.com/tensor-hq',
                'Metaplex': 'https://github.com/metaplex-foundation',
                'Jito': 'https://github.com/jito-foundation',
                'Pyth': 'https://github.com/pyth-network',
                'Solana': 'https://github.com/solana-labs',
            };
            for (const [name, url] of Object.entries(knownRepos)) {
                if (project.toLowerCase().includes(name.toLowerCase())) {
                    return { url, label: `View on GitHub` };
                }
            }
        }
        return { url: 'https://github.com/topics/solana', label: 'Solana on GitHub' };
    }

    if (source === 'onchain') {
        if (id.includes('whale') || category === 'Whale Activity' || category === 'Whale Movement') {
            return { url: 'https://explorer.solana.com', label: 'Solana Explorer' };
        }
        if (category === 'Program Activity') {
            const project = relatedProjects[0];
            if (project) {
                return { url: `https://explorer.solana.com/address/${getKnownAddress(project)}`, label: `${project} on Explorer` };
            }
        }
        if (category === 'New Programs') {
            return { url: 'https://explorer.solana.com', label: 'Solana Explorer' };
        }
        if (category === 'Validator Health' || category === 'Stake Distribution' || category === 'Top Validators') {
            return { url: 'https://www.validators.app/?network=mainnet', label: 'Validators.app' };
        }
        return { url: 'https://explorer.solana.com', label: 'Solana Explorer' };
    }

    if (source === 'defi-llama') {
        if (category === 'DeFi Protocol' || category === 'TVL Movement' || category === 'DeFi Category') {
            const project = relatedProjects[0];
            if (project) {
                const slug = project.toLowerCase().replace(/\s+/g, '-');
                return { url: `https://defillama.com/protocol/${slug}`, label: 'View on DeFi Llama' };
            }
        }
        if (category === 'Stablecoin Supply') {
            return { url: 'https://defillama.com/stablecoins/Solana', label: 'Solana Stablecoins' };
        }
        return { url: 'https://defillama.com/chain/Solana', label: 'Solana on DeFi Llama' };
    }

    if (source === 'market') {
        if (relatedTokens.length > 0) {
            const token = relatedTokens[0].toLowerCase();
            return { url: `https://www.coingecko.com/en/coins/${token === 'sol' ? 'solana' : token}`, label: 'View on CoinGecko' };
        }
        return { url: 'https://dexscreener.com/solana', label: 'Solana on DEXScreener' };
    }

    if (source === 'social') {
        if (category === 'KOL Signal') {
            return { url: 'https://x.com/search?q=solana&f=top', label: 'View on X' };
        }
        return { url: 'https://x.com/search?q=solana&f=top', label: 'Solana on X' };
    }

    return null;
}

function getKnownAddress(project: string): string {
    const addresses: Record<string, string> = {
        'Jupiter v6': 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
        'Raydium AMM': '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
        'Orca Whirlpool': 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
        'Marinade': 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD',
        'Drift Protocol': 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH',
        'Tensor': 'TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN',
        'Metaplex Core': 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d',
    };
    return addresses[project] || '';
}

// ── Evidence label (deterministic, not opaque) ───────────────

function getEvidenceLabel(signal: Signal, allSignals: Signal[]): { label: string; color: string } {
    const relatedSources = new Set<string>();
    relatedSources.add(signal.source);
    const myTokens = new Set(signal.relatedTokens || []);
    const myProjects = new Set(signal.relatedProjects || []);
    for (const s of allSignals) {
        if (s.id === signal.id) continue;
        const hasOverlap = s.relatedTokens?.some(t => myTokens.has(t)) ||
            s.relatedProjects?.some(p => myProjects.has(p));
        if (hasOverlap) relatedSources.add(s.source);
    }
    if (relatedSources.size >= 3) return { label: 'STRONG SIGNAL', color: 'var(--accent)' };
    if (relatedSources.size >= 2) return { label: 'EMERGING', color: '#888' };
    return { label: 'SINGLE-SOURCE', color: '#555' };
}

// ── Related Signals computation ──────────────────────────────

function getRelatedSignals(signal: Signal, allSignals: Signal[]): Signal[] {
    if (!allSignals || allSignals.length === 0) return [];

    const tokenSet = new Set(signal.relatedTokens.map(t => t.toLowerCase()));
    const projectSet = new Set(signal.relatedProjects.map(p => p.toLowerCase()));

    const scored: { signal: Signal; score: number }[] = [];

    for (const s of allSignals) {
        if (s.id === signal.id) continue;

        let score = 0;

        // Score by shared tokens (highest value — same token is very relevant)
        for (const t of s.relatedTokens) {
            if (tokenSet.has(t.toLowerCase()) && t.toLowerCase() !== 'sol') score += 3;
            if (t.toLowerCase() === 'sol' && tokenSet.has('sol')) score += 0.5; // SOL is too common
        }

        // Score by shared projects
        for (const p of s.relatedProjects) {
            if (projectSet.has(p.toLowerCase())) score += 4;
        }

        // Score by same category (lighter weight — lots of signals share categories)
        if (s.category === signal.category) score += 1;

        // Cross-source bonus: different source type = more interesting convergence
        if (score > 0 && s.source !== signal.source) score += 2;

        if (score > 0) {
            scored.push({ signal: s, score });
        }
    }

    return scored
        .sort((a, b) => b.score - a.score || b.signal.strength - a.signal.strength)
        .slice(0, 5)
        .map(s => s.signal);
}

// ── Component ────────────────────────────────────────────────

export function SignalDetailPanel({ signal, narratives, allSignals, onClose, onSignalClick }: SignalDetailPanelProps) {
    if (!signal) return null;

    const whyItMatters = getWhyItMatters(signal);
    const sourceLink = getSourceUrl(signal);
    const evidenceInfo = getEvidenceLabel(signal, allSignals);

    // Compute related signals: same tokens, projects, or category (exclude self)
    const relatedSignals = getRelatedSignals(signal, allSignals);
    const relatedNarrative = narratives.find(n =>
        n.signals.some(s => s.id === signal.id)
    );

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.6)',
                    zIndex: 100,
                }}
            />

            {/* Panel */}
            <div style={{
                position: 'fixed',
                top: 48,
                left: 0,
                bottom: 40,
                width: 420,
                background: 'var(--bg-card)',
                borderRight: '1px solid var(--border-dim)',
                zIndex: 101,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                animation: 'slideIn 0.2s ease',
            }}>
                {/* Header */}
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border-dim)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            color: 'var(--accent)',
                            border: '1px solid var(--accent)',
                            padding: '2px 6px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                        }}>
                            {signal.source}
                        </span>
                        <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                        }}>
                            {signal.category}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: '1px solid var(--border-dim)',
                            color: 'var(--text-muted)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            padding: '2px 8px',
                            cursor: 'pointer',
                        }}
                    >
                        ESC
                    </button>
                </div>

                {/* Full description */}
                <div style={{ padding: '20px 20px 16px' }}>
                    <p style={{
                        fontSize: 15,
                        fontWeight: 500,
                        color: 'var(--text-main)',
                        lineHeight: 1.5,
                        marginBottom: 16,
                    }}>
                        {signal.description}
                    </p>

                    {/* Evidence summary */}
                    <div style={{
                        marginBottom: 20,
                        padding: '10px 12px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-dim)',
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginBottom: 8,
                        }}>
                            <span style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 10,
                                color: evidenceInfo.color,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                fontWeight: 700,
                            }}>
                                {evidenceInfo.label}
                            </span>
                        </div>
                        <div style={{
                            fontSize: 11,
                            color: 'var(--text-muted)',
                            lineHeight: 1.5,
                            fontFamily: 'var(--font-mono)',
                        }}>
                            {signal.delta !== undefined && signal.delta !== 0 && (
                                <div>• Change: {signal.delta > 0 ? '+' : ''}{signal.delta.toFixed(1)}%</div>
                            )}
                            {signal.value !== undefined && signal.value !== 0 && (
                                <div>• Value: {signal.value.toLocaleString()}</div>
                            )}
                            {signal.relatedTokens?.length > 0 && (
                                <div>• Tokens: {signal.relatedTokens.join(', ')}</div>
                            )}
                            {signal.relatedProjects?.length > 0 && (
                                <div>• Projects: {signal.relatedProjects.join(', ')}</div>
                            )}
                            <div>• Source: {signal.source}</div>
                        </div>
                    </div>

                    {/* Key metrics */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 1,
                        marginBottom: 20,
                        border: '1px solid var(--border-dim)',
                    }}>
                        <div style={{ padding: '10px 12px', background: 'var(--bg-surface)' }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                                VALUE
                            </div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-main)', fontWeight: 600 }}>
                                {typeof signal.value === 'number' ? signal.value.toLocaleString() : signal.value}
                            </div>
                        </div>
                        <div style={{ padding: '10px 12px', background: 'var(--bg-surface)' }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                                CHANGE
                            </div>
                            <div style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 14,
                                fontWeight: 600,
                                color: signal.delta > 0 ? 'var(--accent)' : signal.delta < 0 ? '#ff6666' : 'var(--text-muted)',
                            }}>
                                {signal.delta !== 0 ? `${signal.delta > 0 ? '+' : ''}${signal.delta.toFixed(1)}%` : '—'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Why It Matters */}
                <div style={{
                    padding: '16px 20px',
                    borderTop: '1px solid var(--border-dim)',
                    borderBottom: '1px solid var(--border-dim)',
                }}>
                    <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: 'var(--accent)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: 10,
                    }}>
                        {signal.aiContext ? 'INSIGHT & CONTEXT' : 'WHY THIS MATTERS'}
                    </div>
                    <div style={{
                        fontSize: 13,
                        color: 'var(--text-main)',
                        lineHeight: 1.6,
                        borderLeft: signal.aiContext ? '2px solid var(--accent)' : 'none',
                        paddingLeft: signal.aiContext ? 12 : 0,
                    }}>
                        {signal.aiContext || whyItMatters}
                    </div>
                </div>

                {/* Full Content (for tweets/RSS with truncated descriptions) */}
                {signal.fullText && signal.fullText !== signal.description && (
                    <div style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--border-dim)',
                    }}>
                        <div style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: 10,
                        }}>
                            FULL CONTENT
                        </div>
                        <div style={{
                            fontSize: 13,
                            color: 'var(--text-main)',
                            lineHeight: 1.6,
                            opacity: 0.85,
                            whiteSpace: 'pre-wrap',
                            maxHeight: 200,
                            overflowY: 'auto',
                        }}>
                            {signal.fullText}
                        </div>
                    </div>
                )}

                {/* Related Signals */}
                {relatedSignals.length > 0 && (
                    <div style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--border-dim)',
                    }}>
                        <div style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: 10,
                        }}>
                            RELATED SIGNALS ({relatedSignals.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {relatedSignals.map(rs => {
                                const rsDelta = rs.delta;
                                const sourceBadge = rs.source === 'onchain' ? '⛓️' :
                                    rs.source === 'github' ? '🔧' :
                                        rs.source === 'market' ? '📈' :
                                            rs.source === 'defi-llama' ? '🏦' :
                                                rs.source === 'social' ? '📣' : '💬';
                                return (
                                    <div
                                        key={rs.id}
                                        onClick={() => onSignalClick?.(rs)}
                                        style={{
                                            padding: '8px 10px',
                                            background: 'var(--bg-surface)',
                                            border: '1px solid var(--border-dim)',
                                            cursor: onSignalClick ? 'pointer' : 'default',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            transition: 'border-color 0.15s ease',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-dim)')}
                                    >
                                        <span style={{ fontSize: 14, flexShrink: 0 }}>{sourceBadge}</span>
                                        <span style={{
                                            fontSize: 11,
                                            color: 'var(--text-main)',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            flex: 1,
                                        }}>
                                            {rs.description.slice(0, 80)}{rs.description.length > 80 ? '...' : ''}
                                        </span>
                                        {rsDelta !== undefined && rsDelta !== 0 && (
                                            <span style={{
                                                fontFamily: 'var(--font-mono)',
                                                fontSize: 9,
                                                color: rsDelta > 0 ? '#00ff88' : '#ff6666',
                                                flexShrink: 0,
                                            }}>
                                                {rsDelta > 0 ? '+' : ''}{rsDelta.toFixed(1)}%
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Related tokens & projects */}
                {(signal.relatedTokens.length > 0 || signal.relatedProjects.length > 0) && (
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-dim)' }}>
                        {signal.relatedTokens.length > 0 && (
                            <div style={{ marginBottom: signal.relatedProjects.length > 0 ? 10 : 0 }}>
                                <div style={{
                                    fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)',
                                    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
                                }}>
                                    TOKENS
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {signal.relatedTokens.map(t => (
                                        <span key={t} style={{
                                            fontFamily: 'var(--font-mono)', fontSize: 11,
                                            border: '1px solid var(--border-dim)', padding: '2px 8px',
                                            color: 'var(--text-main)',
                                        }}>
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {signal.relatedProjects.length > 0 && (
                            <div>
                                <div style={{
                                    fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)',
                                    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
                                }}>
                                    PROJECTS
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {signal.relatedProjects.map(p => (
                                        <span key={p} style={{
                                            fontFamily: 'var(--font-mono)', fontSize: 11,
                                            border: '1px solid var(--border-dim)', padding: '2px 8px',
                                            color: 'var(--text-main)',
                                        }}>
                                            {p}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Related narrative */}
                {relatedNarrative && (
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-dim)' }}>
                        <div style={{
                            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)',
                            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
                        }}>
                            Feeds Into Narrative
                        </div>
                        <div style={{
                            padding: '10px 12px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-dim)',
                        }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-main)', marginBottom: 4 }}>
                                {relatedNarrative.name}
                            </div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                                Confidence: {relatedNarrative.confidence}% • {relatedNarrative.signals.length} signals
                            </div>
                        </div>
                    </div>
                )}

                {/* Source Link — use real sourceUrl if available, fall back to guessed URL */}
                {(() => {
                    const link = signal.sourceUrl
                        ? { url: signal.sourceUrl, label: sourceLink?.label || 'View Source' }
                        : sourceLink;
                    if (!link) return null;
                    return (
                        <div style={{ padding: '16px 20px' }}>
                            <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    padding: '10px 16px',
                                    background: 'var(--accent)',
                                    color: 'var(--text-dark)',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    textDecoration: 'none',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    transition: 'background 0.15s ease',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#e0ff44')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
                            >
                                ↗ {link.label}
                            </a>
                        </div>
                    );
                })()}

                {/* Timestamp */}
                <div style={{
                    padding: '12px 20px',
                    borderTop: '1px solid var(--border-dim)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginTop: 'auto',
                }}>
                    Captured: {new Date(signal.timestamp).toLocaleString()}
                </div>
            </div>

            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(-100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </>
    );
}
