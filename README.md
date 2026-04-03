# AlphaPony

English README: [`README.md`](README.md)  
Chinese README: [`README.ch.md`](README.ch.md)

AlphaPony is the first decentralized AI investment assistant for the crypto asset industry, built to help investors make simple, fast, and accurate decisions and continuously improve returns in crypto markets.

It brings 6 previously fragmented signal groups together and combines semantic analysis, market signal analysis, other quantitative baseline rules, and large-model AI analysis to generate directional buy/sell signals and help users make decisions quickly:

- current rule-based direction
- current AI direction
- signal-level drivers
- recent event timeline
- important alerts and Telegram delivery

## Core Capabilities

- Tracks `BTC`, `ETH`, `SOL`, `BNB`, `XRP`, and `DOGE`
- Aggregates `Market`, `News`, `Community`, `KOL`, `On-chain`, and `Whale` signals
- Provides rule scores, direction states, signal explanations, and event timelines
- Supports bilingual UI and bilingual AI analysis
- Supports an alerts center, Telegram delivery, and connection testing
- Supports light and dark themes
- Supports version checks and a basic update flow

## Product Pages

- Home dashboard: overview of current directions, AI states, and recent alerts across all assets
- Asset detail page: signal breakdown, AI conclusion, timeline, and alerts for one asset
- Timeline page: recent events for a single asset or all assets
- Alerts center: alert history and severity levels
- Strategy center: signal strategy
- Management page: data source status plus AI and Telegram configuration

## Future Roadmap

- Support multi-asset portfolio analysis
- Support backtesting and paper trading
- Support more advanced custom strategies
- Support auto-ordering and execution

## Tech Stack

- Frontend: `Next.js 14`, `React 18`, `TypeScript`
- Backend: `NestJS 11`, `TypeScript`
- Database: `PostgreSQL`, `Prisma`

## Quick Start

### 1. Prepare environment variables

```bash
cp .env.example .env
```

Minimum commonly used variables:

- `DATABASE_URL`
- `API_PORT`
- `API_HOST`
- `API_BASE_URL`
- `WEB_PORT`
- `WEB_HOST`
- `NEXT_PUBLIC_API_BASE_URL`

### 2. Start the database

If PostgreSQL is already installed and running locally, just use your own `DATABASE_URL`.  
If you want to start the bundled PostgreSQL service with Docker:

```bash
npm run db:up
```

### 3. Start the application

```bash
npm run start
```

Default addresses:

- Frontend: `http://127.0.0.1:3000`
- Backend: `http://127.0.0.1:4000`

On the first run, the startup script will automatically handle:

- `npm ci`
- database availability checks
- Prisma Client generation
- frontend and backend builds
- `prisma migrate deploy` when needed

## Common Commands

```bash
npm run start
npm run stop
npm run healthcheck
npm run dev
npm run api:dev
npm run db:up
npm run prisma:migrate:dev
npm run prisma:migrate:deploy
npm run check-update
npm run update
```

## Cross-Platform Runtime

The unified script entrypoints support:

- `macOS`
- `Linux`
- `Windows`

Core production runtime commands:

- `npm run start`
- `npm run stop`
- `npm run healthcheck`

## Release and Updates

The lightweight release package excludes these large directories:

- `node_modules`
- `.next`
- `.next-dev`
- build caches

Both release mode and source mode can use the same command:

```bash
npm run start
```

Environment resolution order:

1. `ALPHAPONY_ENV_PATH`
2. `data/env/.env`
3. project root `.env`

Commands for update checks and updates:

```bash
npm run check-update
npm run update
```

Recommended update manifest for the current release:

```bash
https://github.com/ptansukses-beep/alphapony/releases/download/v0.1.0/latest.json
```

## Release Process

For the next release, use this order:

1. Update the version in `package.json`
2. Build the release package:

```bash
ALPHAPONY_RELEASE_BASE_URL="https://github.com/ptansukses-beep/alphapony/releases/download/vX.Y.Z" npm run package-release
```

3. Upload both files from `dist/release/` to the GitHub Release:

- `alphapony-X.Y.Z-<platform>.zip`
- `latest.json`

4. Set runtime env:

```bash
ALPHAPONY_UPDATE_MANIFEST_URL=https://github.com/ptansukses-beep/alphapony/releases/download/vX.Y.Z/latest.json
```

## Development Notes

For manual development and debugging, the most common commands are:

```bash
npm run api:dev
npm run dev
npm run db:seed
npm run prisma:migrate:dev
```
