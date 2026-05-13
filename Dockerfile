FROM node:22-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci

COPY backend backend
COPY frontend frontend

RUN DATABASE_URL="postgresql://postgres:postgres@localhost:5432/alphapony?schema=public" npx prisma generate --config backend/prisma.config.ts
RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=4000 \
    WEB_HOST=0.0.0.0 \
    WEB_PORT=3000 \
    API_BASE_URL=http://127.0.0.1:4000 \
    NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4000 \
    WEB_BASE_URL=http://127.0.0.1:3000 \
    ALPHAPONY_SEED_ON_EMPTY=1

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --omit=dev

COPY backend/prisma backend/prisma
COPY backend/prisma.config.ts backend/prisma.config.ts
RUN DATABASE_URL="postgresql://postgres:postgres@localhost:5432/alphapony?schema=public" npx prisma generate --config backend/prisma.config.ts

COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/frontend/.next frontend/.next
COPY frontend/public frontend/public
COPY scripts scripts
COPY README.md README.ch.md LICENSE ./

EXPOSE 3000 4000

CMD ["node", "scripts/docker-entrypoint.cjs"]
