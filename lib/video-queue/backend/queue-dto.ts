import "server-only";
import { findCategory, findTheme } from "@/lib/video-queue/catalog";
import type { QueueCounts, QueuePostState, VideoQueueItemRecord, VideoQueueRecord } from "./queue-repository";
import type { getQueueDashboard } from "./queue-service";
import type { PublicationDestinationView } from "@/lib/facebook/backend/social-destinations-service";

/** Serialização para a tela (nunca inclui tokens; URLs são do próprio Alilu ou as que o usuário colou). */

const iso = (date: Date | null) => (date ? date.toISOString() : null);

export function serializeQueue(queue: VideoQueueRecord) {
  return {
    id: queue.id,
    name: queue.name,
    category: queue.category,
    categoryName: findCategory(queue.category)?.name ?? queue.category,
    theme: queue.theme,
    themeName: findTheme(queue.category, queue.theme)?.name ?? queue.theme,
    status: queue.status,
    pauseReason: queue.pauseReason,
    pausedBySystem: queue.pausedBySystem,
    instagramAccountId: queue.instagramAccountId,
    publishToInstagram: queue.publishToInstagram,
    facebookPageIds: queue.facebookPageIds,
    schedule: queue.schedule,
    captionTemplate: queue.captionTemplate,
    facebookCaptionTemplate: queue.facebookCaptionTemplate,
    createdAt: queue.createdAt.toISOString(),
    activatedAt: iso(queue.activatedAt),
  };
}

export function serializeCounts(counts: QueueCounts) {
  return { ...counts, nextPublicationAt: iso(counts.nextPublicationAt) };
}

export function serializeItem(item: VideoQueueItemRecord, post: QueuePostState | null = null, destinations: PublicationDestinationView[] = []) {
  return {
    id: item.id,
    position: item.position,
    sourceUrl: item.sourceUrl,
    sourceKind: item.sourceKind,
    status: item.status,
    statusMessage: item.statusMessage,
    errorCode: item.errorCode,
    attemptsCount: item.attemptsCount,
    nextAttemptAt: iso(item.nextAttemptAt),
    thumbnailUrl: item.thumbnailUrl,
    videoUrl: item.blobUrl,
    durationSeconds: item.durationSeconds,
    width: item.width,
    height: item.height,
    fileSizeBytes: item.fileSizeBytes,
    facebookIncompatibleReason: item.facebookIncompatibleReason,
    title: item.title,
    caption: item.caption,
    facebookCaption: item.facebookCaption,
    postId: item.postId,
    scheduledAt: iso(item.scheduledAtUtc),
    facebookNote: item.facebookNote,
    publishedAt: iso(item.publishedAt),
    post: post
      ? { id: post.id, status: post.status, error: post.lastError, publishedAt: iso(post.publishedAt), publishToInstagram: post.publishToInstagram }
      : null,
    destinations,
  };
}

export function serializeDashboard(dashboard: Awaited<ReturnType<typeof getQueueDashboard>>) {
  return {
    queue: serializeQueue(dashboard.queue),
    counts: serializeCounts(dashboard.counts),
    nextPublicationAt: dashboard.nextPublicationAt,
    account: dashboard.account,
    pages: dashboard.pages,
    items: dashboard.items.map((entry) => serializeItem(entry.item, entry.post, entry.destinations)),
    preview: dashboard.preview,
    events: dashboard.events.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
  };
}

export type VideoQueueDto = ReturnType<typeof serializeQueue>;
export type VideoQueueItemDto = ReturnType<typeof serializeItem>;
export type VideoQueueDashboardDto = ReturnType<typeof serializeDashboard>;
export type VideoQueueCountsDto = ReturnType<typeof serializeCounts>;
