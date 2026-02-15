import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function parseUserId(request: Request): string | null {
  const { searchParams } = new URL(request.url);
  return searchParams.get('user_id');
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

export async function GET(request: Request) {
  const userId = parseUserId(request);

  if (!userId) {
    console.warn('Watchlist missing user_id', { url: request.url });
    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  }

  try {
    const watchlist = await prisma.userWatchlist.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        title: {
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
        },
      },
    });

    const items = watchlist.map((entry) => ({
      title_id: entry.titleId,
      title: entry.title.title,
      year: entry.title.year,
      countries: entry.title.countries,
      genres: entry.title.genres,
      overview_short: toOverviewShort(entry.title.overview),
      poster_url: entry.title.posterUrl,
      trailer: pickBestTrailer(entry.title.trailers),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Watchlist query failed', {
      error,
      url: request.url,
      userId,
    });
    return NextResponse.json(
      { error: 'Failed to load watchlist.' },
      { status: 500 },
    );
  }
}
