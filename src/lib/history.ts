// ============================================================
// Solana Narrative Pulse — Narrative History Storage
// ============================================================
// In-memory primary store with async file persistence as backup.
//
// Fixes over the original fs.writeFileSync approach:
//   1. Non-blocking I/O (fs.promises instead of sync)
//   2. Concurrency-safe (in-memory primary + write mutex for disk)
//   3. Works on read-only deployments (memory always works; disk is best-effort)

import { Narrative } from '@/lib/types';
import * as fs from 'fs/promises';
import * as path from 'path';

// ── Types ────────────────────────────────────────────────────

export interface NarrativeEdition {
    id: string;
    detectedAt: string;
    narratives: EditionNarrative[];
    signalCount: number;
    processingTime: number;
}

export interface EditionNarrative {
    id: string;
    name: string;
    slug: string;
    category: string;
    confidence: number;
    signalStrength: number;
    trend: 'rising' | 'stable' | 'declining';
    summary: string;
    ideaCount: number;
    ideaTitles?: string[];
    signalCount: number;
    // Computed by comparison
    status?: 'new' | 'rising' | 'fading' | 'stable' | 'returning';
    confidenceDelta?: number;
}

export interface NarrativeHistoryData {
    editions: NarrativeEdition[];
    lastUpdated: string;
}

// ── Storage config ──────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'narrative-history.json');
const MAX_EDITIONS = 20;

// ── In-memory store (primary source of truth) ───────────────

let memoryStore: NarrativeHistoryData | null = null;
let initialLoadDone = false;
let initialLoadPromise: Promise<void> | null = null;

// Simple promise-based mutex for serializing disk writes
let writeLock: Promise<void> = Promise.resolve();

function empty(): NarrativeHistoryData {
    return { editions: [], lastUpdated: new Date().toISOString() };
}

// ── Load from disk (once, on first access) ──────────────────

async function ensureLoaded(): Promise<void> {
    if (initialLoadDone) return;

    // Deduplicate concurrent init calls
    if (initialLoadPromise) return initialLoadPromise;

    initialLoadPromise = (async () => {
        try {
            const raw = await fs.readFile(HISTORY_FILE, 'utf-8');
            memoryStore = JSON.parse(raw) as NarrativeHistoryData;
        } catch {
            // File doesn't exist or is unreadable — start fresh
            memoryStore = empty();
        }
        initialLoadDone = true;
    })();

    return initialLoadPromise;
}

// ── Persist to disk (best-effort, non-blocking) ─────────────

function persistToDisk(data: NarrativeHistoryData): void {
    // Chain onto the write lock so concurrent saves don't interleave
    writeLock = writeLock
        .then(async () => {
            try {
                await fs.mkdir(DATA_DIR, { recursive: true });
                // Write to a temp file first, then rename for atomicity
                const tmp = `${HISTORY_FILE}.tmp`;
                await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
                await fs.rename(tmp, HISTORY_FILE);
            } catch (err) {
                // Best-effort — read-only FS or permission issues are non-fatal
                console.warn('History: disk persist failed (non-fatal):', err);
            }
        })
        .catch(() => {
            // Never let the lock chain break
        });
}

// ── Generate edition ID ─────────────────────────────────────

function editionId(): string {
    const now = new Date();
    const week = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    const timestamp = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const random = Math.random().toString(36).slice(2, 5);
    return `E-${now.getFullYear()}-W${week}-${now.getDate()}-${timestamp}-${random}`;
}

// ── Compare with previous edition ───────────────────────────

function compareWithPrevious(
    current: EditionNarrative[],
    history: NarrativeHistoryData
): EditionNarrative[] {
    if (history.editions.length === 0) {
        return current.map(n => ({ ...n, status: 'new' as const, confidenceDelta: 0 }));
    }

    const previous = history.editions[0];
    const prevMap = new Map(previous.narratives.map(n => [n.slug, n]));

    const olderSlugs = new Set<string>();
    history.editions.slice(1, 5).forEach(e => {
        e.narratives.forEach(n => olderSlugs.add(n.slug));
    });

    return current.map(n => {
        const prev = prevMap.get(n.slug);

        if (!prev) {
            if (olderSlugs.has(n.slug)) {
                return { ...n, status: 'returning' as const, confidenceDelta: 0 };
            }
            return { ...n, status: 'new' as const, confidenceDelta: 0 };
        }

        const confidenceDelta = n.confidence - prev.confidence;
        let status: EditionNarrative['status'];
        if (confidenceDelta > 10) {
            status = 'rising';
        } else if (confidenceDelta < -10) {
            status = 'fading';
        } else {
            status = 'stable';
        }

        return { ...n, status, confidenceDelta };
    });
}

// ── Public API ──────────────────────────────────────────────

/**
 * Read the full history. Loads from disk on first call,
 * then serves from memory on subsequent calls.
 */
export async function readHistory(): Promise<NarrativeHistoryData> {
    await ensureLoaded();
    return memoryStore!;
}

/**
 * Save a new edition. Updates in-memory store immediately,
 * then persists to disk asynchronously (best-effort).
 */
export async function saveEdition(
    narratives: Narrative[],
    signalCount: number,
    processingTime: number
): Promise<NarrativeEdition> {
    await ensureLoaded();
    const history = memoryStore!;

    const editionNarratives: EditionNarrative[] = narratives.map(n => ({
        id: n.id,
        name: n.name,
        slug: n.slug,
        category: n.category,
        confidence: n.confidence,
        signalStrength: n.signalStrength,
        trend: n.trend,
        summary: n.summary,
        ideaCount: n.ideas.length,
        ideaTitles: n.ideas.map(i => i.title),
        signalCount: n.signals.length,
    }));

    const compared = compareWithPrevious(editionNarratives, history);

    const edition: NarrativeEdition = {
        id: editionId(),
        detectedAt: new Date().toISOString(),
        narratives: compared,
        signalCount,
        processingTime,
    };

    // Update in-memory store (immediate, synchronous)
    history.editions.unshift(edition);
    if (history.editions.length > MAX_EDITIONS) {
        history.editions = history.editions.slice(0, MAX_EDITIONS);
    }
    history.lastUpdated = new Date().toISOString();

    // Persist to disk (async, non-blocking, best-effort)
    persistToDisk(history);

    return edition;
}

/**
 * Get a narrative's confidence trajectory across editions.
 */
export async function getNarrativeTrajectory(slug: string, limit = 10): Promise<{
    edition: string;
    detectedAt: string;
    confidence: number;
    status?: string;
}[]> {
    await ensureLoaded();
    const history = memoryStore!;

    const trajectory: {
        edition: string;
        detectedAt: string;
        confidence: number;
        status?: string;
    }[] = [];

    history.editions.slice(0, limit).forEach(e => {
        const match = e.narratives.find(n => n.slug === slug);
        if (match) {
            trajectory.push({
                edition: e.id,
                detectedAt: e.detectedAt,
                confidence: match.confidence,
                status: match.status,
            });
        }
    });

    return trajectory.reverse();
}

/**
 * Get idea titles from recent editions for deduplication.
 * Optionally filter by narrative slug to get ideas from the same/similar narrative.
 */
export async function getRecentIdeaTitles(slug?: string, editionLimit = 3): Promise<string[]> {
    await ensureLoaded();
    const history = memoryStore!;

    const titles: string[] = [];
    for (const edition of history.editions.slice(0, editionLimit)) {
        for (const narrative of edition.narratives) {
            if (slug && narrative.slug !== slug) continue;
            if (narrative.ideaTitles?.length) {
                titles.push(...narrative.ideaTitles);
            }
        }
    }

    // Deduplicate
    return [...new Set(titles)];
}
