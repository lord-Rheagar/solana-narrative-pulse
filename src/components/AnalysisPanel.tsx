'use client';

import { Narrative, Signal, BuildIdea } from '@/lib/types';

interface AnalysisPanelProps {
    selectedNarrative: Narrative | null;
    signals: Signal[];
    selectedIdea: BuildIdea | null;
    ideaDetailLoading?: boolean;
    onSignalClick: (signal: Signal) => void;
}

const SOURCE_EMOJI: Record<string, string> = {
    market: '📈',
    onchain: '⛓️',
    social: '💬',
    github: '🔧',
    'defi-llama': '🏦',
};

const SOURCE_COLORS: Record<string, string> = {
    market: '#3B82F6',
    onchain: '#06B6D4',
    social: '#10B981',
    github: '#8B5CF6',
    'defi-llama': '#F59E0B',
};

export function AnalysisPanel({ selectedNarrative, signals, selectedIdea, ideaDetailLoading, onSignalClick }: AnalysisPanelProps) {
    // Resolve supporting signals for the selected idea
    const supportingSignals: Signal[] = selectedIdea
        ? (selectedIdea.supportingSignalIds || [])
            .map(id => signals.find(s => s.id === id))
            .filter((s): s is Signal => !!s)
        : [];

    // Fallback: if no signals matched by ID, try the narrative's signals
    const fallbackSignals = supportingSignals.length === 0 && selectedIdea && selectedNarrative
        ? selectedNarrative.signals.slice(0, 4)
        : [];

    const displaySignals = supportingSignals.length > 0 ? supportingSignals : fallbackSignals;

    return (
        <aside className="analysis-panel">
            {selectedIdea ? (
                <div key={selectedIdea.id} className="panel-content-enter">
                    {/* Selected idea header */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            color: 'var(--accent)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: 8,
                        }}>
                            SELECTED IDEA
                        </div>
                        <h3 style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: 'var(--text-main)',
                            lineHeight: 1.4,
                            marginBottom: 6,
                        }}>
                            {selectedIdea.title}
                        </h3>
                        <div style={{
                            display: 'flex',
                            gap: 6,
                            flexWrap: 'wrap',
                            marginBottom: 8,
                        }}>
                            <span style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 10,
                                padding: '2px 6px',
                                border: '1px solid var(--border-dim)',
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                            }}>
                                {selectedIdea.complexity}
                            </span>
                            <span style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 10,
                                padding: '2px 6px',
                                border: '1px solid var(--border-dim)',
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                            }}>
                                {selectedIdea.impact} Impact
                            </span>
                        </div>
                    </div>

                    {/* Problem to Solve / Possible Solution — lazy loaded */}
                    {ideaDetailLoading && !selectedIdea.problemToSolve ? (
                        <div className="detail-loading-skeleton">
                            <div style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 10,
                                color: 'var(--accent)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: 8,
                            }}>
                                GENERATING IDEA BRIEF...
                            </div>
                            <div className="skeleton-pulse" style={{ height: 60, marginBottom: 12 }} />
                            <div className="skeleton-pulse" style={{ height: 60 }} />
                        </div>
                    ) : (
                        <>
                            {/* Problem to Solve */}
                            {selectedIdea.problemToSolve && (
                                <div className="detail-fade-in" style={{ marginBottom: 16 }}>
                                    <div style={{
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: 10,
                                        color: 'var(--accent)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        marginBottom: 8,
                                    }}>
                                        PROBLEM TO SOLVE
                                    </div>
                                    <div style={{
                                        fontSize: 12,
                                        color: 'var(--text-main)',
                                        lineHeight: 1.6,
                                        padding: '10px 12px',
                                        background: 'var(--bg-surface)',
                                        border: '1px solid var(--border-dim)',
                                        borderLeft: '2px solid #ff6666',
                                    }}>
                                        {selectedIdea.problemToSolve.split('\n').filter(p => p.trim()).map((paragraph, i, arr) => (
                                            <p key={i} style={{
                                                marginBottom: i < arr.length - 1 ? 8 : 0,
                                            }}>
                                                {paragraph}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Possible Solution */}
                            {selectedIdea.possibleSolution && (
                                <div className="detail-fade-in" style={{ marginBottom: 16 }}>
                                    <div style={{
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: 10,
                                        color: 'var(--accent)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        marginBottom: 8,
                                    }}>
                                        POSSIBLE SOLUTION
                                    </div>
                                    <div style={{
                                        fontSize: 12,
                                        color: 'var(--text-main)',
                                        lineHeight: 1.6,
                                        padding: '10px 12px',
                                        background: 'var(--bg-surface)',
                                        border: '1px solid var(--border-dim)',
                                        borderLeft: '2px solid #00ff88',
                                    }}>
                                        {selectedIdea.possibleSolution.split('\n').filter(p => p.trim()).map((paragraph, i, arr) => (
                                            <p key={i} style={{
                                                marginBottom: i < arr.length - 1 ? 8 : 0,
                                            }}>
                                                {paragraph}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Supporting Signals */}
                    <div className="section-header" style={{ paddingLeft: 0 }}>
                        <span>
                            Supporting Signals ({displaySignals.length})
                        </span>
                    </div>

                    {displaySignals.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {displaySignals.map(signal => {
                                const emoji = SOURCE_EMOJI[signal.source] || '📊';
                                const color = SOURCE_COLORS[signal.source] || '#888';
                                const relevance = selectedIdea.signalRelevance?.[signal.id];

                                return (
                                    <div
                                        key={signal.id}
                                        onClick={() => onSignalClick(signal)}
                                        style={{
                                            padding: '10px 12px',
                                            background: 'var(--bg-surface)',
                                            border: '1px solid var(--border-dim)',
                                            cursor: 'pointer',
                                            transition: 'border-color 0.15s ease',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-dim)')}
                                    >
                                        {/* Signal header */}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            marginBottom: 6,
                                        }}>
                                            <span style={{ fontSize: 14 }}>{emoji}</span>
                                            <span style={{
                                                fontFamily: 'var(--font-mono)',
                                                fontSize: 10,
                                                color: color,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                            }}>
                                                {signal.source}
                                            </span>
                                            {signal.delta !== 0 && (
                                                <span style={{
                                                    fontFamily: 'var(--font-mono)',
                                                    fontSize: 10,
                                                    color: signal.delta > 0 ? '#00ff88' : '#ff6666',
                                                    marginLeft: 'auto',
                                                }}>
                                                    {signal.delta > 0 ? '+' : ''}{signal.delta.toFixed(1)}%
                                                </span>
                                            )}
                                        </div>

                                        {/* Signal description */}
                                        <div style={{
                                            fontSize: 12,
                                            color: 'var(--text-main)',
                                            lineHeight: 1.4,
                                            marginBottom: relevance ? 8 : 0,
                                        }}>
                                            {signal.description.length > 80
                                                ? signal.description.slice(0, 80) + '...'
                                                : signal.description}
                                        </div>

                                        {/* Relevance explanation */}
                                        {relevance && (
                                            <div style={{
                                                fontSize: 11,
                                                color: 'var(--accent)',
                                                lineHeight: 1.4,
                                                borderLeft: '2px solid var(--accent)',
                                                paddingLeft: 8,
                                                opacity: 0.9,
                                            }}>
                                                {relevance}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{
                            padding: '16px 12px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                            color: 'var(--text-muted)',
                            textAlign: 'center',
                            border: '1px solid var(--border-dim)',
                            background: 'var(--bg-surface)',
                        }}>
                            No signal mapping available for this idea.
                            <br />
                            Run detection again to generate signal-to-idea links.
                        </div>
                    )}

                    {/* Tech stack */}
                    {selectedIdea.techStack.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                            <div style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 10,
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: 8,
                            }}>
                                TECH STACK
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {selectedIdea.techStack.map(t => (
                                    <span key={t} style={{
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: 10,
                                        padding: '3px 8px',
                                        border: '1px solid var(--border-dim)',
                                        color: 'var(--text-main)',
                                        background: 'var(--bg-surface)',
                                    }}>
                                        {t}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Solana features */}
                    {selectedIdea.solanaFeatures.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                            <div style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 10,
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: 8,
                            }}>
                                SOLANA FEATURES
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {selectedIdea.solanaFeatures.map(f => (
                                    <span key={f} style={{
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: 10,
                                        padding: '3px 8px',
                                        border: '1px solid var(--accent)',
                                        color: 'var(--accent)',
                                        background: 'rgba(204,255,0,0.06)',
                                    }}>
                                        {f}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* Empty state — no idea selected */
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    minHeight: 200,
                    padding: '40px 20px',
                    textAlign: 'center',
                }}>
                    <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 28,
                        color: 'var(--border-dim)',
                        marginBottom: 16,
                    }}>
                        [→]
                    </div>
                    <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        lineHeight: 1.6,
                    }}>
                        {selectedNarrative
                            ? 'Click an idea in the narrative card to see its supporting signals here.'
                            : 'Run detection and select an idea to explore its supporting signals.'}
                    </div>
                </div>
            )}
        </aside>
    );
}
