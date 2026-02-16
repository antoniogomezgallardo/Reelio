import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ITEMS_TAKE = 10;

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
  try {
    const collections = await prisma.collection.findMany({
      orderBy: { title: 'asc' },
      include: {
        items: {
          orderBy: { orderIndex: 'asc' },
          take: ITEMS_TAKE,
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
        },
      },
    });

    const response = collections.map((collection) => ({
      id: collection.id,
      slug: collection.slug,
      title: collection.title,
      description: collection.description,
      items: collection.items.map((entry) => ({
        title_id: entry.title.id,
        title: entry.title.title,
        year: entry.title.year,
        countries: entry.title.countries,
        genres: entry.title.genres,
        overview_short: toOverviewShort(entry.title.overview),
        poster_url: entry.title.posterUrl,
        backdrop_url: entry.title.backdropUrl,
        trailer: pickBestTrailer(entry.title.trailers),
      })),
    }));

    return NextResponse.json({ collections: response });
  } catch (error) {
    console.error('Collections query failed', {
      error,
      url: request.url,
    });
    return NextResponse.json(
      { error: 'Failed to load collections.' },
      { status: 500 },
    );
  }
}
