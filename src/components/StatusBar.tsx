'use client';

import { Signal } from '@/lib/types';

interface StatusBarProps {
    signals: Signal[];
}

export function StatusBar({ signals }: StatusBarProps) {
    // Extract ticker data from signals
    const tpsSignal = signals.find(s => s.id === 'onchain-tps' || s.id === 'onchain-tps-current');
    const newPrograms = signals.filter(s => s.category === 'New Programs').reduce((sum, s) => sum + s.value, 0);
    const whaleCount = signals.filter(s => s.category === 'Whale Movement').length;

    // Get trending tokens/topics
    const trending = signals
        .filter(s => s.source === 'market' && s.strength > 60)
        .slice(0, 3)
        .map(s => s.relatedTokens[0] || s.category)
        .filter(Boolean);

    const tps = tpsSignal ? Math.round(tpsSignal.value).toLocaleString() : '---';
    const tpsDelta = tpsSignal && tpsSignal.delta !== 0
        ? `(${tpsSignal.delta > 0 ? '+' : ''}${tpsSignal.delta.toFixed(1)}%)`
        : '';

    // Build ticker items (duplicated for seamless loop)
    const tickerData = [
        { label: 'TPS', value: tps, highlight: tpsDelta },
        { label: 'NEW PROGRAMS (24H)', value: `${newPrograms}`, highlight: '' },
        { label: 'ACTIVE WHALES', value: `${whaleCount}`, highlight: whaleCount > 0 ? 'TRACKING' : '' },
        { label: 'DEV ACTIVITY', value: '', highlight: signals.filter(s => s.source === 'github').length > 3 ? 'HIGH' : 'NORMAL' },
        ...trending.map(t => ({ label: 'TRENDING', value: '', highlight: t.toUpperCase() })),
        { label: 'SIGNALS', value: `${signals.length}`, highlight: 'ACTIVE' },
    ];

    return (
        <footer className="bottom-bar">
            <div className="system-status">
                SYSTEM: <span style={{ color: 'var(--accent)' }}>ONLINE</span>
            </div>
            <div className="ticker-wrap">
                <div className="ticker">
                    {/* Render twice for seamless loop */}
                    {[...tickerData, ...tickerData].map((item, i) => (
                        <div key={i} className="ticker-item">
                            {item.label}: {item.value && <span className="ticker-val">{item.value}</span>}
                            {item.highlight && (
                                <>
                                    {item.value ? ' ' : ''}
                                    <span className="ticker-up">{item.highlight}</span>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </footer>
    );
}
