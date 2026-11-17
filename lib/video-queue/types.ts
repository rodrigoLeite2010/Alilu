/**
 * Tipos, status e rótulos da Fila de vídeos (módulo puro — tela e servidor).
 */

export type VideoQueueStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";

/**
 * Status de cada item. Importação: PENDING → VALIDATING → IMPORTING →
 * PROCESSING → READY (ou WAITING_FILE / ERROR). Publicação: READY →
 * SCHEDULED (publicação criada no agendador existente) → PUBLISHED.
 */
export type VideoQueueItemStatus =
  | "PENDING"
  | "VALIDATING"
  | "IMPORTING"
  | "PROCESSING"
  | "READY"
  | "WAITING_FILE"
  | "ERROR"
  | "CANCELLED"
  | "SCHEDULED"
  | "PUBLISHED";

export type VideoQueueSourceKind = "DIRECT" | "INSTAGRAM" | "YOUTUBE" | "TIKTOK" | "OTHER_PLATFORM" | "UPLOAD";

export type VideoQueueOrderMode = "POSITION" | "REVERSE";
export type VideoQueueNotReadyPolicy = "WAIT" | "NEXT_READY";

export const VIDEO_QUEUE_STATUS_LABEL: Record<VideoQueueStatus, string> = {
  DRAFT: "Rascunho (não ativada)",
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  ARCHIVED: "Arquivada",
};

export const VIDEO_QUEUE_ITEM_STATUS_LABEL: Record<VideoQueueItemStatus, string> = {
  PENDING: "Pendente",
  VALIDATING: "Validando",
  IMPORTING: "Importando",
  PROCESSING: "Processando",
  READY: "Pronto para publicação",
  WAITING_FILE: "Aguardando autorização ou arquivo",
  ERROR: "Erro",
  CANCELLED: "Cancelado",
  SCHEDULED: "Agendado",
  PUBLISHED: "Publicado",
};

export const VIDEO_QUEUE_SOURCE_LABEL: Record<VideoQueueSourceKind, string> = {
  DIRECT: "Arquivo direto",
  INSTAGRAM: "Instagram",
  YOUTUBE: "YouTube",
  TIKTOK: "TikTok",
  OTHER_PLATFORM: "Outra plataforma",
  UPLOAD: "Upload",
};

/** Itens ainda no caminho da importação (contam como "pendentes"). */
export const IMPORT_PIPELINE_STATUSES: VideoQueueItemStatus[] = ["PENDING", "VALIDATING", "IMPORTING", "PROCESSING"];
/** Itens que o worker está processando agora (sob lock). */
export const IN_FLIGHT_STATUSES: VideoQueueItemStatus[] = ["VALIDATING", "IMPORTING", "PROCESSING"];
/** Itens que aceitam upload do arquivo autorizado. */
export const UPLOADABLE_STATUSES: VideoQueueItemStatus[] = ["PENDING", "WAITING_FILE", "ERROR"];

/** Máximo de links aceitos por envio (o total da fila pode crescer em vários envios). */
export const MAX_LINKS_PER_SUBMISSION = 200;
/** Máximo de itens ativos por fila. */
export const MAX_ITEMS_PER_QUEUE = 1000;
/** Máximo de horários por dia (mesmo teto do Piloto Automático). */
export const MAX_PUBLISH_TIMES = 24;
/** Legenda do Instagram: limite da Meta. */
export const INSTAGRAM_CAPTION_MAX_LENGTH = 2200;
