# AlphaPony

Language:

- 中文说明: [`README.md`](README.md)
- English README: [`README.en.md`](README.en.md)

AlphaPony is a crypto market analysis workspace built with:

- `Next.js` frontend
- `NestJS` backend
- `PostgreSQL` + `Prisma`

The product focuses on 6 tracked assets and helps users quickly understand:

- the current rule-based direction
- the current AI direction
- signal-level drivers
- recent events
- recent alerts

Current supported assets:

- `BTC`
- `ETH`
- `SOL`
- `BNB`
- `XRP`
- `DOGE`

## Current Product Scope

Current pages:

- Home dashboard
- Asset detail page
- Asset timeline page
- All-assets timeline page
- Alerts center
- Strategy center
- Management page

Current signal groups:

- Market
- News
- Community
- KOL
- On-chain
- Whale

Current major capabilities:

- rule-based scoring and signal aggregation
- AI analysis with localized Chinese and English output
- strict AI availability gating against the latest snapshot
- Telegram alert delivery
- Chinese / English language switching
- light / dark theme

## Cross-Platform Runtime

The core script entrypoints are now implemented in Node and are intended for:

- `macOS`
- `Linux`
- `Windows`

Unified cross-platform commands:

- `npm run start`
- `npm run stop`
- `npm run healthcheck`
- `npm run setup`
- `npm run prisma:generate`
- `npm run prisma:migrate:deploy`
- `npm run check-update`
- `npm run update`
- `npm run package-release`
- `npm run db:backup`
- `npm run api:start`
- `npm run web:start`

Commands that still depend on host-level tools:

- `npm run db:up` requires `docker compose`
- `npm run db:backup` requires either `pg_dump` or Docker access to PostgreSQL

## Tech Stack

- Frontend: `Next.js 14`, `React 18`, `TypeScript`
- Backend: `NestJS 11`, `TypeScript`
- Database: `PostgreSQL`, `Prisma`

## Local Development

### 1. Prepare environment variables

Copy the example file:

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
- `ALPHAPONY_UPDATE_MANIFEST_URL`
- `ALPHAPONY_RELEASE_BASE_URL`
- `ALPHAPONY_SKIP_DB_BACKUP`

### 2. Start PostgreSQL

```bash
npm run db:up
```

### 3. Start the application

```bash
npm run start
```

On the first run, `start` will automatically bootstrap:

- `npm ci`
- database availability checks
- Prisma Client generation
- frontend/backend builds
- it first tries `DATABASE_URL`
- if the database is unavailable and Docker is installed, it will try `docker compose up -d postgres`
- production migrations when `DATABASE_URL` is configured

### 4. Common development commands

If you want to run development tasks manually, you can still use:

```bash
npm run prisma:migrate:dev
npm run db:seed
npm run api:dev
npm run dev
```

Default addresses:

- Frontend: `http://127.0.0.1:3000`
- Backend: `http://127.0.0.1:4000`

## Available Scripts

Root scripts:

```bash
npm run dev
npm run build
npm run start
npm run stop
npm run healthcheck
npm run check-update
npm run update
npm run package-release
npm run lint
npm run api:dev
npm run api:build
npm run api:start
npm run web:build
npm run web:start
npm run db:up
npm run db:backup
npm run prisma:generate
npm run prisma:migrate:dev
npm run prisma:migrate:deploy
npm run db:seed
```

## Release Runtime Convention

For production-style runs and future release updates, env files are resolved in this order:

1. the path pointed to by `ALPHAPONY_ENV_PATH`
2. `data/env/.env`
3. the project root `.env`

Recommended release usage:

- keep runtime config in `data/env/.env`
- use `npm run start` for the first run as well; missing dependencies or build output will be bootstrapped automatically
- run `npm run prisma:migrate:deploy` for production database migrations
- use `npm run start` as the unified production start entry
- use `npm run stop` as the unified stop entry
- use `npm run healthcheck` as the unified health check entry
- use `npm run check-update` to inspect the remote manifest for a newer version
- use `npm run db:backup` for database backups
- use `npm run update` for the base update flow: backup, stop, build, production migration, restart, and health check
- use `npm run package-release` to generate the current release zip and `dist/release/latest.json`

If you are running from source directly, using the root `.env` is still supported.

The lightweight release package does not include `node_modules`, `.next`, `.next-dev`, or build caches. In most cases the user only needs:

```bash
npm run start
```

If Node.js and npm are already installed on the target machine, this command will bootstrap the first run automatically.

The start script will automatically bootstrap:

- `npm ci`
- database availability checks
- Prisma Client generation
- frontend/backend builds
- `prisma migrate deploy` when needed

If you explicitly want to run a full initialization ahead of time, you can still use:

```bash
npm run setup
```

Remote update convention:

- `ALPHAPONY_UPDATE_MANIFEST_URL` points to the remote `latest.json`
- `latest.json` must include at least:

```json
{
  "version": "0.1.0",
  "url": "https://example.com/alphapony-0.1.0-darwin-arm64.zip",
  "sha256": "..."
}
```

The update order is now:

1. download and verify the new package
2. back up the database
3. stop services
4. replace application files
5. run production migrations
6. restart and run health checks

If `pg_dump` is unavailable and Docker access is not possible in a given environment, you can manually run:

```bash
ALPHAPONY_SKIP_DB_BACKUP=1 npm run update
```

The default recommendation is still to keep database backups enabled.

## Build

Frontend production build:

```bash
npm run build -w frontend
```

Backend production build:

```bash
npm run build -w backend
```

## Runtime Notes

Current refresh behavior:

- the home page auto-refreshes every `15s` while visible
- the detail page auto-refreshes every `15s` while AI is unavailable

Current data refresh cadence:

- market: `15s`
- news: `10m`
- community: `10m`
- KOL: `10m`
- on-chain / whale: `5m`

Current AI behavior:

- AI is considered available only when it matches the latest analysis snapshot
- AI requests use timeout and retry protection
- both periodic and snapshot-change recomputes are enabled
