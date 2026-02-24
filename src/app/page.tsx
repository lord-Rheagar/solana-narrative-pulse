'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Narrative, Signal, BuildIdea } from '@/lib/types';
import { TopBar } from '@/components/TopBar';
import { SignalSidebar } from '@/components/SignalSidebar';
import { NarrativeCard } from '@/components/NarrativeCard';
import { AnalysisPanel } from '@/components/AnalysisPanel';
import { StatusBar } from '@/components/StatusBar';
import { SignalDetailPanel } from '@/components/SignalDetailPanel';

const SIGNAL_STEPS = [
  'Fetching market data...',
  'Scanning GitHub activity...',
  'Analyzing on-chain signals...',
  'Scraping social feeds...',
  'Querying DeFi Llama...',
];

const NARRATIVE_STEPS = [
  'Clustering signal patterns...',
  'Detecting narratives with GPT-4o-mini...',
  'Generating ideas with Claude Sonnet...',
];

const LOADING_STEPS = [...SIGNAL_STEPS, ...NARRATIVE_STEPS];

interface NarrativeStatus {
  slug: string;
  status: 'new' | 'rising' | 'fading' | 'stable' | 'returning';
  confidenceDelta: number;
}

export default function DashboardPage() {
  const [narratives, setNarratives] = useState<Narrative[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [ideasOnlyLoading, setIdeasOnlyLoading] = useState(false);
  const [selectedNarrativeIndex, setSelectedNarrativeIndex] = useState(0);
  const [narrativeStatuses, setNarrativeStatuses] = useState<NarrativeStatus[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [selectedIdea, setSelectedIdea] = useState<BuildIdea | null>(null);
  const [ideaDetailLoading, setIdeaDetailLoading] = useState(false);

  // Cache deep-dive results by idea ID so re-clicking is instant
  const ideaDetailCache = useRef<Map<string, { problemToSolve: string; possibleSolution: string }>>(new Map());

  // Per-session dedup: track idea titles the user has already seen this session
  const seenIdeaTitles = useRef<string[]>([]);

  // Fetch deep-dive on demand when an idea is selected
  const fetchIdeaDetail = useCallback(async (idea: BuildIdea) => {
    // Already cached?
    const cached = ideaDetailCache.current.get(idea.id);
    if (cached) {
      setSelectedIdea({ ...idea, ...cached });
      return;
    }

    // Already has detail from a previous fetch this session?
    if (idea.problemToSolve && idea.possibleSolution) {
      setSelectedIdea(idea);
      return;
    }

    // Find the narrative this idea belongs to
    const narrative = narratives.find(n => n.id === idea.narrativeId);
    if (!narrative) {
      setSelectedIdea(idea);
      return;
    }

    setSelectedIdea(idea);
    setIdeaDetailLoading(true);

    try {
      const res = await fetch('/api/idea-detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: {
            title: idea.title,
            description: idea.description,
            techStack: idea.techStack,
            whyNow: idea.whyNow,
            targetUser: idea.targetUser,
            solanaFeatures: idea.solanaFeatures,
          },
          narrative: {
            name: narrative.name,
            summary: narrative.summary,
            signals: narrative.signals.slice(0, 10),
          },
        }),
      });
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const json = await res.json();
      if (json.success && json.data) {
        const detail = json.data as { problemToSolve: string; possibleSolution: string };
        ideaDetailCache.current.set(idea.id, detail);
        // Only update if this idea is still selected
        setSelectedIdea(prev => prev?.id === idea.id ? { ...prev, ...detail } : prev);
      }
    } catch (err) {
      console.error('Failed to fetch idea detail:', err);
    } finally {
      setIdeaDetailLoading(false);
    }
  }, [narratives]);

  // ESC key handler for signal panel
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedSignal(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // ── Accumulate seen idea titles from a narratives response ──
  function accumulateSeenTitles(newNarratives: any[]) {
    const newTitles = newNarratives.flatMap((n: any) =>
      (n.ideas || []).map((idea: any) => idea.title)
    );
    seenIdeaTitles.current = [...new Set([...seenIdeaTitles.current, ...newTitles])];
  }

  // ── Ideas-only refresh: reuse narratives, regenerate ideas ──
  async function regenerateIdeasOnly() {
    setLoading(true);
    setIdeasOnlyLoading(true);
    setError(null);
    setSelectedIdea(null);

    try {
      const res = await fetch('/api/regenerate-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          narratives,
          previousIdeaTitles: seenIdeaTitles.current,
        }),
      });
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      let json: any;
      try {
        json = await res.json();
      } catch {
        throw new Error('Server returned an invalid response. Please try again.');
      }

      if (json.success) {
        const newNarratives = json.data.narratives || [];
        setNarratives(newNarratives);
        setLastUpdated(new Date().toLocaleTimeString());
        setSelectedNarrativeIndex(0);
        accumulateSeenTitles(newNarratives);
      } else {
        setError(json.error || 'Failed to regenerate ideas');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
      setIdeasOnlyLoading(false);
    }
  }

  // ── Full pipeline: signals → narratives → ideas (1st run) ──
  async function detectNarratives() {
    // 2nd+ run with existing narratives: skip to ideas-only
    if (narratives.length > 0 && seenIdeaTitles.current.length > 0) {
      return regenerateIdeasOnly();
    }

    setLoading(true);
    setError(null);
    setLoadingStep(0);

    // Phase 1 progress: signal collection steps
    const signalInterval = setInterval(() => {
      setLoadingStep(prev => (prev < SIGNAL_STEPS.length - 1 ? prev + 1 : prev));
    }, 1500);

    try {
      // ── Phase 1: Fetch signals (fast, ~3-5s) ──────────────
      const sigRes = await fetch('/api/signals');
      if (!sigRes.ok) throw new Error(`Signal fetch failed (${sigRes.status})`);
      let sigJson: any;
      try {
        sigJson = await sigRes.json();
      } catch {
        throw new Error('Signal API returned an invalid response. Please try again.');
      }

      clearInterval(signalInterval);

      if (sigJson.success && sigJson.data.signals?.length > 0) {
        setSignals(sigJson.data.signals);
      }

      // ── Phase 2: Run narrative detection (uses cached signals) ──
      setLoadingStep(SIGNAL_STEPS.length); // jump to "Clustering..."

      const narrativeInterval = setInterval(() => {
        setLoadingStep(prev => {
          const maxStep = LOADING_STEPS.length - 1;
          return prev < maxStep ? prev + 1 : prev;
        });
      }, 3000);

      try {
        const res = await fetch('/api/narratives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signals: sigJson.data.signals,
            previousIdeaTitles: seenIdeaTitles.current,
          }),
        });
        if (!res.ok) throw new Error(`Narrative detection failed (${res.status})`);

        // Read the SSE stream
        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response stream');

        const decoder = new TextDecoder();
        let buffer = '';
        let resultData: any = null;
        let errorMsg: string | null = null;
        let eventType = ''; // Persist across chunks!
        let rawText = ''; // Accumulate all text for fallback parsing

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          rawText += chunk;

          // Parse SSE events — split on double newline (event boundary)
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || ''; // Keep incomplete event in buffer

          for (const part of parts) {
            const lines = part.split('\n');
            for (const rawLine of lines) {
              const line = rawLine.replace(/\r$/, ''); // Handle \r\n
              if (line.startsWith('event: ')) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (eventType === 'result' && data.success) {
                    resultData = data;
                  } else if (eventType === 'error') {
                    errorMsg = data.error || 'AI detection failed';
                  } else if (eventType === 'status') {
                    if (data.step === 'detecting') {
                      setLoadingStep(SIGNAL_STEPS.length + 1);
                    } else if (data.step === 'enriching') {
                      setLoadingStep(LOADING_STEPS.length - 1);
                    }
                  }
                } catch {
                  // Skip malformed JSON
                }
              }
            }
          }
        }

        // Fallback: if structured parsing failed, try to find result in raw text
        if (!resultData && !errorMsg) {
          const resultMatch = rawText.match(/data: (\{"success":true.*?\})\n/);
          if (resultMatch) {
            try {
              resultData = JSON.parse(resultMatch[1]);
            } catch { /* ignore */ }
          }
          const errorMatch = rawText.match(/data: (\{"success":false.*?\})\n/);
          if (errorMatch) {
            try {
              const errData = JSON.parse(errorMatch[1]);
              errorMsg = errData.error || 'AI detection failed';
            } catch { /* ignore */ }
          }
        }

        if (errorMsg) {
          setError(errorMsg);
        } else if (resultData) {
          const newNarratives = resultData.data.narratives || [];
          setNarratives(newNarratives);
          if (resultData.data.signals) {
            setSignals(resultData.data.signals);
          }
          setLastUpdated(new Date().toLocaleTimeString());
          setSelectedNarrativeIndex(0);
          accumulateSeenTitles(newNarratives);

          if (resultData.data.edition) {
            setNarrativeStatuses(resultData.data.edition.narrativeStatuses || []);
          }
        } else {
          setError('No response received from AI. Please try again.');
        }
      } finally {
        clearInterval(narrativeInterval);
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
      clearInterval(signalInterval);
    } finally {
      setLoading(false);
    }
  }

  // ── Fetch raw signals ───────────────────────────────────
  async function fetchSignals() {
    try {
      const res = await fetch('/api/signals');
      if (!res.ok) throw new Error(`Signal fetch failed (${res.status})`);
      const json = await res.json();
      if (json.success) {
        setSignals(json.data.signals || []);
      }
    } catch (err) {
      console.error('Failed to fetch signals:', err);
    }
  }

  useEffect(() => {
    fetchSignals();
  }, []);

  const selectedNarrative = narratives[selectedNarrativeIndex] || null;

  // Get status for a narrative by slug
  function getStatus(slug: string): NarrativeStatus | undefined {
    return narrativeStatuses.find(s => s.slug === slug);
  }

  return (
    <div className="layout-shell">
      {/* ── Top Bar ─────────────────────────────────────── */}
      <TopBar
        loading={loading}
        lastUpdated={lastUpdated}
        onDetect={detectNarratives}
      />

      {/* ── Left Sidebar: Signals ───────────────────────── */}
      <SignalSidebar
        signals={signals}
        loading={loading}
        loadingStep={ideasOnlyLoading ? 'Generating fresh ideas...' : LOADING_STEPS[loadingStep]}
        onSignalClick={(signal) => setSelectedSignal(signal)}
        isPanelOpen={!!selectedSignal}
      />

      {/* ── Main Stage: Narratives ──────────────────────── */}
      <main className="main-stage">
        {/* Error display */}
        {error && (
          <div style={{
            padding: 'var(--space-m)',
            borderBottom: '1px solid var(--border-dim)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: '#ff6666',
          }}>
            ⚠ ERROR: {error}
          </div>
        )}

        {/* Narratives */}
        {narratives.length > 0 ? (
          narratives.map((narrative, i) => {
            const status = getStatus(narrative.slug);
            return (
              <NarrativeCard
                key={narrative.id}
                narrative={narrative}
                isSelected={i === selectedNarrativeIndex}
                onSelect={() => {
                  setSelectedNarrativeIndex(i);
                  setSelectedIdea(null);
                }}
                editionStatus={status?.status}
                confidenceDelta={status?.confidenceDelta}
                onIdeaSelect={(idea) => fetchIdeaDetail(idea)}
                selectedIdeaId={selectedIdea?.id}
              />
            );
          })
        ) : (
          !loading && (
            <div className="empty-state">
              <div className="empty-state-icon">[_]</div>
              <p>
                No narratives detected yet.
                {signals.length > 0
                  ? ` ${signals.length} signals loaded — click Detect to analyze.`
                  : ' Click the Detect button to scan the Solana ecosystem.'}
              </p>
            </div>
          )
        )}

        {/* Loading state in main area */}
        {loading && narratives.length === 0 && (
          <div style={{ padding: 'var(--space-l)' }}>
            {LOADING_STEPS.slice(0, loadingStep + 1).map((step, i) => (
              <div key={i} className="loading-step" style={{
                opacity: i === loadingStep ? 1 : 0.4,
                borderBottom: 'none',
              }}>
                {step}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Right Panel: Analysis ────────────────────────── */}
      <AnalysisPanel
        selectedNarrative={selectedNarrative}
        signals={signals}
        selectedIdea={selectedIdea}
        ideaDetailLoading={ideaDetailLoading}
        onSignalClick={(signal) => setSelectedSignal(signal)}
      />

      {/* ── Bottom Status Bar ───────────────────────────── */}
      <StatusBar signals={signals} />

      {/* ── Signal Detail Panel ────────────────────────── */}
      <SignalDetailPanel
        signal={selectedSignal}
        narratives={narratives}
        allSignals={signals}
        onClose={() => setSelectedSignal(null)}
        onSignalClick={(s) => setSelectedSignal(s)}
      />
    </div>
  );
}


