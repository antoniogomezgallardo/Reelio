-- CreateEnum
CREATE TYPE "AnalyticsEventName" AS ENUM ('app_open', 'feed_impression', 'trailer_play', 'trailer_pause', 'trailer_complete', 'swipe_next', 'swipe_prev', 'save_watchlist', 'unsave_watchlist', 'feedback_more_like_this', 'feedback_less_like_this', 'share_click', 'share_complete', 'filter_change', 'open_title_details');

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL,
    "name" "AnalyticsEventName" NOT NULL,
    "user_id" UUID,
    "guest_id" TEXT,
    "session_id" TEXT,
    "title_id" UUID,
    "trailer_id" UUID,
    "position_in_feed" INTEGER,
    "active_filters" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "titles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_trailer_id_fkey" FOREIGN KEY ("trailer_id") REFERENCES "trailers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
