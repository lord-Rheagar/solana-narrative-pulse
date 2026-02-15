'use client';

import { Signal } from '@/lib/types';
import { Activity, Box, Target, Clock } from 'lucide-react';

interface OnChainTickerProps {
    signals: Signal[];
}

const BASELINE_TPS = 2800;

export function OnChainTicker({ signals }: OnChainTickerProps) {
    // Extract key metrics
    const tpsSignal = signals.find(s => s.id === 'onchain-tps' || s.id === 'onchain-tps-current');
    const epochSignal = signals.find(s => s.id === 'onchain-epoch' || s.id === 'onchain-epoch-info');

    const newProgramsCount = signals
        .filter(s => s.category === 'New Programs')
        .reduce((sum, s) => sum + s.value, 0);

    const activeWhalesCount = signals
        .filter(s => s.category === 'Whale Movement')
        .length;

    // TPS with trend vs baseline
    const tpsValue = tpsSignal ? Math.round(tpsSignal.value) : 0;
    const tpsDelta = tpsValue > 0 ? ((tpsValue - BASELINE_TPS) / BASELINE_TPS * 100).toFixed(0) : null;
    const tpsUp = tpsDelta !== null && Number(tpsDelta) > 0;
    const isTpsSpike = tpsSignal?.description.includes('SPIKE') || false;

    const epochProgress = epochSignal ? epochSignal.delta : 0;
    const epochNumber = epochSignal ? epochSignal.value : 0;

    const items = [
        {
            icon: <Activity size={12} />,
            label: 'TPS',
            value: tpsValue > 0 ? tpsValue.toLocaleString() : '---',
            trend: tpsDelta !== null ? `${tpsUp ? '↑' : '↓'}${Math.abs(Number(tpsDelta))}%` : null,
            trendUp: tpsUp,
            alert: isTpsSpike,
        },
        {
            icon: <Box size={12} />,
            label: 'Programs',
            value: `${newProgramsCount}`,
            trend: '24h',
            trendUp: newProgramsCount > 5,
            alert: false,
        },
        {
            icon: <Target size={12} />,
            label: 'Whales',
            value: `${activeWhalesCount}`,
            trend: 'active',
            trendUp: activeWhalesCount > 0,
            alert: activeWhalesCount > 3,
        },
        {
            icon: <Clock size={12} />,
            label: `Epoch ${epochNumber || '---'}`,
            value: `${epochProgress}%`,
            trend: null,
            trendUp: false,
            alert: false,
        },
    ];

    return (
        <div className="status-bar">
            <div className="status-bar-inner">
                {/* Pulse Indicator */}
                <div className="flex items-center gap-2 mr-1">
                    <div className="pulse-dot" style={{ width: 6, height: 6 }} />
                    <span className="status-bar-label" style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                        LIVE
                    </span>
                </div>

                {/* Divider */}
                <div className="status-bar-divider" />

                {/* Metrics */}
                {items.map((item, i) => (
                    <div key={i} className="status-bar-item">
                        <span className="status-bar-icon" style={{ color: item.alert ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                            {item.icon}
                        </span>
                        <span className="status-bar-label">{item.label}:</span>
                        <span className={`status-bar-value ${item.alert ? 'status-alert' : ''}`}>
                            {item.value}
                        </span>
                        {item.trend && (
                            <span className={`status-bar-trend ${item.trendUp ? 'trend-up' : 'trend-down'}`}>
                                {item.trend}
                            </span>
                        )}
                        {i < items.length - 1 && <div className="status-bar-divider" />}
                    </div>
                ))}

                {/* Signal Count */}
                <div className="status-bar-divider" />
                <span className="status-bar-label" style={{ color: 'var(--text-muted)' }}>
                    {signals.length} signals
                </span>
            </div>
        </div>
    );
}
