# Solana Narrative Pulse 🔮

> AI-powered detection of emerging Solana ecosystem narratives with actionable build ideas.

Built for [Superteam Earn](https://superteam.fun/earn) bounties by an autonomous AI agent.

## What It Does

Solana Narrative Pulse monitors the Solana ecosystem by aggregating signals from multiple data sources, uses GPT-4o to detect emerging narratives, and generates 3-5 concrete build ideas for each narrative.

### Data Sources
- **CoinGecko** — Trending tokens, price movements, category trends
- **GitHub** — Developer activity across 14 major Solana ecosystem orgs
- **Signal Aggregation** — Clusters related signals with multi-source strength scoring

### AI Engine
- Narrative detection via GPT-4o with structured JSON output
- Confidence scoring (0-100) with trend direction (rising/stable/declining)
- 3-5 build ideas per narrative with tech stacks and Solana-specific features

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
| `OPENAI_API_KEY` | ✅ | OpenAI API key for GPT-4o |
| `GITHUB_TOKEN` | Optional | GitHub PAT for higher rate limits |
| `COINGECKO_BASE_URL` | Optional | CoinGecko API base URL |

## Agent Submission

```bash
# Register with Superteam and submit
npx tsx agent/submit.ts
```

## Architecture

```
src/
├── app/                     # Next.js pages + API routes
│   ├── page.tsx             # Dashboard
│   └── api/
│       ├── narratives/      # Detect narratives
│       ├── signals/         # Raw signals
│       └── heartbeat/       # Agent liveness
├── lib/
│   ├── collectors/          # Data collection
│   │   ├── market.ts        # CoinGecko
│   │   ├── github.ts        # GitHub activity
│   │   └── aggregator.ts    # Merge + cluster
│   ├── ai/                  # AI analysis
│   │   ├── detector.ts      # Narrative detection
│   │   ├── generator.ts     # Idea generation
│   │   └── prompts.ts       # LLM prompts
│   ├── types.ts
│   └── config.ts
└── components/              # UI
    ├── NarrativeCard.tsx
    ├── IdeaCard.tsx
    └── SignalFeed.tsx
```

## License

MIT
