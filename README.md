# Solana Narrative Pulse

> AI-powered detection of emerging Solana ecosystem narratives with actionable build ideas.

Built for [Superteam Earn](https://superteam.fun/earn) bounties by an autonomous AI agent.

## What It Does

Solana Narrative Pulse monitors the Solana ecosystem by aggregating signals from 8 parallel data collectors, uses AI reasoning models to detect emerging narratives, and generates 3-5 concrete build ideas for each narrative.

## Data Sources

All collectors run in parallel via `Promise.allSettled` — each is fault-isolated so one failure never blocks the others.

| Source | API | What It Collects |
|--------|-----|------------------|
| **CoinGecko** | CoinGecko free API | Trending tokens, price/volume changes for 14 tracked Solana tokens (SOL, JUP, JTO, PYTH, RAY, ORCA, etc.), category-level market cap trends for Solana-relevant sectors |
| **GitHub** | GitHub REST API | Developer activity across 13 Solana orgs (solana-labs, jito-foundation, jup-ag, marinade-finance, helium, drift-labs, etc.) — stars, forks, commit frequency, new repos. Batched 3 orgs at a time with rate-limit delays |
| **On-Chain** | Helius RPC | Network TPS, program activity for 10 key programs (Jupiter, Raydium, Orca, Drift, Tensor, Jito, Pyth, etc.), whale wallet monitoring (CEX wallets, market makers like Jump/Wintermute, VCs like a16z/Paradigm), validator health, supply metrics |
| **Social** | RSS + Twitter scraper | RSS feeds from 8 sources (Helius Blog, Solana Foundation, Messari, Jupiter, Jito, Marinade, Superteam, Electric Capital). Twitter KOL tracking for 8 accounts (Anatoly, Mert, Raj Gokal, etc.) with spam filtering and narrative keyword boosting |
| **DeFi Llama** | DeFi Llama free API | Solana ecosystem TVL, top protocols by TVL with 1d/7d change deltas, stablecoin flow tracking |
| **DexScreener** | DexScreener free API | Top boosted Solana tokens, new trading pairs, high-volume pairs with buy/sell ratios, liquidity data |
| **NFT** | Magic Eden API | Trending collections by 24h volume, floor prices, listed count, collection activity |
| **Solana Agent Kit** | solana-agent-kit + plugin-misc | Trending tokens via on-chain analysis, token data enrichment |

## How Signals Are Detected and Ranked

### 1. Signal Collection

Each collector produces `Signal` objects with a normalized `strength` score (0-100). Strength is computed differently per source:

- **Market signals** — Based on price change magnitude, volume, and market cap
- **GitHub signals** — Based on commit velocity, star growth, and recency of pushes
- **On-chain signals** — Based on TPS deviation from baseline, program usage changes, whale balance movements
- **Social signals** — Based on KOL influence weight (80-95), narrative keyword matches, and recency. Spam is filtered out using pattern matching
- **DeFi Llama signals** — Based on TVL thresholds ($5B+ = 70, $2B+ = 55) and protocol-level TVL change rates
- **DEX signals** — Based on 24h volume, price change magnitude, and buy/sell ratio skew
- **NFT signals** — Based on trending rank, 24h volume, and floor price

### 2. Aggregation and Sorting

The aggregator merges all signals into a single array, sorts by strength descending, and enriches descriptions for consistency.

### 3. Signal Clustering

Signals are grouped into clusters by three dimensions:
- **Project** — signals mentioning the same project (e.g., `project:jupiter`)
- **Token** — signals mentioning the same token (e.g., `token:sol`)
- **Category** — signals sharing the same category (e.g., `category:defi`)

Only clusters with 2+ signals are kept (indicating meaningful convergence).

### 4. Cluster Strength Scoring

Each cluster gets an aggregate strength score:

```
clusterStrength = avgSignalStrength + (uniqueSources - 1) * 10
```

The diversity bonus (+10 per additional unique source) rewards multi-source convergence — a narrative appearing across on-chain data, social chatter, AND market movement scores higher than one from a single source.

### 5. Diversity-Aware Signal Selection for AI

Before sending to the AI, signals are selected to ensure every active source is represented:

1. **Phase 1** — Guarantee at least 3 signals from each source (strongest first)
2. **Phase 2** — Fill remaining slots (up to 50 total) with the strongest unselected signals across all sources

This prevents any single noisy source from drowning out others.

### 6. AI Narrative Detection

The top 50 signals + top 25 cluster summaries are sent to a reasoning model (o3-mini) which:

- Identifies recurring themes and emerging patterns
- Groups related signals into named narratives
- Assigns confidence scores (0-100) and trend direction (rising/stable/declining)
- Generates a 1-sentence AI context for every input signal
- Includes a JSON repair retry loop if parsing fails

### 7. Build Idea Generation

For each detected narrative, a writing model (Claude Sonnet, falling back to GPT-4o-mini) generates 3-5 actionable build ideas with:

- Title, description, and problem statement
- Recommended tech stack and Solana-specific features
- Complexity and impact ratings (Low/Medium/High)
- "Why now" explanation tied to the narrative signals

Idea generation runs in parallel across all narratives.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **"Detect Narratives"**.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | Powers o3-mini (narrative detection) and GPT-4o-mini (fallback) |
| `ANTHROPIC_API_KEY` | No | Enables Claude Sonnet for idea generation; falls back to GPT-4o-mini |
| `HELIUS_API_KEY` | No | Enables on-chain data collection (TPS, program activity, whales) |
| `GITHUB_TOKEN` | No | Higher GitHub API rate limits |
| `TWITTER_USERNAME` / `TWITTER_PASSWORD` | No | Enables Twitter/X KOL scraping |
| `SOLANA_RPC_URL` | No | Defaults to mainnet public RPC |

## Architecture

```
src/
├── app/                     # Next.js pages + API routes
│   ├── page.tsx             # Dashboard (single-page, React hooks state)
│   └── api/
│       ├── narratives/      # Full pipeline: collect -> detect -> generate -> save
│       ├── signals/         # Raw signal collection only
│       ├── history/         # Edition history & narrative trajectories
│       ├── heartbeat/       # Agent liveness check
│       └── agent/           # Solana Agent Kit status
├── lib/
│   ├── collectors/          # Data collection (8 collectors)
│   │   ├── market.ts        # CoinGecko
│   │   ├── github.ts        # GitHub activity (13 orgs)
│   │   ├── onchain.ts       # Helius RPC (programs, whales, TPS)
│   │   ├── social.ts        # RSS feeds + Twitter KOLs
│   │   ├── defi-llama.ts    # TVL & protocol data
│   │   ├── dex.ts           # DexScreener pairs & volume
│   │   ├── nft.ts           # Magic Eden collections
│   │   └── aggregator.ts    # Merge, cluster, & score
│   ├── ai/                  # AI analysis
│   │   ├── detector.ts      # Narrative detection (o3-mini)
│   │   ├── generator.ts     # Idea generation (Claude/GPT-4o-mini)
│   │   ├── model-router.ts  # Multi-provider model routing
│   │   └── prompts.ts       # LLM prompt templates
│   ├── solana-agent.ts      # Solana Agent Kit integration
│   ├── history.ts           # Edition persistence & trend tracking
│   ├── cache.ts             # In-memory TTL cache (5min signals, 15min narratives)
│   ├── types.ts             # Signal, Narrative, BuildIdea types
│   └── config.ts            # Tracked tokens, GitHub orgs, settings
└── components/              # UI (9 components)
    ├── TopBar.tsx            # Header with Detect button
    ├── SignalSidebar.tsx     # Left panel — signal feed
    ├── NarrativeCard.tsx     # Center panel — narrative cards
    ├── AnalysisPanel.tsx     # Right panel — deep dive
    ├── IdeaCard.tsx          # Build idea display
    ├── SignalDetailPanel.tsx  # Signal modal
    ├── SignalFeed.tsx        # Signal list view
    ├── OnChainTicker.tsx     # Live TPS ticker
    └── StatusBar.tsx         # Source distribution & cache status
```

## License

MIT
