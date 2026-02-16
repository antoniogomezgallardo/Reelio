import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const DEFAULT_PAGES = 5;
const DEFAULT_LIMIT = 200;
const DEFAULT_CONCURRENCY = 4;

const prisma = new PrismaClient();

function getArgValue(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return fallback;
  }
  const next = process.argv[index + 1];
  return next ?? fallback;
}

function parseNumber(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed;
}

function normalizeGenre(name) {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

function buildImageUrl(path, size) {
  if (!path) {
    return null;
  }
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TMDB request failed: ${response.status} ${text}`);
  }
  return response.json();
}

function buildUrl(path, params) {
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

async function fetchGenres(type, apiKey) {
  const data = await fetchJson(
    buildUrl(`/genre/${type}/list`, {
      api_key: apiKey,
    }),
  );
  const map = new Map();
  for (const genre of data.genres ?? []) {
    if (genre?.id && genre?.name) {
      map.set(genre.id, normalizeGenre(genre.name));
    }
  }
  return map;
}

async function fetchDiscover(type, page, apiKey) {
  return fetchJson(
    buildUrl(`/discover/${type}`, {
      api_key: apiKey,
      page,
      include_adult: false,
      sort_by: 'popularity.desc',
    }),
  );
}

async function fetchDetails(type, id, apiKey) {
  return fetchJson(
    buildUrl(`/${type}/${id}`, {
      api_key: apiKey,
    }),
  );
}

async function fetchVideos(type, id, apiKey) {
  return fetchJson(
    buildUrl(`/${type}/${id}/videos`, {
      api_key: apiKey,
    }),
  );
}

function mapVideoKind(type) {
  const normalized = String(type ?? '').toLowerCase();
  if (normalized.includes('trailer')) {
    return 'trailer';
  }
  if (normalized.includes('teaser')) {
    return 'teaser';
  }
  if (normalized.includes('clip')) {
    return 'clip';
  }
  return null;
}

function getVideoPriority(kind) {
  switch (kind) {
    case 'trailer':
      return 3;
    case 'teaser':
      return 2;
    case 'clip':
      return 1;
    default:
      return 0;
  }
}

function pickBestVideo(videos) {
  const candidates = (videos ?? [])
    .filter((video) => video?.site === 'YouTube' && video?.key)
    .map((video) => {
      const kind = mapVideoKind(video.type);
      if (!kind) {
        return null;
      }
      return {
        source: 'youtube',
        sourceVideoId: video.key,
        kind,
        language: video.iso_639_1 ?? null,
        durationSeconds: null,
        isOfficial: Boolean(video.official),
        publishedAt: video.published_at ?? null,
      };
    })
    .filter(Boolean);

  if (candidates.length === 0) {
    return null;
  }

  const sorted = [...candidates].sort((a, b) => {
    if (a.isOfficial !== b.isOfficial) {
      return a.isOfficial ? -1 : 1;
    }
    const priorityDiff = getVideoPriority(b.kind) - getVideoPriority(a.kind);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return bTime - aTime;
  });

  const best = sorted[0];
  if (!best) {
    return null;
  }

  return {
    source: best.source,
    sourceVideoId: best.sourceVideoId,
    kind: best.kind,
    language: best.language,
    durationSeconds: best.durationSeconds,
    isOfficial: best.isOfficial,
  };
}

function pickYear(dateValue) {
  if (!dateValue) {
    return null;
  }
  const year = Number.parseInt(dateValue.slice(0, 4), 10);
  return Number.isNaN(year) ? null : year;
}

function mergeUnique(values) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    if (!value) {
      continue;
    }
    const normalized = value.toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      out.push(normalized);
    }
  }
  return out;
}

async function mapToTitleData(entry, details, genreMap) {
  const item = entry.item;
  const isMovie = entry.type === 'movie';
  const title = item.title || item.name;
  const originalTitle = item.original_title || item.original_name || null;

  const genreNames = (details.genres ?? [])
    .map((genre) => normalizeGenre(genre.name))
    .filter(Boolean);

  const fallbackGenres = (item.genre_ids ?? [])
    .map((id) => genreMap.get(id))
    .filter(Boolean);

  const genres = mergeUnique([...genreNames, ...fallbackGenres]);

  const productionCountries = (details.production_countries ?? [])
    .map((country) => country.iso_3166_1)
    .filter(Boolean);

  const originCountries = isMovie ? [] : (details.origin_country ?? []);

  const languages = mergeUnique([
    details.original_language,
    ...(details.spoken_languages ?? []).map((lang) => lang.iso_639_1),
  ]);

  const runtime = isMovie
    ? details.runtime
    : (details.episode_run_time ?? [])[0];

  return {
    provider: 'tmdb',
    providerId: String(item.id),
    type: entry.type,
    title,
    originalTitle,
    year: pickYear(isMovie ? item.release_date : item.first_air_date),
    runtimeMinutes: runtime ?? null,
    overview: item.overview ?? null,
    posterUrl: buildImageUrl(item.poster_path, 'w500'),
    backdropUrl: buildImageUrl(item.backdrop_path, 'w1280'),
    countries: mergeUnique([...productionCountries, ...originCountries]),
    languages,
    genres,
  };
}

async function runWithLimit(items, limit, handler) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      if (!current) {
        continue;
      }
      results.push(await handler(current));
    }
  }

  const workers = Array.from({ length: limit }, () => worker());
  await Promise.all(workers);
  return results;
}

function createTmdbProvider(apiKey) {
  return {
    name: 'tmdb',
    async listTitles(types, pages, limit, concurrency) {
      const genreMaps = new Map();
      for (const type of types) {
        genreMaps.set(type, await fetchGenres(type, apiKey));
      }

      const discovered = [];
      const seen = new Set();

      for (const type of types) {
        for (let page = 1; page <= pages; page += 1) {
          const data = await fetchDiscover(type, page, apiKey);
          for (const item of data.results ?? []) {
            if (!item?.id) {
              continue;
            }
            const key = `${type}:${item.id}`;
            if (seen.has(key)) {
              continue;
            }
            seen.add(key);
            discovered.push({ type, item });
          }
        }
      }

      const limited = discovered.slice(0, limit);
      return runWithLimit(limited, concurrency, async (entry) => {
        const details = await fetchDetails(entry.type, entry.item.id, apiKey);
        const videos = await fetchVideos(entry.type, entry.item.id, apiKey);
        const genreMap = genreMaps.get(entry.type) ?? new Map();
        return {
          titleData: await mapToTitleData(entry, details, genreMap),
          trailer: pickBestVideo(videos?.results ?? []),
        };
      });
    },
  };
}

async function main() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error('Missing TMDB_API_KEY env var.');
  }

  const typeArg = getArgValue('--type', 'movie');
  const pages = parseNumber(
    getArgValue('--pages', DEFAULT_PAGES),
    DEFAULT_PAGES,
  );
  const limit = parseNumber(
    getArgValue('--limit', DEFAULT_LIMIT),
    DEFAULT_LIMIT,
  );
  const concurrency = parseNumber(
    getArgValue('--concurrency', DEFAULT_CONCURRENCY),
    DEFAULT_CONCURRENCY,
  );

  const types = typeArg === 'all' ? ['movie', 'tv'] : [typeArg];
  const allowedTypes = new Set(['movie', 'tv']);
  const finalTypes = types.filter((type) => allowedTypes.has(type));

  if (finalTypes.length === 0) {
    throw new Error('Invalid --type. Use movie, tv, or all.');
  }

  const provider = createTmdbProvider(apiKey);
  const mapped = await provider.listTitles(
    finalTypes,
    pages,
    limit,
    concurrency
  );

  let processed = 0;
  for (const entry of mapped) {
    const stored = await prisma.title.upsert({
      where: {
        provider_providerId: {
          provider: entry.titleData.provider,
          providerId: entry.titleData.providerId,
        },
      },
      update: entry.titleData,
      create: entry.titleData,
    });
    if (entry.trailer) {
      await prisma.trailer.deleteMany({ where: { titleId: stored.id } });
      await prisma.trailer.create({
        data: {
          titleId: stored.id,
          source: entry.trailer.source,
          sourceVideoId: entry.trailer.sourceVideoId,
          kind: entry.trailer.kind,
          language: entry.trailer.language,
          durationSeconds: entry.trailer.durationSeconds,
          isOfficial: entry.trailer.isOfficial,
        },
      });
    }
    processed += 1;
  }

  console.log(`TMDB ingestion complete: ${processed} titles`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
