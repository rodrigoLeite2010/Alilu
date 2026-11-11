/**
 * Visão de um destino de publicação (ex.: Página do Facebook) para as
 * telas — tipo e rótulos puros, sem "server-only" (usados no navegador).
 * Nunca contém token nem resposta crua da Meta.
 */
export type DestinationViewStatus = "SCHEDULED" | "PROCESSING" | "PUBLISHED" | "FAILED" | "CANCELLED" | "NEEDS_REVIEW";

export interface PublicationDestinationView {
  id: string;
  platform: "facebook";
  accountName: string | null;
  status: DestinationViewStatus;
  externalUrl: string | null;
  publishedAt: string | null;
  nextAttemptAt: string | null;
  attemptsCount: number;
  error: string | null;
  needsReconnect: boolean;
  captionOverride: string | null;
  facebookPageRef: string | null;
}

export const DESTINATION_STATUS_LABEL: Record<DestinationViewStatus, string> = {
  SCHEDULED: "Agendado",
  PROCESSING: "Publicando",
  PUBLISHED: "Publicado",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
  NEEDS_REVIEW: "Precisa de verificação",
};

export const DESTINATION_STATUS_CLASS: Record<DestinationViewStatus, string> = {
  SCHEDULED: "text-blue-700",
  PROCESSING: "text-amber-800",
  PUBLISHED: "text-teal-800",
  FAILED: "text-red-700",
  CANCELLED: "text-zinc-500",
  NEEDS_REVIEW: "text-orange-800",
};

/**
 * Status geral de uma publicação com vários destinos: só é "Publicado"
 * quando TODOS os destinos ativos estão publicados; com um publicado e
 * outro com falha, é "Parcial".
 */
export function overallPublicationStatus(input: {
  instagramStatus: string | null;
  destinations: Array<{ status: DestinationViewStatus }>;
}): "PUBLISHED" | "PARTIAL" | "FAILED" | "PENDING" | "CANCELLED" {
  const statuses = [
    ...(input.instagramStatus ? [input.instagramStatus] : []),
    ...input.destinations.map((item) => item.status as string),
  ].filter((status) => status !== "CANCELLED");
  if (statuses.length === 0) return "CANCELLED";
  if (statuses.every((status) => status === "PUBLISHED")) return "PUBLISHED";
  const failed = statuses.some((status) => status === "FAILED" || status === "NEEDS_REVIEW");
  const published = statuses.some((status) => status === "PUBLISHED");
  const pending = statuses.some((status) => !["PUBLISHED", "FAILED", "NEEDS_REVIEW"].includes(status));
  if (pending) return "PENDING";
  if (failed && published) return "PARTIAL";
  return "FAILED";
}
