import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const TAKE = 20;
const DIVERSITY_WINDOW = 3;
const DIVERSITY_PENALTY = 2;

function parseList(value: string | null): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function clampYear(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return parsed;
}

function getTrailerPriority(kind: string): number {
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

function pickBestTrailer(
  trailers: {
    source: string;
    sourceVideoId: string;
    kind: string;
    isOfficial: boolean;
  }[],
) {
  if (trailers.length === 0) {
    return null;
  }

  const sorted = [...trailers].sort((a, b) => {
    if (a.isOfficial !== b.isOfficial) {
      return a.isOfficial ? -1 : 1;
    }
    return getTrailerPriority(b.kind) - getTrailerPriority(a.kind);
  });

  const trailer = sorted[0];
  if (!trailer) {
    return null;
  }
  return {
    source: trailer.source,
    video_id: trailer.sourceVideoId,
    kind: trailer.kind,
    is_official: trailer.isOfficial,
  };
}

function toOverviewShort(overview?: string | null): string {
  if (!overview) {
    return '';
  }
  if (overview.length <= 160) {
    return overview;
  }
  return `${overview.slice(0, 157)}...`;
}

type FeedTitle = {
  id: string;
  title: string;
  year: number | null;
  countries: string[];
  genres: string[];
  overview: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  trailers: {
    source: string;
    sourceVideoId: string;
    kind: string;
    isOfficial: boolean;
  }[];
};

function diversifyByGenre(items: FeedTitle[]): FeedTitle[] {
  const remaining = items.map((item, index) => ({ item, index }));
  const output: FeedTitle[] = [];
  const recent: string[][] = [];

  while (remaining.length > 0) {
    const recentSet = new Set(recent.flat());
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let i = 0; i < remaining.length; i += 1) {
      const candidate = remaining[i];
      if (!candidate) {
        continue;
      }
      const genres = candidate.item.genres ?? [];
      let score = 0;

      for (const genre of genres) {
        if (recentSet.has(genre)) {
          score += DIVERSITY_PENALTY;
        }
      }

      const bestCandidate = remaining[bestIndex];
      if (!bestCandidate) {
        bestIndex = i;
        bestScore = score;
        continue;
      }
      if (
        score < bestScore ||
        (score === bestScore && candidate.index < bestCandidate.index)
      ) {
        bestScore = score;
        bestIndex = i;
      }

      if (bestScore === 0) {
        break;
      }
    }

    const [selected] = remaining.splice(bestIndex, 1);
    if (!selected) {
      break;
    }
    output.push(selected.item);
    recent.push(selected.item.genres ?? []);

    if (recent.length > DIVERSITY_WINDOW) {
      recent.shift();
    }
  }

  return output;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const typeParam = searchParams.get('type');
  const genres = parseList(searchParams.get('genres'));
  const countries = parseList(searchParams.get('countries'));
  const languages = parseList(searchParams.get('lang'));
  const yearMin = clampYear(searchParams.get('year_min'));
  const yearMax = clampYear(searchParams.get('year_max'));
  const cursor = searchParams.get('cursor');

  const where: Record<string, unknown> = {};

  if (typeParam === 'movie' || typeParam === 'tv') {
    where.type = typeParam;
  }
  if (genres.length > 0) {
    where.genres = { hasSome: genres };
  }
  if (countries.length > 0) {
    where.countries = { hasSome: countries };
  }
  if (languages.length > 0) {
    where.languages = { hasSome: languages };
  }
  if (yearMin || yearMax) {
    where.year = {
      ...(yearMin ? { gte: yearMin } : {}),
      ...(yearMax ? { lte: yearMax } : {}),
    };
  }

  try {
    const results = await prisma.title.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: TAKE + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      include: {
        trailers: {
          select: {
            source: true,
            sourceVideoId: true,
            kind: true,
            isOfficial: true,
          },
        },
      },
    });

    let nextCursor: string | null = null;
    let items = results;

    if (results.length > TAKE) {
      const nextItem = results[TAKE];
      if (nextItem) {
        nextCursor = nextItem.id;
      }
      items = results.slice(0, TAKE);
    }

    const diversified = diversifyByGenre(items as FeedTitle[]);
    const feedItems = diversified.map((title) => ({
      title_id: title.id,
      title: title.title,
      year: title.year,
      countries: title.countries,
      genres: title.genres,
      overview_short: toOverviewShort(title.overview),
      poster_url: title.posterUrl,
      backdrop_url: title.backdropUrl,
      trailer: pickBestTrailer(title.trailers),
    }));

    return NextResponse.json({ items: feedItems, next_cursor: nextCursor });
  } catch (error) {
    console.error('Feed query failed', {
      error,
      url: request.url,
    });
    return NextResponse.json(
      { error: 'Failed to load feed.' },
      { status: 500 },
    );
  }
}
