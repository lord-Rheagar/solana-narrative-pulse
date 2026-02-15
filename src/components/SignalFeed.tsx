'use client';

import { useState } from 'react';
import { Signal } from '@/lib/types';
import {
    BarChart3, GitBranch, Zap, Globe, Box, Target,
    Activity, Terminal, Twitter, Newspaper, MessageSquare, Search
} from 'lucide-react';

interface SignalFeedProps {
    signals: Signal[];
}

type SourceFilter = 'all' | 'market' | 'github' | 'onchain' | 'social' | 'defi-llama';

const FILTER_LABELS: Record<SourceFilter, string> = {
    all: 'All',
    market: '📊 Market',
    github: '🔧 GitHub',
    onchain: '⛓ On-Chain',
    social: '📣 Social',
    'defi-llama': '🏦 DeFi Llama',
};

const getIconForSignal = (s: Signal) => {
    if (s.source === 'social') {
        if (s.category === 'KOL Signal') return <Twitter size={13} />;
        if (s.category === 'X Trend') return <MessageSquare size={13} />;
        return <Newspaper size={13} />;
    }
    if (s.source === 'onchain') {
        if (s.category === 'New Programs') return <Box size={13} />;
        if (s.category.includes('Whale')) return <Target size={13} />;
        if (s.category.includes('Spike')) return <Activity size={13} />;
        if (s.id.includes('program')) return <Terminal size={13} />;
        return <Zap size={13} />;
    }
    if (s.source === 'market') return <BarChart3 size={13} />;
    if (s.source === 'github') return <GitBranch size={13} />;
    if (s.source === 'defi-llama') return <BarChart3 size={13} />;
    return <Globe size={13} />;
};

const getColorForSignal = (s: Signal) => {
    if (s.strength >= 80) return 'var(--accent-red)';
    if (s.source === 'social') return 'var(--accent-green)';
    if (s.source === 'onchain') return 'var(--accent-cyan)';
    if (s.source === 'market') return 'var(--accent-blue)';
    if (s.source === 'github') return 'var(--accent-purple)';
    if (s.source === 'defi-llama') return 'var(--accent-blue)';
    return 'var(--text-muted)';
};

export function SignalFeed({ signals }: SignalFeedProps) {
    const [filter, setFilter] = useState<SourceFilter>('all');
    const [search, setSearch] = useState('');

    if (signals.length === 0) return null;

    // Apply filters
    let filtered = signals.filter(s => s.strength > 20);
    if (filter !== 'all') {
        filtered = filtered.filter(s => s.source === filter);
    }
    if (search.trim()) {
        const q = search.toLowerCase();
        filtered = filtered.filter(s =>
            s.description.toLowerCase().includes(q) ||
            s.category.toLowerCase().includes(q) ||
            s.relatedTokens.some(t => t.toLowerCase().includes(q))
        );
    }

    // Source counts for filter badges
    const sourceCounts = signals.reduce((acc, s) => {
        acc[s.source] = (acc[s.source] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="glass-card p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Activity size={16} style={{ color: 'var(--accent-purple)' }} />
                    Signal Explorer
                    <span className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>
                        {filtered.length} of {signals.length}
                    </span>
                </h3>
            </div>

            {/* Search + Filters */}
            <div className="mb-4 flex flex-col gap-3">
                {/* Search */}
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search signals..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full text-xs rounded-lg py-2.5 pl-9 pr-3"
                        style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid var(--glass-border)',
                            color: 'var(--text-primary)',
                            outline: 'none',
                        }}
                    />
                </div>

                {/* Filter buttons */}
                <div className="filter-bar">
                    {(Object.keys(FILTER_LABELS) as SourceFilter[]).map(f => (
                        <button
                            key={f}
                            className={`filter-btn ${filter === f ? 'active' : ''}`}
                            onClick={e => { e.stopPropagation(); setFilter(f); }}
                        >
                            {FILTER_LABELS[f]}
                            {f !== 'all' && sourceCounts[f] ? ` (${sourceCounts[f]})` : ''}
                        </button>
                    ))}
                </div>
            </div>

            {/* Signal List */}
            <div className="flex flex-col gap-1.5 max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
                {filtered.slice(0, 25).map((signal, i) => {
                    const icon = getIconForSignal(signal);
                    const color = getColorForSignal(signal);
                    const isHot = signal.strength >= 75;

                    return (
                        <div key={`${signal.id}-${i}`}
                            className={`group flex items-start gap-3 p-3 rounded-lg transition-all border border-transparent hover:border-white/10 ${isHot ? 'bg-red-500/5' : 'bg-white/[0.02]'}`}
                        >
                            <div className="mt-0.5 p-1.5 rounded-md bg-black/40" style={{ color }}>
                                {icon}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start gap-2">
                                    <p className="text-xs font-medium leading-relaxed text-gray-200 group-hover:text-white transition-colors">
                                        {signal.description.split(' — ')[0]}
                                    </p>
                                    <span className="text-[10px] font-mono opacity-60 whitespace-nowrap">
                                        {Math.round(signal.strength)}%
                                    </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/30 text-gray-400 border border-white/5">
                                        {signal.category}
                                    </span>

                                    {signal.delta !== 0 && (
                                        <span className={`text-[10px] font-semibold ${signal.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {signal.delta > 0 ? '↑' : '↓'} {Math.abs(signal.delta).toFixed(1)}%
                                        </span>
                                    )}

                                    {signal.relatedTokens.length > 0 && (
                                        <span className="text-[10px] text-gray-500">
                                            {signal.relatedTokens.slice(0, 3).join(', ')}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {filtered.length === 0 && (
                    <div className="text-center py-6 text-xs" style={{ color: 'var(--text-muted)' }}>
                        No signals match your filters
                    </div>
                )}
            </div>
        </div>
    );
}
