/**
 * Mídia fixa da parte de baixo do Split Screen — uma por conta do Instagram.
 * Constantes e tipos compartilhados entre servidor e telas (sem banco).
 */

export type SplitBottomMediaKind = "VIDEO" | "IMAGE";

export const SPLIT_BOTTOM_IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const SPLIT_BOTTOM_VIDEO_CONTENT_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
export const SPLIT_BOTTOM_MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const SPLIT_BOTTOM_MAX_VIDEO_BYTES = 100 * 1024 * 1024;
/** Vídeo da parte de baixo repete em loop: não precisa ser longo. */
export const SPLIT_BOTTOM_MAX_VIDEO_SECONDS = 150;

/** Mesmo prefixo de upload da mídia final (reaproveita /api/brand-end-media/upload). */
export function splitBottomUploadPrefix(userId: string): string {
  return `brand-end-media/${userId}/split-bottom/`;
}

export interface SplitBottomMediaDto {
  kind: SplitBottomMediaKind;
  url: string;
  contentType: string;
  fileSizeBytes: number;
  width: number;
  height: number;
  durationSeconds: number | null;
  hasAudio: boolean;
}

export interface SplitBottomAccountDto {
  instagramAccountId: string;
  username: string | null;
  connected: boolean;
  /** Conta principal (destino padrão das publicações). */
  primary: boolean;
  media: SplitBottomMediaDto | null;
}

export interface SplitBottomSummaryDto {
  accounts: SplitBottomAccountDto[];
}
