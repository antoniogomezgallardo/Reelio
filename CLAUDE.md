# CLAUDE.md — Reelio (Project Context for Claude Code)

## 0) TL;DR
**Reelio** es una app de descubrimiento de cine/series basada en un **carrusel de tráilers** (swipe), con **filtros finos** y **personalización** (“Más como esto / Menos como esto”). El objetivo es que el usuario pase de “no sé qué ver” a “guardado / ver ahora” en segundos. Monetización **sin paywall**: anuncios nativos + patrocinios + afiliación “dónde verla”.

Este documento define el **MVP**, reglas de producto, arquitectura sugerida, modelos de datos, endpoints y analítica. Úsalo como fuente de verdad al implementar.

---

## 1) Principios del producto
### 1.1 Propuesta de valor
- Feed tipo “TikTok” pero con cerebro: **trailers + filtros + curación + anti-spoilers**.
- No queremos “tráilers random”: queremos **descubrimiento con intención**.

### 1.2 Experiencia núcleo (loop)
1) Usuario abre → 2) swipe trailers → 3) micro-recompensa (descubrir)  
4) guarda o descarta → 5) comparte o “ver ahora” → 6) vuelve mañana

### 1.3 Restricciones clave (muy importantes)
- **No alojar ni permitir descarga de vídeos.**
- Reproducir desde **fuentes autorizadas** (ideal: YouTube oficial mediante embed/Player).
- En todo caso, cumplir políticas de plataforma (App Store/Play Store) y términos del proveedor de vídeo.
- Evitar “spoilers”: ofrecer modo teaser/primeros X segundos.

---

## 2) Alcance del MVP (v1)
### 2.1 Features imprescindibles
- **Feed carrusel de trailers** (swipe).
- **Preview 10–20s** + botón “Ver tráiler completo”.
- **Filtros** (mínimos):
  - Tipo: Película / Serie
  - Género (multi)
  - País
  - Año (rango)
  - Idioma (VO/Doblada/Ambos)
- Acciones en cada card:
  - ❤️ Guardar (watchlist)
  - 👍 “Más como esto”
  - 👎 “Menos como esto”
  - ↗ Compartir (deep link)
- Ficha compacta:
  - Título, año, país, duración
  - Sinopsis corta (1–2 líneas)
  - Director + 3–5 actores
  - Tags “mood” (limitados)
- **Guest mode** (sin login) + login opcional (Apple/Google/email).
- **Colecciones editoriales** (mínimo 6):
  - Cult / Midnight
  - Noir
  - Grindhouse / Exploitation
  - Thriller con misterio
  - “España 80/90 vibes” (placeholder)
  - “Joyas ocultas”
- **Analítica de eventos** (ver sección 6).

### 2.2 v1.1 (post-MVP, pero preparar la base)
- “Anti-spoiler mode”: solo teaser / primeros 30–45s
- “Por qué te lo muestro” (explicación simple)
- “Dónde verla” (si hay fuente fiable de disponibilidad)

---

## 3) Datos: qué necesitamos y cómo
### 3.1 Metadata
Necesitamos un catálogo con:
- Title, original_title
- type: movie | tv
- year, runtime
- genres[], countries[], languages[]
- cast[], director(s)
- overview
- poster/backdrop
- ratings (si hay)
- keywords/tags (incluye “mood tags” internos)

**Nota:** la implementación puede usar un proveedor tipo TMDB u otro, pero el código debe ser *provider-agnostic* (adaptador).

### 3.2 Vídeo (trailers)
- Guardamos referencia al vídeo (ej: `youtube_video_id`) + metadata (duración, idioma si se conoce, fuente).
- Priorizamos “Official Trailer” (canal oficial/estudio/verificado si posible).

### 3.3 Dónde verla (opcional MVP)
- Solo integrar si hay fuente legal/estable.
- Si no, mostrar “Buscar en tu plataforma” como enlace genérico o desactivar.

---

## 4) Arquitectura sugerida (pragmática)
> Objetivo: construir rápido, mantener simple, pero con separación clara.

### 4.1 Opción recomendada (rápida y mantenible)
- **Frontend**: una sola app (web primero) para validar:
  - Next.js + TypeScript
  - UI simple: feed con swipe (pointer/touch), filtros, watchlist
- **Backend API**: Node.js (Fastify/Nest) o Python (FastAPI), pero consistente con TS si eliges Next.
- **DB**: Postgres (core) + Redis (cache feed).

> Si el objetivo final es móvil nativo, se puede migrar/duplicar front a React Native/Expo después. El backend y el modelo de datos se mantienen.

### 4.2 Componentes lógicos
- Catalog Service (ingesta + normalización)
- Feed Service (ranking + filtros + paginación)
- User Service (perfil, watchlist, feedback)
- Analytics (events)

---

## 5) Modelo de datos (mínimo viable)
### 5.1 Tablas principales (Postgres)
**users**
- id (uuid)
- created_at
- auth_provider
- locale, timezone

**titles**
- id (uuid)
- provider (string)  // ej: tmdb
- provider_id (string)
- type (movie|tv)
- title, original_title
- year, runtime_minutes
- overview
- poster_url, backdrop_url
- countries[], languages[]
- created_at, updated_at

**title_people**
- id
- title_id
- person_name
- role (actor|director)
- order_index

**trailers**
- id
- title_id
- source (youtube|other)
- source_video_id
- kind (teaser|trailer|clip)
- language (nullable)
- duration_seconds (nullable)
- is_official (boolean)
- created_at

**user_watchlist**
- user_id
- title_id
- created_at

**user_feedback**
- id
- user_id (nullable si guest)
- title_id
- trailer_id (nullable)
- action (like|dislike|save|share|open|complete)
- created_at
- metadata jsonb (device, filter_state, etc.)

**collections**
- id
- slug
- title
- description

**collection_items**
- collection_id
- title_id
- order_index

### 5.2 Reglas
- Un `title` puede tener múltiples trailers; el feed escoge uno “best trailer” (prioridad: official + trailer > teaser > clip).
- Duplicados se controlan por (provider, provider_id).

---

## 6) Analítica (eventos obligatorios)
> Sin analítica, Reelio vuela a ciegas.

Eventos mínimos (todos con `timestamp`, `session_id`, `user_id|guest_id`, `title_id`, `trailer_id`, `position_in_feed`, `active_filters`):

- `app_open`
- `feed_impression` (cuando una card entra en viewport)
- `trailer_play`
- `trailer_pause`
- `trailer_complete` (>= 90% o final)
- `swipe_next` / `swipe_prev`
- `save_watchlist`
- `unsave_watchlist`
- `feedback_more_like_this` (like)
- `feedback_less_like_this` (dislike)
- `share_click`
- `share_complete` (si se puede detectar)
- `filter_change` (con diff)
- `open_title_details`

Métricas derivadas:
- D1/D7 retention
- trailers vistos por sesión
- completion rate
- save rate
- share rate
- CTR a “ver ahora” (cuando exista)

---

## 7) Feed y ranking (versión 1 simple)
### 7.1 Objetivo del feed
Entregar una lista paginada de `cards` (title + best trailer) según filtros.

### 7.2 Estrategia inicial (no-ML)
Puntuar títulos por:
- **prioridad editorial** (colecciones)
- **popularidad** (si existe)
- **recencia** (estrenos)
- **calidad proxy** (ratings si hay)
- **diversidad** (evitar 10 seguidas del mismo género)

Luego aplicar:
- filtros (hard)
- “blocklist” (si usuario hizo dislike)
- boost (si usuario hizo like / guardó algo similar)

### 7.3 Personalización ligera
- “Más como esto”: aumentar peso de géneros/país/año/tags del título.
- “Menos como esto”: reducir peso o bloquear cluster cercano.

---

## 8) API (contrato sugerido)
Base: `/api/v1`

### 8.1 Feed
`GET /feed`
Query:
- `type=movie|tv|all`
- `genres=...`
- `countries=...`
- `year_min=...&year_max=...`
- `lang=...`
- `cursor=...`
Response:
- `items: FeedCard[]`
- `next_cursor`

**FeedCard**
- title_id
- title, year, countries, genres
- overview_short
- poster_url
- trailer: { source, video_id, kind, is_official }
- reason (optional, v1.1)

### 8.2 Title details
`GET /titles/:id`

### 8.3 Watchlist
`GET /me/watchlist`
`POST /me/watchlist/:title_id`
`DELETE /me/watchlist/:title_id`

### 8.4 Feedback/Events
`POST /events` (batch)
Body: `{ events: [...] }`

---

## 9) Monetización (sin paywall)
### 9.1 Ads nativos (v1: preparar, v2: activar)
- Insertar “SponsoredCard” cada N swipes (ej 12–15).
- Debe venir etiquetada “Sponsored”.
- Frequency cap por sesión y por día.

### 9.2 Patrocinios
- Takeover de colección o placement top.
- Reporting con completions + clicks.

### 9.3 Afiliación “Dónde verla”
- Solo si hay proveedor fiable.
- CTA: “Ver ahora” o “Dónde verla”.

---

## 10) Definición de “done” (para PRs)
- Código compila y pasa tests.
- No rompe el contrato API.
- Logs y errores con trazabilidad (no silenciar).
- UI: loading states + empty states + error states.
- Accesibilidad básica (teclado, labels).
- Performance: feed < 1s desde cache en entorno local (objetivo orientativo).

---

## 11) Convenciones de repo (propuesta)
Estructura recomendada (web + api):
- `/apps/web` (Next.js)
- `/apps/api` (Fastify/Nest o Next API routes si ultra-simple)
- `/packages/shared` (types, utils)
- `/infra` (docker-compose, db migrations)

Convenciones:
- TypeScript estricto.
- ESLint + Prettier.
- Commits con estilo: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.

## 11.1) Gestión de proyecto y VCS (obligatorio)
- Gestionaremos tareas, milestones y cards en GitHub Projects; toda nueva tarea debe existir como issue antes de implementarse.
- Los avances se reflejan moviendo la card en el Project (Backlog → In Progress → Review → Done).
- Usaremos Git como VCS y el remoto principal será GitHub.
- Los commits deben seguir buenas prácticas: mensajes cortos, claros y con prefijo (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).
- Se trabaja en ramas y se integra por PR; cada PR debe referenciar su issue.

---

## 12) Plan de implementación por hitos
### Milestone 1 — Skeleton
- Repo + lint + prettier + env
- DB + migrations
- Catalog minimal (seed de 200 titles)
- Feed endpoint básico

### Milestone 2 — MVP funcional
- UI feed con swipe
- Filtros
- Watchlist
- Events batch

### Milestone 3 — Beta
- Colecciones editoriales
- Anti-spoiler mode
- Share cards + deep links
- Monitoring + crash/error reporting

### Milestone 4 — Growth readiness
- Ranking mejorado + diversidad
- Ads placeholders + sponsorship config (sin activar si no procede)
- “Dónde verla” si hay provider

---

## 13) Cómo debe trabajar Claude (instrucciones)
- Prioriza **implementar el MVP** antes de refinar.
- Mantén el sistema **provider-agnostic** (adaptadores para metadata y trailers).
- No inventes dependencias raras si no aportan valor real.
- Cada PR debe incluir:
  - cambios + tests mínimos
  - actualización de docs si cambia contrato
- Si falta información, asume una solución simple y deja `TODO:` bien documentado.

---

## 14) Glosario rápido
- **Card**: unidad del feed (título + trailer).
- **Teaser mode**: ver solo primeros X segundos.
- **Moods**: etiquetas semánticas (no género): “tensión”, “misterio con pistas”, “grindhouse”, etc.
- **Completion rate**: % de trailers que llegan al final.

---

## 15) Estado actual del proyecto
- Nombre: **Reelio**
- Objetivo inmediato: construir MVP (feed + filtros + watchlist + eventos)
- Objetivo de negocio: monetización sin paywall (ads nativos + sponsors + afiliación)
- Stack decidido: Next.js + TypeScript (web + API routes), Postgres + Prisma
- Progreso: esqueleto de monorepo iniciado (apps/web, packages/shared), Prisma inicializado con esquema MVP

(Actualiza esta sección conforme avances.)
