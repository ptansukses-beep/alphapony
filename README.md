# AlphaPony

[![English](https://img.shields.io/badge/English-README-111111?style=flat-square)](./README.md)
[![中文](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-README-f5f5f5?style=flat-square&labelColor=111111)](./README.ch.md)

AlphaPony is an open-source AI research tool for crypto asset signals. It helps users collect, organize, and review market-related signals in one place.

It brings 6 previously fragmented signal groups together and combines semantic analysis, market signal analysis, quantitative baseline rules, and large-model AI summaries to present research signals and supporting context:

- current rule-based signal state
- current AI signal state
- signal-level drivers
- recent event timeline
- important alerts and Telegram delivery

## Disclaimer

AlphaPony is a research and information tool only. It does not provide investment, financial, legal, tax, or trading advice, and it does not recommend buying, selling, holding, or trading any asset. All outputs are generated from configured data sources and rule/AI models for reference only. Users are solely responsible for their own research, risk assessment, and decisions.

## Core Capabilities

- Tracks `BTC`, `ETH`, `SOL`, `BNB`, `XRP`, and `DOGE`
- Aggregates `Market`, `News`, `Community`, `KOL`, `On-chain`, and `Whale` signals
- Provides rule scores, signal states, signal explanations, and event timelines
- Supports bilingual UI and bilingual AI analysis
- Supports an alerts center, Telegram delivery, and connection testing
- Supports light and dark themes
- Supports version checks and a basic update flow

## Product Pages

- Home dashboard: overview of current signal states, AI states, and recent alerts across all assets
- Asset detail page: signal breakdown, AI-generated research summary, timeline, and alerts for one asset
- Timeline page: recent events for a single asset or all assets
- Alerts center: alert history and severity levels
- Strategy center: signal strategy
- Management page: data source status plus AI and Telegram configuration

## Future Roadmap

- Support multi-asset signal views
- Support historical replay and simulation
- Support more advanced custom strategies
- Support optional workflow integrations while keeping all external actions user-controlled

## Tech Stack

- Frontend: `Next.js 14`, `React 18`, `TypeScript`
- Backend: `NestJS 11`, `TypeScript`
- Database: `PostgreSQL`, `Prisma`

## License

AlphaPony is released under the [MIT License](./LICENSE).

## Quick Start

### Option A: Docker Compose

The fastest self-hosted path is Docker Compose with the published Docker Hub image:

```bash
docker compose -f docker-compose.hub.yml up -d
```

This pulls `jiuwuwu/alphapony:0.1.0` and starts PostgreSQL. To build the image locally from source instead:

```bash
docker compose up --build
```

Default addresses:

- Frontend: `http://127.0.0.1:3000`
- Backend: `http://127.0.0.1:4000`

The Docker entrypoint waits for PostgreSQL, runs Prisma migrations, and seeds demo data only when the database is empty. To stop the stack:

```bash
docker compose down
```

Use `docker compose down -v` only when you also want to delete the PostgreSQL volume.

If local ports `3000`, `4000`, or `5432` are already in use, override them before starting:

```bash
ALPHAPONY_WEB_PORT=3310 ALPHAPONY_API_PORT=4310 ALPHAPONY_POSTGRES_PORT=5433 docker compose -f docker-compose.hub.yml up -d
```

### Option B: Local Node.js

#### 1. Prepare environment variables

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

Optional Telegram alert variables:

- `TELEGRAM_BOT_TOKEN`: your own Telegram bot token from BotFather
- `TELEGRAM_ALERT_CHAT_ID`: your own alert destination chat ID

AlphaPony does not ship with a default Telegram bot. You can configure Telegram alerts either in `.env` or from the Management page after startup.

#### 2. Start the database

If PostgreSQL is already installed and running locally, just use your own `DATABASE_URL`.  
If you want to start the bundled PostgreSQL service with Docker:

```bash
npm run db:up
```

#### 3. Start the application

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
