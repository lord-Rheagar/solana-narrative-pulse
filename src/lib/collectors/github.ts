// ============================================================
// Solana Narrative Pulse — GitHub Activity Collector
// ============================================================

import { CONFIG } from '@/lib/config';
import { Signal, GitHubRepoActivity, CollectorResult } from '@/lib/types';

const BASE = CONFIG.github.baseUrl;

async function ghFetch(url: string) {
    const headers: Record<string, string> = {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    };
    if (CONFIG.github.token) {
        headers['Authorization'] = `Bearer ${CONFIG.github.token}`;
    }
    const res = await fetch(url, { headers, next: { revalidate: 600 } });
    if (!res.ok) {
        if (res.status === 403) {
            console.warn('GitHub rate limit hit');
            return null;
        }
        throw new Error(`GitHub API error: ${res.status}`);
    }
    return res.json();
}

// ── Fetch repos for a GitHub org ─────────────────────────────
async function getOrgRepos(org: string): Promise<GitHubRepoActivity[]> {
    try {
        const data = await ghFetch(
            `${BASE}/orgs/${org}/repos?sort=pushed&direction=desc&per_page=5&type=public`
        );
        if (!data) return [];
        return data.map((repo: any) => ({
            org,
            repo: repo.name,
            fullName: repo.full_name,
            stars: repo.stargazers_count || 0,
            forks: repo.forks_count || 0,
            openIssues: repo.open_issues_count || 0,
            recentCommits: 0, // populated separately if needed
            lastPush: repo.pushed_at || '',
            description: repo.description || '',
            language: repo.language || '',
            topics: repo.topics || [],
        }));
    } catch (err) {
        console.error(`Error fetching repos for ${org}:`, err);
        return [];
    }
}

// ── Check recent commit activity ─────────────────────────────
async function getRecentCommitCount(fullName: string): Promise<number> {
    try {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const data = await ghFetch(
            `${BASE}/repos/${fullName}/commits?since=${since}&per_page=1`
        );
        if (!data) return 0;
        // GitHub doesn't return total count easily, but we can check if there's activity
        return data.length > 0 ? data.length : 0;
    } catch {
        return 0;
    }
}

// ── Collect GitHub signals ───────────────────────────────────
export async function collectGitHubSignals(): Promise<CollectorResult<Signal[]>> {
    const signals: Signal[] = [];
    const collectedAt = new Date().toISOString();
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Fetch repos from tracked orgs (limit concurrency)
    const orgBatches = [];
    for (let i = 0; i < CONFIG.github.trackedOrgs.length; i += 3) {
        orgBatches.push(CONFIG.github.trackedOrgs.slice(i, i + 3));
    }

    const allRepos: GitHubRepoActivity[] = [];
    for (const batch of orgBatches) {
        const results = await Promise.all(batch.map(org => getOrgRepos(org)));
        allRepos.push(...results.flat());
        // Small delay to respect rate limits
        await new Promise(r => setTimeout(r, 200));
    }

    // Find repos with recent activity
    const recentlyActive = allRepos.filter(repo => {
        const pushTime = new Date(repo.lastPush).getTime();
        return pushTime > oneWeekAgo;
    });

    // Generate signals from active repos
    const orgActivity: Record<string, { repos: number; totalStars: number; descriptions: string[] }> = {};

    recentlyActive.forEach(repo => {
        if (!orgActivity[repo.org]) {
            orgActivity[repo.org] = { repos: 0, totalStars: 0, descriptions: [] };
        }
        orgActivity[repo.org].repos++;
        orgActivity[repo.org].totalStars += repo.stars;
        if (repo.description) {
            orgActivity[repo.org].descriptions.push(repo.description);
        }

        // High-star repos with recent pushes are strong signals
        if (repo.stars > 100) {
            signals.push({
                id: `github-active-${repo.fullName}`,
                source: 'github',
                category: 'Developer Activity',
                metric: 'repo_activity',
                value: repo.stars,
                delta: 0,
                description: `${repo.fullName} (⭐${repo.stars}) is actively being developed — ${repo.description || 'No description'}`,
                relatedTokens: [],
                relatedProjects: [repo.org],
                timestamp: collectedAt,
                strength: Math.min(100, 30 + Math.log10(repo.stars + 1) * 20),
                sourceUrl: `https://github.com/${repo.fullName}`,
                fullText: [
                    repo.description,
                    repo.topics.length > 0 ? `Topics: ${repo.topics.join(', ')}` : '',
                    repo.language ? `Primary language: ${repo.language}` : '',
                ].filter(Boolean).join('. '),
            });
        }
    });

    // Org-level aggregate signals
    for (const [org, activity] of Object.entries(orgActivity)) {
        if (activity.repos >= 2) {
            // Build fullText with repo descriptions so the LLM knows what this org is building
            const repoDetails = activity.descriptions
                .filter(d => d.length > 0)
                .slice(0, 5)
                .map(d => `- ${d}`)
                .join('\n');

            signals.push({
                id: `github-org-${org}`,
                source: 'github',
                category: 'Org Activity Spike',
                metric: 'active_repos',
                value: activity.repos,
                delta: 0,
                description: `${org} has ${activity.repos} actively developed repos this week (total ⭐${activity.totalStars})`,
                relatedTokens: [],
                relatedProjects: [org],
                timestamp: collectedAt,
                strength: Math.min(100, activity.repos * 15 + Math.log10(activity.totalStars + 1) * 10),
                sourceUrl: `https://github.com/${org}`,
                fullText: repoDetails ? `Active repos:\n${repoDetails}` : undefined,
            });
        }
    }

    // Look for repos with interesting topics
    const topicCounts: Record<string, number> = {};
    allRepos.forEach(repo => {
        repo.topics.forEach(topic => {
            topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        });
    });

    const hotTopics = Object.entries(topicCounts)
        .filter(([, count]) => count >= 3)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    hotTopics.forEach(([topic, count]) => {
        signals.push({
            id: `github-topic-${topic}`,
            source: 'github',
            category: 'Development Trend',
            metric: 'topic_popularity',
            value: count,
            delta: 0,
            description: `"${topic}" appears in ${count} active Solana ecosystem repos`,
            relatedTokens: [],
            relatedProjects: [],
            timestamp: collectedAt,
            strength: Math.min(100, count * 20),
            sourceUrl: `https://github.com/topics/${topic}`,
        });
    });

    return { data: signals, source: 'github', collectedAt };
}
