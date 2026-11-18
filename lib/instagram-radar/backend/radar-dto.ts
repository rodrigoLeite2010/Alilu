import "server-only";
import { serializeCounts, serializeItem } from "@/lib/video-queue/backend/queue-dto";
import type { VideoQueueRecord } from "@/lib/video-queue/backend/queue-repository";
import { radarConfigFromQueue } from "@/lib/instagram-radar/radar-config";
import { needsCaptionReview } from "@/lib/instagram-radar/captions";
import type { getRadarDashboard, RadarOverview } from "./radar-service";
import { RadarError } from "./radar-service";
import { NextResponse } from "next/server";
import { VideoQueueError } from "@/lib/video-queue/backend/queue-service";

/** Serialização do Radar Instagram para a tela (nunca inclui tokens). */

const iso = (date: Date | null) => (date ? date.toISOString() : null);

export function serializeRadar(queue: VideoQueueRecord) {
  return {
    id: queue.id,
    name: queue.name,
    status: queue.status,
    pauseReason: queue.pauseReason,
    pausedBySystem: queue.pausedBySystem,
    instagramAccountId: queue.instagramAccountId,
    schedule: radarConfigFromQueue(queue),
    notReadyPolicy: queue.schedule.notReadyPolicy,
    captionTemplate: queue.captionTemplate,
    hashtags: queue.radar?.hashtags ?? "",
    missingCaptionPolicy: queue.radar?.missingCaptionPolicy ?? "DEFAULT",
    createdAt: queue.createdAt.toISOString(),
    activatedAt: iso(queue.activatedAt),
  };
}

export function serializeRadarOverview(entry: RadarOverview) {
  return {
    radar: serializeRadar(entry.queue),
    counts: serializeCounts(entry.counts),
    account: entry.account,
  };
}

export function serializeRadarDashboard(dashboard: Awaited<ReturnType<typeof getRadarDashboard>>) {
  const policy = dashboard.queue.radar?.missingCaptionPolicy ?? "DEFAULT";
  return {
    radar: serializeRadar(dashboard.queue),
    counts: serializeCounts(dashboard.counts),
    nextPublicationAt: dashboard.nextPublicationAt,
    account: dashboard.account,
    items: dashboard.items.map(({ item, post }) => ({
      ...serializeItem(item, post, []),
      awaitingCaptionReview: item.status === "READY" && needsCaptionReview(policy, item.caption),
    })),
    preview: dashboard.preview,
    events: dashboard.events.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
  };
}

export type RadarDto = ReturnType<typeof serializeRadar>;
export type RadarOverviewDto = ReturnType<typeof serializeRadarOverview>;
export type RadarDashboardDto = ReturnType<typeof serializeRadarDashboard>;

export function radarErrorResponse(error: unknown, event: string): NextResponse {
  if (error instanceof RadarError) {
    return NextResponse.json({ error: error.message, code: error.code, suggestions: error.suggestions }, { status: error.httpStatus });
  }
  if (error instanceof VideoQueueError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
  }
  console.error(JSON.stringify({ scope: "instagram-radar", event, message: (error as Error)?.message?.slice(0, 300) }));
  return NextResponse.json({ error: "Não foi possível concluir agora. Tente novamente." }, { status: 500 });
}
