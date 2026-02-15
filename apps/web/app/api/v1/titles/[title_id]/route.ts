import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = {
  params: Promise<{
    title_id: string;
  }>;
};

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

export async function GET(request: Request, { params }: Params) {
  const pathname = new URL(request.url).pathname;
  const resolvedParams = await params;
  const titleId = resolvedParams?.title_id ?? pathname.split('/').pop() ?? '';

  if (!titleId) {
    console.warn('Title lookup missing id', { url: request.url });
    return NextResponse.json({ error: 'Missing title_id' }, { status: 400 });
  }

  try {
    const title = await prisma.title.findUnique({
      where: { id: titleId },
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

    if (!title) {
      return NextResponse.json({ error: 'Title not found' }, { status: 404 });
    }

    const item = {
      title_id: title.id,
      title: title.title,
      year: title.year,
      countries: title.countries,
      genres: title.genres,
      overview_short: toOverviewShort(title.overview),
      poster_url: title.posterUrl,
      trailer: pickBestTrailer(title.trailers),
    };

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Title lookup failed', {
      error,
      url: request.url,
      titleId,
    });
    return NextResponse.json(
      { error: 'Failed to load title.' },
      { status: 500 },
    );
  }
}
