// ============================================================
// Solana Narrative Pulse — Agent Registration & Submission
// ============================================================
// Run: npx tsx agent/submit.ts

const BASE_URL = process.env.SUPERTEAM_BASE_URL || 'https://superteam.fun';
const TELEGRAM = process.env.TELEGRAM_USERNAME || '@LordTyrio';

interface AgentRegistration {
    apiKey: string;
    claimCode: string;
    agentId: string;
    username: string;
}

// ── Step 1: Register Agent ───────────────────────────────────
async function registerAgent(): Promise<AgentRegistration> {
    console.log('🤖 Registering agent with Superteam Earn...');

    const res = await fetch(`${BASE_URL}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'solana-narrative-pulse' }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Registration failed: ${res.status} — ${text}`);
    }

    const data = await res.json();
    console.log('✅ Agent registered successfully!');
    console.log(`   API Key: ${data.apiKey?.slice(0, 10)}...`);
    console.log(`   Claim Code: ${data.claimCode}`);
    console.log(`   Agent ID: ${data.agentId}`);
    console.log(`   Username: ${data.username}`);
    console.log('');
    console.log(`🔑 SAVE YOUR CLAIM CODE: ${data.claimCode}`);
    console.log(`   Visit ${BASE_URL}/earn/claim/${data.claimCode} to claim rewards`);

    return data;
}

// ── Step 2: Fetch Listing Details ────────────────────────────
async function getListingDetails(apiKey: string, slug: string): Promise<any> {
    console.log(`\n📋 Fetching listing details for: ${slug}`);

    const res = await fetch(`${BASE_URL}/api/agents/listings/details/${slug}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to fetch listing: ${res.status} — ${text}`);
    }

    const data = await res.json();
    console.log(`   Title: ${data.title || 'N/A'}`);
    console.log(`   ID: ${data.id || 'N/A'}`);
    return data;
}

// ── Step 3: Submit to a listing ──────────────────────────────
async function submitToListing(
    apiKey: string,
    listingId: string,
    link: string,
    description: string
): Promise<any> {
    console.log(`\n🚀 Submitting to listing ${listingId}...`);

    const res = await fetch(`${BASE_URL}/api/agents/submissions/create`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            listingId,
            link,
            tweet: '',
            otherInfo: description,
            eligibilityAnswers: [],
            ask: null,
            telegram: `http://t.me/${TELEGRAM.replace('@', '')}`,
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Submission failed: ${res.status} — ${text}`);
    }

    const data = await res.json();
    console.log('✅ Submission created successfully!');
    return data;
}

// ── Heartbeat ────────────────────────────────────────────────
function getHeartbeat(status: 'ok' | 'degraded' | 'blocked', lastAction: string, nextAction: string) {
    return {
        status,
        agentName: 'solana-narrative-pulse',
        time: new Date().toISOString(),
        version: 'earn-agent-mvp',
        capabilities: ['register', 'listings', 'submit', 'claim'],
        lastAction,
        nextAction,
    };
}

// ── Main Flow ────────────────────────────────────────────────
const SUBMISSION_DESCRIPTION = `
# Solana Narrative Pulse

## What It Does
An AI-powered dashboard that detects emerging narratives in the Solana ecosystem by aggregating signals from multiple data sources, then generates 3-5 actionable build ideas for each narrative.

## Data Sources
- **CoinGecko Market Data**: Trending tokens, price movements, category trends
- **GitHub Activity**: Developer activity across 14 major Solana ecosystem organizations (Solana Labs, Jupiter, Jito, Drift, Marinade, Orca, Raydium, and more)
- **Signal Aggregation**: Clusters related signals, computes strength with multi-source diversity bonuses

## AI Engine
- Uses GPT-4o with structured JSON output for narrative detection
- Identifies 3-5 distinct narratives with confidence scores, explanations, and trend direction
- Generates 3-5 concrete build ideas per narrative with tech stacks and Solana-specific features

## Tech Stack
- Next.js 14 (App Router), TypeScript, Tailwind CSS
- OpenAI GPT-4o for AI analysis
- CoinGecko API + GitHub API for data collection
- Premium glassmorphism dark-theme dashboard

## How It Works
1. Click "Detect Narratives" on the dashboard
2. Agent collects real-time signals from CoinGecko and GitHub
3. Signals are clustered and normalized
4. GPT-4o analyzes signal clusters to identify emerging narratives
5. For each narrative, GPT-4o generates actionable build ideas
6. Results are displayed in a premium interactive dashboard
`.trim();

async function main() {
    console.log('═══════════════════════════════════════════');
    console.log('  Solana Narrative Pulse — Agent Submission');
    console.log('═══════════════════════════════════════════\n');

    // Send heartbeat
    console.log('💓 Heartbeat:', JSON.stringify(getHeartbeat('ok', 'starting submission flow', 'registering agent'), null, 2));

    try {
        // Step 1: Register
        const agent = await registerAgent();

        // Step 2: Fetch both listing details
        const listing1 = await getListingDetails(
            agent.apiKey,
            'develop-a-narrative-detection-and-idea-generation-tool'
        );

        const listing2 = await getListingDetails(
            agent.apiKey,
            'open-innovation-track-agents'
        );

        // Step 3: Submit to both
        const repoLink = 'https://github.com/YOUR_USERNAME/solana-narrative-pulse';

        if (listing1?.id) {
            await submitToListing(agent.apiKey, listing1.id, repoLink, SUBMISSION_DESCRIPTION);
        }

        if (listing2?.id) {
            await submitToListing(agent.apiKey, listing2.id, repoLink, SUBMISSION_DESCRIPTION);
        }

        // Final heartbeat
        console.log('\n💓 Heartbeat:', JSON.stringify(
            getHeartbeat('ok', 'submitted to listings', 'waiting for results'),
            null, 2
        ));

        console.log('\n═══════════════════════════════════════════');
        console.log('  ✅ All submissions complete!');
        console.log(`  🔑 Claim Code: ${agent.claimCode}`);
        console.log(`  📎 Claim URL: ${BASE_URL}/earn/claim/${agent.claimCode}`);
        console.log('═══════════════════════════════════════════');

    } catch (error) {
        console.error('\n❌ Error:', error);
        console.log('💓 Heartbeat:', JSON.stringify(
            getHeartbeat('blocked', `error: ${error}`, 'needs debugging'),
            null, 2
        ));
    }
}

main();
