import "server-only";
import { ANALYTICS_ENVIRONMENT } from "../posthog-client";
import { runHogQL } from "./posthog-query";

/**
 * Números do admin vindos do PostHog (nada é gravado no PostgreSQL).
 * Cache curto em memória (com deduplicação de chamadas simultâneas): o admin e a
 * atualização automática não martelam a API do PostHog.
 * "Hoje" = dia atual no fuso do PROJETO no PostHog (configure America/Sao_Paulo).
 */

export const ONLINE_WINDOW_MINUTES = 5;
export const SUMMARY_TTL_MS = 30_000;
export const LIST_TTL_MS = 60_000;

const PAGEVIEW = "event = '$pageview'";
const ENV_FILTER = `properties.environment = '${ANALYTICS_ENVIRONMENT}'`;

type CacheEntry = { expires: number; value?: unknown; pending?: Promise<unknown> };
const cache = new Map<string, CacheEntry>();

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>, now: number = Date.now()): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > now) return (hit.pending ?? hit.value) as T;
  const pending = load();
  cache.set(key, { expires: now + ttlMs, pending });
  try {
    const value = await pending;
    cache.set(key, { expires: now + ttlMs, value });
    return value;
  } catch (error) {
    cache.delete(key); // falha não fica em cache
    throw error;
  }
}

export function __clearAnalyticsCacheForTests(): void {
  cache.clear();
}

export interface AnalyticsSummary {
  onlineNow: number;
  visitorsToday: number;
  sessionsToday: number;
  pageViewsToday: number;
  onlineWindowMinutes: number;
  generatedAt: string;
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  return cached("summary", SUMMARY_TTL_MS, async () => {
    const today = `timestamp >= toStartOfDay(now())`;
    const { results } = await runHogQL(
      `select
         uniqIf(person_id, ${PAGEVIEW} and ${today}) as visitors,
         uniqIf(properties.$session_id, ${PAGEVIEW} and ${today}) as sessions,
         countIf(${PAGEVIEW} and ${today}) as views,
         uniqIf(person_id, timestamp >= now() - interval ${ONLINE_WINDOW_MINUTES} minute) as online
       from events
       where event in ('$pageview', '$pageleave', 'user_login', 'user_logout')
         and timestamp >= least(toStartOfDay(now()), now() - interval ${ONLINE_WINDOW_MINUTES} minute)
         and ${ENV_FILTER}`,
      "alilu_admin_summary",
    );
    const row = results[0] ?? [];
    return {
      visitorsToday: Number(row[0] ?? 0),
      sessionsToday: Number(row[1] ?? 0),
      pageViewsToday: Number(row[2] ?? 0),
      onlineNow: Number(row[3] ?? 0),
      onlineWindowMinutes: ONLINE_WINDOW_MINUTES,
      generatedAt: new Date().toISOString(),
    };
  });
}

export interface TopPage {
  path: string;
  views: number;
}

export async function getTopPages(limit = 20): Promise<TopPage[]> {
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  return cached(`pages:${safeLimit}`, LIST_TTL_MS, async () => {
    const { results } = await runHogQL(
      `select properties.$pathname as path, count() as views
       from events
       where ${PAGEVIEW} and timestamp >= toStartOfDay(now()) and ${ENV_FILTER}
         and properties.$pathname is not null
         and not startsWith(properties.$pathname, '/admin')
       group by path
       order by views desc
       limit ${safeLimit}`,
      "alilu_admin_top_pages",
    );
    return results.map((row) => ({ path: String(row[0] ?? ""), views: Number(row[1] ?? 0) }));
  });
}

export interface RecentVisit {
  time: string;
  path: string;
  userType: "logged" | "anonymous";
}

/** Últimos acessos. Sem IP, sem id de usuário, sem e-mail — só horário, caminho e tipo. */
export async function getRecentVisits(limit = 25): Promise<RecentVisit[]> {
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  return cached(`recent:${safeLimit}`, LIST_TTL_MS, async () => {
    const { results } = await runHogQL(
      `select timestamp, properties.$pathname as path, properties.logged_in as logged
       from events
       where ${PAGEVIEW} and timestamp >= now() - interval 1 day and ${ENV_FILTER}
         and properties.$pathname is not null
         and not startsWith(properties.$pathname, '/admin')
       order by timestamp desc
       limit ${safeLimit}`,
      "alilu_admin_recent",
    );
    return results.map((row) => ({
      time: new Date(String(row[0])).toISOString(),
      path: String(row[1] ?? ""),
      userType: row[2] === true || row[2] === "true" || row[2] === 1 ? ("logged" as const) : ("anonymous" as const),
    }));
  });
}
