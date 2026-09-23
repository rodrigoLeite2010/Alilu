/**
 * Log estruturado (uma linha JSON por evento) do ciclo de publicação.
 *
 * Só aceita campos de uma lista fechada — é impossível, por construção,
 * registrar access token, App Secret, legenda ou qualquer conteúdo do
 * usuário por aqui.
 */
export interface PublicationLogEvent {
  event: string;
  publicationId?: string;
  type?: string;
  status?: string;
  trigger?: string;
  attempt?: number;
  scheduledAt?: string | null;
  startedAt?: string;
  completedAt?: string;
  nextAttemptAt?: string;
  errorKind?: string;
  metaCode?: number | null;
  claimed?: number;
  durationMs?: number;
}

const ALLOWED_KEYS: ReadonlyArray<keyof PublicationLogEvent> = [
  "event",
  "publicationId",
  "type",
  "status",
  "trigger",
  "attempt",
  "scheduledAt",
  "startedAt",
  "completedAt",
  "nextAttemptAt",
  "errorKind",
  "metaCode",
  "claimed",
  "durationMs",
];

export function buildPublicationLogLine(event: PublicationLogEvent): string {
  const safe: Record<string, unknown> = { scope: "instagram-publish" };
  for (const key of ALLOWED_KEYS) {
    if (event[key] !== undefined) safe[key] = event[key];
  }
  return JSON.stringify(safe);
}

export function logPublicationEvent(event: PublicationLogEvent): void {
  const line = buildPublicationLogLine(event);
  if (event.event.endsWith("error") || event.event.endsWith("failed")) {
    console.error(line);
  } else {
    console.info(line);
  }
}
