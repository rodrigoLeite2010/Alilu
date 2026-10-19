import "server-only";
import type { YoutubeImportDto } from "../types";
import type { YoutubeImportRecord } from "./import-repository";
import { youtubeWarningFor } from "./import-service";

/** Para a tela: sem user_id, sem caminho interno do storage, sem códigos internos da API. */
export function serializeYoutubeImport(record: YoutubeImportRecord): YoutubeImportDto {
  return {
    id: record.id,
    status: record.status,
    videoId: record.videoId,
    kind: record.urlKind,
    normalizedUrl: record.normalizedUrl,
    availability: record.availability,
    metadataSource: record.metadataSource,
    title: record.title,
    channelTitle: record.channelTitle,
    thumbnailUrl: record.thumbnailUrl,
    youtubeDurationSeconds: record.youtubeDurationSeconds,
    embeddable: record.embeddable,
    madeForKids: record.madeForKids,
    regionRestricted: record.regionRestricted,
    warningMessage: youtubeWarningFor(record),
    fileUrl: record.fileUrl,
    contentType: record.contentType,
    fileSizeBytes: record.fileSizeBytes,
    durationSeconds: record.durationSeconds,
    width: record.width,
    height: record.height,
    hasAudio: record.hasAudio,
    durationMismatch: record.durationMismatch,
    createdAt: record.createdAt.toISOString(),
    completedAt: record.completedAt ? record.completedAt.toISOString() : null,
  };
}
