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
  /** "Música": o que a publicação pediu (ACCOUNT_DEFAULT/NONE/CUSTOM) — nunca o nome/artista, que é conteúdo do usuário. */
  musicMode?: string;
  /** true quando a música pedida foi de fato aplicada na publicação (hoje, sempre false — ver music-support.ts). */
  musicApplied?: boolean;
  /** Motivo FIXO (nunca conteúdo do usuário) de por que a música não foi aplicada — ver resolveMusicApplication. */
  musicReason?: string;
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
  "musicMode",
  "musicApplied",
  "musicReason",
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
