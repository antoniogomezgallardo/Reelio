# Reelio

Web-first MVP for a trailer discovery app. See CLAUDE.md for product context and scope.

## Stack

- Next.js + TypeScript (web + API routes)
- Postgres + Prisma (local Docker for dev)
- OpenAPI for contract + Swagger UI

## Docs

- Architecture and decisions: ARCHITECTURE.md

## Structure

- apps/web: Next.js app
- packages/shared: shared types/utilities

## Commands

- npm run dev:stop
- npm run dev
- npm run build
- npm run start
- npm run lint
- npm run format
- npm run format:write
- npm run typecheck
- npm run check
- npm run prisma:generate
- npm run prisma:migrate
- npm run prisma:studio
- npm run prisma:seed
- npm run ingest:tmdb

## API

- GET /api/v1/feed
  - Query: type, genres, countries, year_min, year_max, lang, cursor
- GET /api/v1/titles/:title_id
- GET /api/v1/collections
- GET /api/v1/me/watchlist?user_id=...
- POST /api/v1/me/watchlist/:title_id?user_id=...
- DELETE /api/v1/me/watchlist/:title_id?user_id=...
- POST /api/v1/events

OpenAPI spec: openapi.yaml
Swagger UI: /api/docs
Raw spec endpoint: /api/openapi

## Analytics (events batch)

The POST /api/v1/events endpoint stores analytics events in batch to reduce
network calls and enable core product metrics (completion, saves, shares, etc.).
Guest sessions are identified with a persistent `guest_id` (localStorage) and
per-session `session_id` (sessionStorage), both sent with every event.

## UI

- Feed UI (prototype) at / (sidebar + viewer + details panel)
- Details actions are wired to events + watchlist: save, like/dislike, share
- Teaser mode toggle (30s) and deep link support via ?t=title_id
- Posters are rendered with `next/image` (TMDB host allowlisted in Next config)

## Feed ranking

- Simple diversity heuristic to avoid repeating genres back-to-back.

## Database (Prisma + Postgres)

1. Run Postgres with Docker: `docker compose -f infra/docker-compose.yml up -d`.
2. Copy `apps/web/.env.example` to `apps/web/.env` and set `DATABASE_URL`.
3. Run `npm run prisma:migrate` to create the schema.
4. Run `npm run prisma:seed` to load sample data.
5. Run `npm run prisma:generate` after schema changes.

## Ingestion (TMDB)

1. Set `TMDB_API_KEY` in `apps/web/.env`.
2. Run `npm run ingest:tmdb` to ingest real titles.
