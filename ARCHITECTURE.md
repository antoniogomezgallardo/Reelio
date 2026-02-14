# Architecture and Decisions (Reelio)

This document explains the architecture, tools, and decisions behind the Reelio MVP. It is meant as a learning guide, not just a reference.

## 1) What is a monorepo and why we use it
A monorepo is a single git repository that contains multiple apps and packages.

Why we chose it:
- One source of truth: frontend, API, and shared types live together.
- Faster changes: when you update a type, both UI and API can use it immediately.
- Simpler onboarding: one repo to clone, one set of scripts.
- Clear growth path: we can later split apps if needed without re-architecting.

How it looks here:
- apps/web: Next.js app (UI + API routes)
- packages/shared: shared code (types, utilities)
- infra: local infrastructure (Docker)

## 2) High-level architecture
We run a web app that also exposes API routes. The API reads from Postgres and returns data for the feed.

Data flow (simplified):
1) Browser requests / (UI).
2) UI calls /api/v1/feed (API route in Next.js).
3) API queries Postgres via Prisma.
4) API returns JSON to UI.
5) UI renders cards.

This is enough for MVP. Later we can extract the API into a separate service if needed.

## 3) Next.js
What it is:
- A React framework that provides routing, server rendering, and API routes.

Why we chose it:
- Fast MVP iteration (one codebase for UI and API).
- Production ready with a simple deploy story.
- Great TypeScript support.

How we use it:
- App Router under apps/web/app.
- API routes under apps/web/app/api.

## 4) TypeScript
What it is:
- A typed superset of JavaScript.

Why we chose it:
- Fewer runtime bugs (types catch errors early).
- Better editor support (autocomplete, refactors).
- Shared types between UI and API.

How it helps here:
- Feed response types used by both API and UI.

## 5) Prisma
What it is:
- An ORM (Object Relational Mapper). It maps tables to TypeScript models and helps you write queries.

Why we chose it:
- Excellent developer experience.
- Easy migrations.
- Generates a typed client that reduces query mistakes.

How it is used:
- Schema is defined in apps/web/prisma/schema.prisma.
- Prisma generates a client used by API routes.
- Migrations track changes to the database.

## 6) Postgres
What it is:
- A relational database.

Why we chose it:
- Strong SQL features, reliable, widely supported.
- Fits our relational data (titles, trailers, people, collections).

How it is used:
- Local dev uses Docker.
- Prisma runs migrations to create/update tables.

## 7) Docker (local)
What it is:
- A container runtime. It runs services in isolated containers.

Why we chose it:
- Consistent local database setup across machines.
- No manual Postgres installs.

How it is used:
- infra/docker-compose.yml defines a local Postgres.
- You start it with docker compose.

## 8) Migrations (what are they)
A migration is a versioned change to the database schema.

Why we need them:
- Databases need a controlled, repeatable way to evolve.
- Migrations are a history of schema changes.

How we use them:
- Change schema in Prisma.
- Run prisma:migrate to create and apply a migration.
- The migration is committed to git.

## 9) API routes
What they are:
- Server-side endpoints hosted inside Next.js.

Why we use them now:
- Simple and fast for MVP.
- No extra server to manage.

How they work:
- A request hits /api/v1/feed.
- Code queries Prisma and returns JSON.

## 10) How the tools relate
- Next.js hosts both UI and API.
- TypeScript is used everywhere.
- Prisma sits between API and Postgres.
- Postgres stores the data.
- Docker runs Postgres locally.

## 11) Why not other options (brief)
- Separate backend (Fastify/Nest): great later, but adds complexity now.
- No ORM: raw SQL is powerful but slower to build and easy to break.
- SQLite: simpler, but not ideal for production parity.

## 12) Current MVP decisions recap
- Web-first MVP in Next.js to iterate quickly.
- Monorepo to keep UI + API + shared code together.
- Postgres for relational data.
- Prisma for schema and typed queries.
- Docker for local DB consistency.

## 13) If we scale later
- Split API into apps/api (Fastify or Nest).
- Add Redis cache for feed.
- Add background jobs for ingestion.
- Add provider adapters (TMDB, etc).

## 14) Quick glossary
- Monorepo: one repo, many apps.
- API route: server endpoint inside Next.js.
- ORM: tool that maps tables to code models.
- Migration: a versioned schema change.
- Seed: sample data used for local dev.
