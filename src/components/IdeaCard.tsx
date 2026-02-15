'use client';

import { BuildIdea } from '@/lib/types';
import { Layers, Zap, ArrowUpRight, Clock, Users } from 'lucide-react';

type Persona = 'builder' | 'investor' | 'ecosystem';

interface IdeaCardProps {
    idea: BuildIdea;
    index: number;
    persona?: Persona;
    narrativeName?: string;
}

// Estimate MVP time from complexity
function mvpEstimate(complexity: string): string {
    switch (complexity.toLowerCase()) {
        case 'low': return '~2 weeks';
        case 'medium': return '~4 weeks';
        case 'high': return '~8 weeks';
        default: return '~4 weeks';
    }
}

// Persona fit
function personaFit(idea: BuildIdea, persona: Persona): { label: string; match: boolean } {
    if (persona === 'builder') {
        return { label: '🛠 Build This', match: true };
    }
    if (persona === 'investor') {
        return idea.impact === 'High'
            ? { label: '📊 Fund This Thesis', match: true }
            : { label: '📊 Watch', match: false };
    }
    // ecosystem
    return idea.impact !== 'Low'
        ? { label: '🌐 Grant Opportunity', match: true }
        : { label: '🌐 Low Priority', match: false };
}

export function IdeaCard({ idea, index, persona = 'builder', narrativeName }: IdeaCardProps) {
    const complexityClass = `complexity-${idea.complexity.toLowerCase()}`;
    const fit = personaFit(idea, persona);
    const estimate = mvpEstimate(idea.complexity);

    return (
        <div className="p-4 rounded-xl" style={{
            background: 'var(--gradient-card)',
            border: `1px solid ${fit.match ? 'rgba(139, 92, 246, 0.15)' : 'var(--glass-border)'}`,
            transition: 'all 0.2s ease',
            opacity: fit.match ? 1 : 0.7,
        }}>
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
                <h5 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {idea.title}
                </h5>
                <ArrowUpRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
            </div>

            {/* Why Now? */}
            {(idea.whyNow || narrativeName) && (
                <p className="text-[11px] mb-2.5 italic" style={{
                    color: 'var(--accent-cyan)',
                    lineHeight: 1.5,
                    borderLeft: '2px solid rgba(6, 182, 212, 0.3)',
                    paddingLeft: 8,
                }}>
                    Why now: {idea.whyNow || `${idea.description.split('.')[0]}.`}
                </p>
            )}

            {/* Description */}
            <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {idea.description}
            </p>

            {/* Target User */}
            {idea.targetUser && (
                <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    <span style={{ color: 'var(--accent-purple)', fontWeight: 600 }}>Target user:</span> {idea.targetUser}
                </p>
            )}

            {/* Badges Row */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold ${complexityClass}`}>
                    <Layers size={10} /> {idea.complexity}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold"
                    style={{
                        background: idea.impact === 'High' ? 'rgba(139, 92, 246, 0.15)' :
                            idea.impact === 'Medium' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(107, 107, 128, 0.15)',
                        color: idea.impact === 'High' ? 'var(--accent-purple)' :
                            idea.impact === 'Medium' ? 'var(--accent-blue)' : 'var(--text-muted)',
                    }}>
                    <Zap size={10} /> {idea.impact} Impact
                </span>

                {/* MVP Time */}
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold"
                    style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' }}>
                    <Clock size={10} /> {estimate}
                </span>

                {/* Persona Fit */}
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold`}
                    style={{
                        background: fit.match ? 'rgba(16, 185, 129, 0.12)' : 'rgba(107, 107, 128, 0.08)',
                        color: fit.match ? 'var(--accent-green)' : 'var(--text-muted)',
                    }}>
                    <Users size={10} /> {fit.label}
                </span>
            </div>

            {/* Tech Stack */}
            <div className="flex flex-wrap gap-1 mb-2">
                {idea.techStack.map(tech => (
                    <span key={tech} className="tag-cyan tag text-[10px]">{tech}</span>
                ))}
            </div>

            {/* Solana Features */}
            {idea.solanaFeatures.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {idea.solanaFeatures.map(feature => (
                        <span key={feature} className="tag-green tag text-[10px]">{feature}</span>
                    ))}
                </div>
            )}
        </div>
    );
}
