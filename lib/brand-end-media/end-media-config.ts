/**
 * Mídia final padrão (encerramento) — constantes e tipos compartilhados
 * entre servidor e telas. Sem segredos, sem acesso a banco.
 */

export type EndMediaSlot = "CAROUSEL_IMAGE" | "REEL_VIDEO" | "REEL_IMAGE" | "SPLIT_VIDEO";
export const END_MEDIA_SLOTS: EndMediaSlot[] = ["CAROUSEL_IMAGE", "REEL_VIDEO", "REEL_IMAGE", "SPLIT_VIDEO"];

export const END_MEDIA_SLOT_LABEL: Record<EndMediaSlot, string> = {
  CAROUSEL_IMAGE: "Imagem final do carrossel",
  REEL_VIDEO: "Vídeo final para Reels",
  REEL_IMAGE: "Imagem final para Reels",
  SPLIT_VIDEO: "Vídeo final do Split Screen",
};

export function isVideoSlot(slot: EndMediaSlot): boolean {
  return slot === "REEL_VIDEO" || slot === "SPLIT_VIDEO";
}

export const END_MEDIA_IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const END_MEDIA_VIDEO_CONTENT_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
export const END_MEDIA_MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const END_MEDIA_MAX_VIDEO_BYTES = 100 * 1024 * 1024;
/** Encerramento é curto por natureza: vídeo de até 15s (pode ser limitado nas configurações). */
export const END_MEDIA_MAX_VIDEO_SECONDS = 15;
export const END_MEDIA_DEFAULT_IMAGE_SECONDS = 3;

/** Limite da Meta: carrossel com até 10 itens (fotos e vídeos). */
export const CAROUSEL_MAX_ITEMS_WITH_END = 10;

export const CAROUSEL_FULL_MESSAGE =
  "O carrossel já atingiu o número máximo de itens. Remova um item para adicionar a imagem final padrão.";
export const END_MEDIA_NOT_CONFIGURED_MESSAGE = "Mídia final padrão não configurada.";
export const END_MEDIA_FAILED_MESSAGE = "Não foi possível adicionar o encerramento padrão.";

export function endMediaUploadPrefix(userId: string): string {
  return `brand-end-media/${userId}/`;
}

export interface EndMediaSettingsDto {
  carouselEnabled: boolean;
  reelEnabled: boolean;
  reelMediaKind: "VIDEO" | "IMAGE";
  splitEnabled: boolean;
  imageDurationSeconds: number;
  maxVideoSeconds: number | null;
  keepAudio: boolean;
  fadeSeconds: number;
  applyAutomatically: boolean;
}

export interface EndMediaAssetDto {
  slot: EndMediaSlot;
  url: string;
  contentType: string;
  fileSizeBytes: number;
  width: number;
  height: number;
  durationSeconds: number | null;
  hasAudio: boolean;
}

export interface EndMediaSummaryDto {
  settings: EndMediaSettingsDto;
  assets: Partial<Record<EndMediaSlot, EndMediaAssetDto>>;
}

export const DEFAULT_END_MEDIA_SETTINGS: EndMediaSettingsDto = {
  carouselEnabled: false,
  reelEnabled: false,
  reelMediaKind: "VIDEO",
  splitEnabled: false,
  imageDurationSeconds: END_MEDIA_DEFAULT_IMAGE_SECONDS,
  maxVideoSeconds: null,
  keepAudio: false,
  fadeSeconds: 0.3,
  applyAutomatically: true,
};

/** Escolha feita numa publicação: padrão da empresa, nenhum, ou outra imagem só nesta publicação. */
export type CarouselEndMediaChoice =
  | { mode: "default" }
  | { mode: "none" }
  | { mode: "override"; mediaUrl: string };

/** Proporção recomendada da imagem final do carrossel (4:5, 1080×1350) — só aviso, nunca bloqueia. */
export function carouselImageRatioWarning(width: number, height: number): string | null {
  if (!width || !height) return null;
  const ratio = width / height;
  if (Math.abs(ratio - 0.8) <= 0.03) return null;
  return "Recomendado: 4:5 (1080×1350). O Instagram corta todos os itens pela proporção do 1º slide.";
}
