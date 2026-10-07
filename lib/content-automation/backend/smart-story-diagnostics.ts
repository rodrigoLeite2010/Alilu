import "server-only";
import { getDb } from "@/lib/db/client";

export interface SmartStoryDiagnostics {
  windowDays: number;
  total: number;
  bySource: { AI: number; FALLBACK: number };
  byStatus: Record<string, number>;
  byType: { type: string; count: number }[];
  mascotCount: number;
  automationsEnabled: number;
  recentProblems: {
    id: string;
    automationId: string;
    storyType: string;
    status: string;
    source: string;
    attempts: number;
    error: string | null;
    at: string;
  }[];
}

/**
 * Visão agregada (só admin) dos Stories inteligentes dos últimos N dias.
 * Lê só contagens e mensagens de erro já sanitizadas — nunca token, chave
 * nem o prompt completo.
 */
export async function getSmartStoryDiagnostics(windowDays = 30): Promise<SmartStoryDiagnostics> {
  const db = getDb();
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
  const [sources, statuses, types, mascot, enabled, problems] = await Promise.all([
    db`select source, count(*)::int as n from smart_story_generations where created_at >= ${since} group by source`,
    db`select status, count(*)::int as n from smart_story_generations where created_at >= ${since} group by status`,
    db`select story_type, count(*)::int as n from smart_story_generations where created_at >= ${since} group by story_type order by n desc`,
    db`select count(*)::int as n from smart_story_generations where created_at >= ${since} and used_mascot = true`,
    db`select count(*)::int as n from content_automations where smart_story_enabled = true`,
    db`
      select id, automation_id, story_type, status, source, attempts, generation_error, created_at
      from smart_story_generations
      where created_at >= ${since} and (status = 'FAILED' or source = 'FALLBACK' or generation_error is not null)
      order by created_at desc
      limit 20
    `,
  ]);
  const bySource = { AI: 0, FALLBACK: 0 };
  for (const row of sources) {
    if (row.source === "FALLBACK") bySource.FALLBACK = Number(row.n);
    else bySource.AI = Number(row.n);
  }
  const byStatus: Record<string, number> = {};
  for (const row of statuses) byStatus[String(row.status)] = Number(row.n);
  return {
    windowDays,
    total: bySource.AI + bySource.FALLBACK,
    bySource,
    byStatus,
    byType: types.map((row) => ({ type: String(row.story_type), count: Number(row.n) })),
    mascotCount: Number(mascot[0]?.n ?? 0),
    automationsEnabled: Number(enabled[0]?.n ?? 0),
    recentProblems: problems.map((row) => ({
      id: String(row.id),
      automationId: String(row.automation_id),
      storyType: String(row.story_type),
      status: String(row.status),
      source: String(row.source),
      attempts: Number(row.attempts),
      error: typeof row.generation_error === "string" ? row.generation_error.slice(0, 300) : null,
      at: new Date(row.created_at as string | Date).toISOString(),
    })),
  };
}
