import "server-only";

/**
 * Consulta à Query API do PostHog (HogQL) — SOMENTE no servidor.
 * Usa POSTHOG_PERSONAL_API_KEY (chave privada, escopo "Query: read") e POSTHOG_PROJECT_ID.
 * Nunca use NEXT_PUBLIC_ para essas variáveis.
 */

export class AnalyticsNotConfiguredError extends Error {
  constructor() {
    super("PostHog não configurado (POSTHOG_PERSONAL_API_KEY / POSTHOG_PROJECT_ID).");
  }
}

export function isAnalyticsQueryConfigured(): boolean {
  return Boolean(process.env.POSTHOG_PERSONAL_API_KEY && process.env.POSTHOG_PROJECT_ID);
}

/** Host da API privada: POSTHOG_API_HOST, ou derivado do host de ingestão (us.i.posthog.com → us.posthog.com). */
export function posthogApiHost(): string {
  const explicit = process.env.POSTHOG_API_HOST?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const ingest = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/+$/, "");
  return ingest.replace(/\.i\.posthog\.com$/, ".posthog.com");
}

export interface HogQLResult {
  columns: string[];
  results: unknown[][];
}

export async function runHogQL(query: string, name: string, timeoutMs = 10_000): Promise<HogQLResult> {
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!key || !projectId) throw new AnalyticsNotConfiguredError();
  const response = await fetch(`${posthogApiHost()}/api/projects/${encodeURIComponent(projectId)}/query/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ name, query: { kind: "HogQLQuery", query } }),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`PostHog respondeu ${response.status}.`);
  const data = (await response.json()) as { columns?: string[]; results?: unknown[][] };
  return { columns: data.columns ?? [], results: data.results ?? [] };
}
