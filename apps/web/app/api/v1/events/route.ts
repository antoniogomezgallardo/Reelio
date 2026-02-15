import { NextResponse } from 'next/server';
import { AnalyticsEventName, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const allowedEventNames: AnalyticsEventName[] = [
  'app_open',
  'feed_impression',
  'trailer_play',
  'trailer_pause',
  'trailer_complete',
  'swipe_next',
  'swipe_prev',
  'save_watchlist',
  'unsave_watchlist',
  'feedback_more_like_this',
  'feedback_less_like_this',
  'share_click',
  'share_complete',
  'filter_change',
  'open_title_details',
];

const allowedEventNameSet = new Set(allowedEventNames);

type EventPayload = {
  name: AnalyticsEventName;
  timestamp?: string;
  session_id?: string;
  user_id?: string;
  guest_id?: string;
  title_id?: string;
  trailer_id?: string;
  position_in_feed?: number;
  active_filters?: unknown;
  metadata?: unknown;
};

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value?: string) {
  if (!value) {
    return false;
  }
  return uuidRegex.test(value);
}

function parseTimestamp(value?: string) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || !Array.isArray(body.events)) {
    console.warn('Events payload invalid', { url: request.url });
    return NextResponse.json(
      { error: 'Invalid payload. Expected { events: [] }.' },
      { status: 400 },
    );
  }

  const events = body.events as EventPayload[];
  if (events.length === 0) {
    console.warn('Events payload empty', { url: request.url });
    return NextResponse.json(
      { error: 'Events array is empty.' },
      { status: 400 },
    );
  }

  const invalid = events.filter(
    (event) => !allowedEventNameSet.has(event.name),
  );
  if (invalid.length > 0) {
    console.warn('Events payload invalid names', {
      url: request.url,
      invalid: invalid.map((event) => event.name),
    });
    return NextResponse.json(
      {
        error: 'One or more events have an invalid name.',
        invalid: invalid.map((event) => event.name),
      },
      { status: 400 },
    );
  }

  const userIds = Array.from(
    new Set(events.map((event) => event.user_id).filter((id) => isUuid(id))),
  ) as string[];

  if (userIds.length > 0) {
    await prisma.user.createMany({
      data: userIds.map((id) => ({ id })),
      skipDuplicates: true,
    });
  }

  const records = events.map((event) => ({
    name: event.name,
    userId: isUuid(event.user_id) ? (event.user_id ?? null) : null,
    guestId: event.guest_id ?? null,
    sessionId: event.session_id ?? null,
    titleId: isUuid(event.title_id) ? (event.title_id ?? null) : null,
    trailerId: isUuid(event.trailer_id) ? (event.trailer_id ?? null) : null,
    positionInFeed:
      typeof event.position_in_feed === 'number'
        ? event.position_in_feed
        : null,
    activeFilters: event.active_filters ?? Prisma.JsonNull,
    metadata: event.metadata ?? Prisma.JsonNull,
    createdAt: parseTimestamp(event.timestamp) ?? new Date(),
  }));

  try {
    await prisma.analyticsEvent.createMany({
      data: records,
    });

    return NextResponse.json({
      accepted: records.length,
    });
  } catch (error) {
    console.error('Events batch insert failed', {
      error,
      url: request.url,
    });
    return NextResponse.json(
      { error: 'Failed to record events.' },
      { status: 500 },
    );
  }
}
