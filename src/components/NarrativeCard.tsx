'use client';

import { Narrative, BuildIdea } from '@/lib/types';

interface NarrativeCardProps {
    narrative: Narrative;
    onSelect: () => void;
    isSelected: boolean;
    editionStatus?: 'new' | 'rising' | 'fading' | 'stable' | 'returning';
    confidenceDelta?: number;
    onIdeaSelect?: (idea: BuildIdea) => void;
    selectedIdeaId?: string | null;
}

function getTrendTag(trend: string, confidence: number): { label: string; className: string } {
    if (trend === 'rising' && confidence >= 70) return { label: 'Accelerating', className: 'n-tag' };
    if (trend === 'rising') return { label: 'Rising', className: 'n-tag' };
    if (trend === 'declining') return { label: 'Declining', className: 'n-tag n-tag-declining' };
    return { label: 'Emerging', className: 'n-tag n-tag-emerging' };
}

function getStatusBadge(status?: string): { label: string; color: string; bg: string } | null {
    if (!status) return null;
    switch (status) {
        case 'new': return { label: 'NEW', color: '#CCFF00', bg: 'rgba(204,255,0,0.12)' };
        case 'rising': return { label: 'RISING ↑', color: '#00ff88', bg: 'rgba(0,255,136,0.1)' };
        case 'fading': return { label: 'FADING ↓', color: '#ff6666', bg: 'rgba(255,102,102,0.1)' };
        case 'returning': return { label: 'RETURNING', color: '#66aaff', bg: 'rgba(102,170,255,0.1)' };
        case 'stable': return { label: 'STABLE', color: '#888888', bg: 'rgba(136,136,136,0.08)' };
        default: return null;
    }
}

export function NarrativeCard({ narrative, onSelect, isSelected, editionStatus, confidenceDelta, onIdeaSelect, selectedIdeaId }: NarrativeCardProps) {
    const tag = getTrendTag(narrative.trend, narrative.confidence);
    const statusBadge = getStatusBadge(editionStatus);

    return (
        <div
            className="narrative-card"
            onClick={onSelect}
            style={{
                cursor: 'pointer',
                borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
            }}
        >
            {/* Header */}
            <div className="n-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className={tag.className}>{tag.label}</span>
                    {statusBadge && (
                        <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            padding: '2px 6px',
                            background: statusBadge.bg,
                            color: statusBadge.color,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            border: `1px solid ${statusBadge.color}33`,
                        }}>
                            {statusBadge.label}
                        </span>
                    )}
                    {confidenceDelta !== undefined && confidenceDelta !== 0 && (
                        <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            color: confidenceDelta > 0 ? '#00ff88' : '#ff6666',
                        }}>
                            {confidenceDelta > 0 ? '▲' : '▼'}{Math.abs(confidenceDelta)}% vs last
                        </span>
                    )}
                </div>
                <span className="mono text-muted" style={{ fontSize: 11 }}>
                    ID: {narrative.id.substring(0, 8).toUpperCase()}
                </span>
            </div>

            {/* Title */}
            <h2 className="n-title">{narrative.name}</h2>

            {/* Evidence basis */}
            <div className="n-confidence">
                <span>BASED ON</span>
                <span className="text-accent" style={{ margin: '0 4px' }}>
                    {narrative.signals.length} signal{narrative.signals.length !== 1 ? 's' : ''}
                </span>
                <span>
                    from {[...new Set(narrative.signals.map(s => s.source))].map(src => {
                        const labels: Record<string, string> = {
                            market: 'Market', onchain: 'On-Chain', social: 'Social',
                            github: 'GitHub', 'defi-llama': 'DeFi',
                        };
                        return labels[src] || src;
                    }).join(', ') || '—'}
                </span>
            </div>

            {/* Description */}
            <p className="n-desc">{narrative.summary}</p>

            {/* AI Recommendation */}
            {narrative.recommendation && narrative.recommendation.thesis && (
                <div style={{
                    margin: '12px 0',
                    padding: '10px 12px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-dim)',
                    borderLeft: '2px solid var(--accent)',
                }}>
                    <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: 'var(--accent)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: 6,
                    }}>
                        RECOMMENDATION
                    </div>
                    <p style={{
                        fontSize: 12,
                        color: 'var(--text-main)',
                        lineHeight: 1.5,
                        fontStyle: 'italic',
                        marginBottom: narrative.recommendation.actionables.length > 0 ? 8 : 0,
                    }}>
                        {narrative.recommendation.thesis}
                    </p>
                    {narrative.recommendation.actionables.length > 0 && (
                        <ul style={{
                            margin: 0,
                            paddingLeft: 16,
                            listStyleType: '\'→ \'',
                        }}>
                            {narrative.recommendation.actionables.map((a, i) => (
                                <li key={i} style={{
                                    fontSize: 11,
                                    color: 'var(--text-main)',
                                    lineHeight: 1.5,
                                    marginBottom: 2,
                                }}>
                                    {a}
                                </li>
                            ))}
                        </ul>
                    )}
                    {narrative.recommendation.risks.length > 0 && (
                        <div style={{ marginTop: 6 }}>
                            {narrative.recommendation.risks.map((r, i) => (
                                <div key={i} style={{
                                    fontSize: 10,
                                    color: '#ff6666',
                                    fontFamily: 'var(--font-mono)',
                                    lineHeight: 1.4,
                                }}>
                                    ⚠ {r}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Idea Grid */}
            {narrative.ideas.length > 0 && (
                <div className="idea-grid">
                    {narrative.ideas.map((idea) => {
                        const isIdeaSelected = selectedIdeaId === idea.id;
                        return (
                            <div
                                key={idea.id}
                                className="idea-box"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onIdeaSelect?.(idea);
                                }}
                                style={{
                                    cursor: 'pointer',
                                    borderColor: isIdeaSelected ? 'var(--accent)' : undefined,
                                    background: isIdeaSelected ? 'rgba(204,255,0,0.06)' : undefined,
                                    transition: 'border-color 0.15s ease, background 0.15s ease',
                                }}
                            >
                                <h4>{idea.title}</h4>
                                <p>{idea.description}</p>
                                <div className="idea-meta">
                                    <span className="idea-tag">{idea.complexity}</span>
                                    <span className="idea-tag">{idea.impact} Impact</span>
                                    {idea.techStack.slice(0, 2).map(t => (
                                        <span key={t} className="idea-tag">{t}</span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
