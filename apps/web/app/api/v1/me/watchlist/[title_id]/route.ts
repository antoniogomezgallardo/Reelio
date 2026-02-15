import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = {
  params: {
    title_id: string;
  };
};

function parseUserId(request: Request): string | null {
  const { searchParams } = new URL(request.url);
  return searchParams.get("user_id");
}

async function ensureUser(userId: string) {
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId }
  });
}

export async function POST(request: Request, { params }: Params) {
  const userId = parseUserId(request);
  const titleId = params.title_id;

  if (!userId) {
    console.warn("Watchlist add missing user_id", {
      url: request.url,
      titleId
    });
    return NextResponse.json(
      { error: "Missing user_id" },
      { status: 400 }
    );
  }

  try {
    await ensureUser(userId);

    const entry = await prisma.userWatchlist.upsert({
      where: { userId_titleId: { userId, titleId } },
      update: {},
      create: { userId, titleId }
    });

    return NextResponse.json({
      user_id: entry.userId,
      title_id: entry.titleId
    });
  } catch (error) {
    console.error("Watchlist add failed", {
      error,
      url: request.url,
      userId,
      titleId
    });
    return NextResponse.json(
      { error: "Failed to add watchlist item." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const userId = parseUserId(request);
  const titleId = params.title_id;

  if (!userId) {
    console.warn("Watchlist remove missing user_id", {
      url: request.url,
      titleId
    });
    return NextResponse.json(
      { error: "Missing user_id" },
      { status: 400 }
    );
  }

  try {
    await prisma.userWatchlist.delete({
      where: { userId_titleId: { userId, titleId } }
    });

    return NextResponse.json({
      user_id: userId,
      title_id: titleId
    });
  } catch (error) {
    console.error("Watchlist remove failed", {
      error,
      url: request.url,
      userId,
      titleId
    });
    return NextResponse.json(
      { error: "Failed to remove watchlist item." },
      { status: 500 }
    );
  }
}
