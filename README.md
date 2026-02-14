# Reelio

Web-first MVP for a trailer discovery app. See CLAUDE.md for product context and scope.

## Stack
- Next.js + TypeScript (web + API routes)
- Postgres + Prisma (planned for M1 DB setup)

## Docs
- Architecture and decisions: ARCHITECTURE.md

## Structure
- apps/web: Next.js app
- packages/shared: shared types/utilities

## Commands
- npm run dev
- npm run build
- npm run start
- npm run lint

## API
- GET /api/v1/feed
	- Query: type, genres, countries, year_min, year_max, lang, cursor

## UI
- Feed UI (prototype) at /

## Database (Prisma + Postgres)
1) Run Postgres with Docker: `docker compose -f infra/docker-compose.yml up -d`.
2) Copy `apps/web/.env.example` to `apps/web/.env` and set `DATABASE_URL`.
3) Run `npm run prisma:migrate` to create the schema.
4) Run `npm run prisma:seed` to load sample data.
5) Run `npm run prisma:generate` after schema changes.
