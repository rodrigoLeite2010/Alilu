/**
 * Ponte entre o registro da fila (video_queues) e a programação do radar
 * (lógica pura; tipos apenas).
 */
import type { VideoQueueRecord } from "@/lib/video-queue/backend/queue-repository";
import { RADAR_INTERVAL_OPTIONS, radarDailySlots, type RadarIntervalMinutes, type RadarScheduleConfig } from "./schedule";

export function isRadarQueue(queue: Pick<VideoQueueRecord, "kind">): boolean {
  return queue.kind === "INSTAGRAM_RADAR";
}

export function radarConfigFromQueue(queue: Pick<VideoQueueRecord, "schedule" | "radar">): RadarScheduleConfig {
  const interval = (RADAR_INTERVAL_OPTIONS as readonly number[]).includes(queue.schedule.minIntervalMinutes)
    ? (queue.schedule.minIntervalMinutes as RadarIntervalMinutes)
    : 60;
  return {
    timezone: queue.schedule.timezone,
    startDate: queue.schedule.startDate,
    postsPerDay: Math.min(Math.max(queue.schedule.postsPerDay, 1), 10),
    intervalMinutes: interval,
    windowStart: queue.radar?.windowStart ?? "09:00",
    windowEnd: queue.radar?.windowEnd ?? "22:00",
    weekdays: queue.schedule.weekdays,
  };
}

/** Horários "HH:MM" do dia, guardados também em video_queues.publish_times (exibição/compatibilidade). */
export function radarPublishTimes(config: RadarScheduleConfig): string[] {
  return [...new Set(radarDailySlots(config).map((slot) => slot.time))].sort();
}
