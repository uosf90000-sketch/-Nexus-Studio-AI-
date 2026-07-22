# Nexus Studio AI — Personal Prototype

A personal prototype for transforming ideas into summaries, product requirements, and executable plans.

**Status:** Phase 1 (MVP) — Idea → Summary + PRD → Display

## Quick Start

### Prerequisites

- Node.js 18+ (check with `node -v`)
- npm or yarn

### Setup

1. **Clone and install:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp env.example .env.local
   # Edit .env.local and add:
   # - ANTHROPIC_API_KEY=sk-ant-...
   # - ANTHROPIC_MODEL=claude-3-5-sonnet-20241022 (or latest)
   # - DATABASE_URL=file:./dev.db (already set)
   # - COST_WARNING_THRESHOLD=10
   ```

3. **Initialize database:**
   ```bash
   npm run prisma:migrate
   ```

4. **Run dev server:**
   ```bash
   npm run dev
   ```

   Open http://localhost:3000

### Usage

1. Enter a project title and idea description
2. The Planner (Claude) generates a summary + short PRD
3. Results are saved to the database and displayed
4. View cost breakdown for each project

## Architecture

- **Framework:** Next.js (Full-stack)
- **DB:** Prisma + SQLite
- **UI:** Tailwind CSS + shadcn/ui
- **AI Provider:** Claude (Anthropic)
- **Structure:** Single app, internal modules (no separate backend)

## Project Structure

```
src/
├── app/                      # Next.js routes & pages
│   ├── api/projects/         # Project CRUD endpoints
│   └── projects/[id]/        # Project view page
├── modules/
│   ├── agents/               # AI provider adapters
│   │   ├── adapter.ts        # Interface
│   │   ├── claude-adapter.ts # Claude implementation
│   │   └── planner.ts        # Planner role (idea → PRD)
│   └── projects/
│       └── service.ts        # Project CRUD logic
└── lib/
    ├── config.ts             # Env validation
    ├── prisma.ts             # DB client
    └── redact.ts             # Secret redaction
prisma/
├── schema.prisma             # Database models
└── migrations/               # DB migrations
tests/                        # Test suite
docs/
├── architecture/             # Architecture & decision records
└── architecture/adr/         # ADRs
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (http://localhost:3000) |
| `npm run build` | Build for production |
| `npm run start` | Run production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests |
| `npm run prisma:migrate` | Run migrations |
| `npm run prisma:studio` | Open Prisma Studio |

## Phase 1 Features

- ✅ Enter project idea via UI
- ✅ Generate summary + short PRD (Claude)
- ✅ Save to database (Prisma + SQLite)
- ✅ Display results on project page
- ✅ Track AI costs
- ✅ Error handling (max 2 retries)
- ✅ Secret redaction in logs
- ✅ Type-safe throughout (TypeScript)

## Phase 2 (Future)

- Plan generation (task breakdown)
- Task execution interface
- Code builder integration
- Review automation
- GitHub branch/PR creation
- Autonomous mode progression

## Testing

Run tests with:
```bash
npm test
```

Tests validate:
- Planner generates coherent summaries + PRDs
- Projects persist correctly
- Costs are tracked
- Error handling works

**Note:** Tests require `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` env vars. Set them in `.env.test.local` or pass via CI.

## Security

- ✅ All secrets in environment variables only (never committed)
- ✅ Secret redaction helper (`lib/redact.ts`) strips keys from logs
- ✅ No real secrets in `.env.example`
- ✅ Database is local SQLite (no production data)

## Troubleshooting

### "ANTHROPIC_API_KEY env var is required"
Make sure `.env.local` has your API key:
```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

### "database connection error"
Ensure Prisma migrations ran:
```bash
npm run prisma:migrate
```

### Tests timeout
API calls to Claude may take 10+ seconds. Increase timeout if needed:
```bash
npm test -- --reporter=verbose
```

## Documentation

Read in order:
1. `MVP_SYSTEM_ARCHITECTURE.md` — System design
2. `DECISION_PROTOCOL.md` — How decisions work
3. `FAILURE_AND_RECOVERY_MODEL.md` — Retry/error handling
4. `COMPETITIVE_DIFFERENTIATION.md` — Context only

ADRs are in `docs/architecture/adr/`.

## License

Personal prototype — use freely within this session.
