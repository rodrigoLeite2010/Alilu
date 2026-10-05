import "server-only";
import { getDb } from "@/lib/db/client";

/**
 * Logs do login do Instagram: linha legível "[InstagramOAuth] …" + JSON com
 * os detalhes, e um registro curto em instagram_oauth_events (diagnóstico
 * do admin). Nunca recebe token, code ou state — só metadados.
 */
export interface OAuthLogDetails {
  userId?: string | null;
  correlationId?: string | null;
  userAgent?: string | null;
  isMobile?: boolean | null;
  browser?: string | null;
  outcome?: "info" | "success" | "cancelled" | "error";
  error?: string | null;
  errorCode?: string | number | null;
  errorSubcode?: string | number | null;
  errorType?: string | null;
  errorMessage?: string | null;
  [key: string]: unknown;
}

/** Chaves que nunca vão para log (mesmo se alguém passar por engano). */
const FORBIDDEN_KEYS = /^(code|state)$|token|secret/i;

export async function logInstagramOAuth(stage: string, message: string, details: OAuthLogDetails = {}): Promise<void> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (FORBIDDEN_KEYS.test(key)) continue;
    safe[key] = typeof value === "string" ? value.slice(0, 300) : value;
  }
  const outcome = details.outcome ?? "info";
  const line = `[InstagramOAuth] ${message}`;
  if (outcome === "error") console.error(line, JSON.stringify({ stage, ...safe }));
  else console.info(line, JSON.stringify({ stage, ...safe }));

  try {
    const db = getDb();
    const [event] = await db`
      insert into instagram_oauth_events (user_id, stage, outcome, error_code, error_subcode, error_type, message)
      values (${details.userId ?? null}, ${stage}, ${outcome},
        ${details.errorCode != null ? String(details.errorCode).slice(0, 80) : details.error ? String(details.error).slice(0, 80) : null},
        ${details.errorSubcode != null ? String(details.errorSubcode).slice(0, 80) : null},
        ${details.errorType ? String(details.errorType).slice(0, 80) : null},
        ${(details.errorMessage ?? message).slice(0, 300)})
      returning id
    `;
    await db`
      update instagram_oauth_events
      set correlation_id = ${details.correlationId ? String(details.correlationId).slice(0, 80) : null},
          user_agent = ${details.userAgent ? String(details.userAgent).slice(0, 300) : null},
          is_mobile = ${typeof details.isMobile === "boolean" ? details.isMobile : null},
          browser = ${details.browser ? String(details.browser).slice(0, 80) : null}
      where id = ${event.id}
    `;
  } catch {
    // diagnóstico é melhor esforço — nunca derruba o fluxo de login
  }
}
