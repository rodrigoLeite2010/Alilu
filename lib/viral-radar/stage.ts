/**
 * Etapa exibida de cada candidato (puro). Antes da fila, vem do radar; depois,
 * do item da Fila de vídeos e da publicação no agendador (fonte única).
 */
import type { CandidateStatus, PipelineStage } from "./types";

export function pipelineStage(input: {
  status: CandidateStatus;
  itemStatus: string | null;
  postStatus: string | null;
  queueStatus: string | null;
}): PipelineStage {
  if (input.status !== "QUEUED" || !input.itemStatus) {
    if (input.status === "QUEUED") return "CANCELLED";
    return input.status as PipelineStage;
  }
  switch (input.itemStatus) {
    case "PENDING":
    case "VALIDATING":
    case "IMPORTING":
      return "IMPORTING";
    case "PROCESSING":
      return "PROCESSING";
    case "READY":
      return input.queueStatus === "PAUSED" ? "PAUSED" : "READY";
    case "WAITING_FILE":
      return "WAITING_FILE";
    case "ERROR":
      return "FAILED";
    case "CANCELLED":
      return "CANCELLED";
    case "PUBLISHED":
      return "PUBLISHED";
    case "SCHEDULED":
      if (input.postStatus === "PROCESSING") return "PUBLISHING";
      if (input.postStatus === "FAILED" || input.postStatus === "NEEDS_REVIEW") return "FAILED";
      if (input.queueStatus === "PAUSED") return "PAUSED";
      return "SCHEDULED";
    default:
      return "DISCOVERED";
  }
}
