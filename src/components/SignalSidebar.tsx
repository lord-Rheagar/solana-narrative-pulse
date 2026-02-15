'use client';

import { Signal } from '@/lib/types';
import { useEffect, useRef, useState, useCallback } from 'react';

interface SignalSidebarProps {
    signals: Signal[];
    loading: boolean;
    loadingStep: string;
    onSignalClick?: (signal: Signal) => void;
    isPanelOpen?: boolean;
}

function getSourceLabel(source: string): string {
    return source.toUpperCase();
}

function getCategoryLabel(signal: Signal): string {
    if (signal.relatedTokens.length > 0) return signal.relatedTokens[0].toUpperCase();
    if (signal.relatedProjects.length > 0) return signal.relatedProjects[0].toUpperCase();
    return signal.category.toUpperCase();
}

function formatDelta(signal: Signal): string {
    if (signal.delta !== 0) {
        return `${signal.delta > 0 ? '+' : ''}${signal.delta.toFixed(0)}%`;
    }
    if (signal.strength >= 80) return 'High';
    if (signal.strength >= 50) return 'Med';
    return '';
}

function getStrengthColor(strength: number): string {
    if (strength >= 80) return '#ff4444';
    if (strength >= 60) return 'var(--accent)';
    if (strength >= 40) return '#888';
    return '#444';
}

// Source filter tabs
const SOURCE_FILTERS = ['ALL', 'MARKET', 'GITHUB', 'ONCHAIN', 'SOCIAL', 'DEFI-LLAMA'] as const;
type SourceFilter = typeof SOURCE_FILTERS[number];

export function SignalSidebar({ signals, loading, loadingStep, onSignalClick, isPanelOpen }: SignalSidebarProps) {
    const feedRef = useRef<HTMLDivElement>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [activeFilter, setActiveFilter] = useState<SourceFilter>('ALL');
    const animationRef = useRef<number | null>(null);
    const scrollSpeedRef = useRef(0.5); // pixels per frame

    // Sort by strength descending, show ALL signals (no slice)
    const filteredSignals = [...signals]
        .filter(s => s.strength > 20) // lower threshold to show more
        .filter(s => activeFilter === 'ALL' || s.source.toUpperCase() === activeFilter)
        .sort((a, b) => b.strength - a.strength);

    // Auto-scroll logic
    const shouldScroll = !isHovered && !isPanelOpen && filteredSignals.length > 10;

    const autoScroll = useCallback(() => {
        const feed = feedRef.current;
        if (!feed) return;

        feed.scrollTop += scrollSpeedRef.current;

        // Loop back to top when reaching the bottom
        if (feed.scrollTop >= feed.scrollHeight - feed.clientHeight - 1) {
            // Smooth reset: jump to top after a brief pause
            setTimeout(() => {
                if (feedRef.current) {
                    feedRef.current.scrollTop = 0;
                }
            }, 1500);
        }

        animationRef.current = requestAnimationFrame(autoScroll);
    }, []);

    useEffect(() => {
        if (shouldScroll) {
            animationRef.current = requestAnimationFrame(autoScroll);
        } else {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [shouldScroll, autoScroll]);

    // Count by source for filter badges
    const sourceCounts: Record<string, number> = {};
    signals.forEach(s => {
        const key = s.source.toUpperCase();
        sourceCounts[key] = (sourceCounts[key] || 0) + 1;
    });

    return (
        <aside className="sidebar">
            {/* Signal count header */}
            <div className="section-header">
                <span>Signal Feed</span>
                <span className="text-accent" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    [{filteredSignals.length}/{signals.length}]
                </span>
            </div>

            {/* Source filter tabs */}
            <div className="signal-filter-bar">
                {SOURCE_FILTERS.map(filter => (
                    <button
                        key={filter}
                        className={`signal-filter-tab ${activeFilter === filter ? 'active' : ''}`}
                        onClick={() => setActiveFilter(filter)}
                    >
                        {filter === 'ALL' ? `ALL` : filter.slice(0, 3)}
                    </button>
                ))}
            </div>

            {/* Loading indicator */}
            {loading && (
                <div className="loading-step">
                    {loadingStep}
                </div>
            )}

            {/* Scrollable signal feed */}
            <div
                ref={feedRef}
                className="signal-feed"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {filteredSignals.map((signal, i) => (
                    <div
                        key={`${signal.id}-${i}`}
                        className="signal-item"
                        onClick={() => onSignalClick?.(signal)}
                        style={{ cursor: onSignalClick ? 'pointer' : 'default' }}
                    >
                        <div className="signal-meta">
                            <span>{getSourceLabel(signal.source)}</span>
                            <span>{getCategoryLabel(signal)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            <span className="signal-value" style={{ flex: 1 }}>
                                {signal.description.length > 38
                                    ? signal.description.substring(0, 38) + '…'
                                    : signal.description}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                {/* Strength dot */}
                                <span style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    background: getStrengthColor(signal.strength),
                                    display: 'inline-block',
                                }} />
                                {formatDelta(signal) && (
                                    <span className="signal-value signal-delta">{formatDelta(signal)}</span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Empty state */}
                {filteredSignals.length === 0 && !loading && (
                    <div className="signal-item" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                        {signals.length === 0
                            ? 'No signals detected yet. Click Detect to scan.'
                            : `No ${activeFilter} signals found.`}
                    </div>
                )}
            </div>

            {/* Auto-scroll indicator */}
            {shouldScroll && (
                <div className="scroll-indicator">
                    <span>▼ AUTO-SCROLL</span>
                    <span style={{ opacity: 0.5 }}>hover to pause</span>
                </div>
            )}
            {(isHovered || isPanelOpen) && filteredSignals.length > 10 && (
                <div className="scroll-indicator paused">
                    <span>⏸ PAUSED</span>
                </div>
            )}

            {/* System Status */}
            <div className="section-header" style={{ marginTop: 'auto' }}>
                <span>System Status</span>
            </div>
            <div className="signal-item" style={{ borderBottom: 'none' }}>
                <div className="signal-meta">
                    <span>SIGNALS</span>
                    <span>{signals.length} total</span>
                </div>
                <div className="signal-meta" style={{ marginTop: 4 }}>
                    <span>SOURCES</span>
                    <span>{new Set(signals.map(s => s.source)).size} active</span>
                </div>
            </div>
        </aside>
    );
}
