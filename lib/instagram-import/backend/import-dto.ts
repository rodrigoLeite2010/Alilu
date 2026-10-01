import "server-only";
import type { InstagramImportRecord } from "./import-repository";

/** Para a tela: sem dados internos (custo, request id do provedor). */
export function serializeImport(record: InstagramImportRecord) {
  return {
    id: record.id,
    status: record.status,
    kind: record.urlKind,
    originalUrl: record.originalUrl,
    normalizedUrl: record.normalizedUrl,
    mediaType: record.mediaType,
    thumbnailUrl: record.thumbnailUrl,
    // Prévia antes de importar: tipo e miniatura de cada item (as URLs temporárias ficam no servidor).
    items: record.resolvedItems.map((item, index) => ({ index, mediaType: item.mediaType, thumbnailUrl: item.thumbnailUrl })),
    fileUrl: record.importedFileUrl,
    contentType: record.contentType,
    fileSizeBytes: record.fileSizeBytes,
    durationSeconds: record.durationSeconds,
    width: record.width,
    height: record.height,
    hasAudio: record.hasAudio,
    errorMessage: record.errorMessage,
    createdAt: record.createdAt.toISOString(),
    completedAt: record.completedAt ? record.completedAt.toISOString() : null,
  };
}

export type InstagramImportDto = ReturnType<typeof serializeImport>;
