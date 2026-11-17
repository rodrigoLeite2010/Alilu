import "server-only";
import { randomUUID } from "node:crypto";
import { abandonStaleExecutions, claimDueRadars, purgeExpiredCache } from "./radar-repository";
import { RUN_LOCK_TTL_SECONDS, runRadar, type RunRadarOptions, type RunRadarResult } from "./radar-runner";
import { monitorPublishedPosts, type MonitorResult } from "./performance";

/**
 * Passo periódico do Radar Viral. Roda no servidor (sem navegador), dentro
 * do MESMO disparador da Fila de vídeos (/api/cron/video-queue) — não exige
 * cron novo — e também pela rota opcional /api/cron/viral-radar.
 *
 *   1. limpeza: execuções RUNNING antigas → ABANDONED (worker que morreu);
 *      o lock do radar expira sozinho (10 min) e ele é retomado;
 *   2. claim atômico dos radares vencidos (agenda) ou com fila abaixo do
 *      mínimo (reabastecimento), com concorrência limitada;
 *   3. cada radar roda isolado (falha de um não afeta os outros);
 *   4. monitoramento das publicações próprias (barato, limitado).
 */

export interface ViralRadarTickOptions extends RunRadarOptions {
  maxRadars?: number;
  timeBudgetMs?: number;
  monitor?: boolean;
}

export interface ViralRadarTickResult {
  runs: Array<Pick<RunRadarResult, "radarId" | "status" | "message"> & { queued: number }>;
  monitor: MonitorResult | null;
  abandoned: number;
}

function envInt(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

export function viralRadarEnabled(): boolean {
  return (process.env.VIRAL_RADAR_ENABLED ?? "true").trim().toLowerCase() !== "false";
}

export async function runViralRadarTick(options: ViralRadarTickOptions = {}): Promise<ViralRadarTickResult> {
  const started = Date.now();
  const budget = options.timeBudgetMs ?? 120_000;
  const deadline = started + budget;
  const now = options.now ?? (() => new Date());
  const result: ViralRadarTickResult = { runs: [], monitor: null, abandoned: 0 };
  if (!viralRadarEnabled()) return result;

  result.abandoned = await abandonStaleExecutions(Math.ceil(RUN_LOCK_TTL_SECONDS / 60) + 5);
  const maxRadars = options.maxRadars ?? envInt("VIRAL_RADAR_MAX_RADARS_PER_RUN", 3, 1, 20);
  const lockToken = randomUUID();
  const claimed = await claimDueRadars(now(), maxRadars, lockToken, RUN_LOCK_TTL_SECONDS);

  for (const { radar, trigger } of claimed) {
    if (Date.now() > deadline - 15_000) {
      // Sem tempo: o lock expira sozinho e o radar volta na próxima execução.
      break;
    }
    try {
      const run = await runRadar(radar, trigger, lockToken, { ...options, now, deadline });
      result.runs.push({ radarId: run.radarId, status: run.status, message: run.message, queued: run.stats.queued });
    } catch (error) {
      console.error(JSON.stringify({ scope: "viral-radar", event: "tick.radar_crash", radarId: radar.id, message: (error as Error)?.message?.slice(0, 200) }));
    }
  }

  if (options.monitor !== false && Date.now() < deadline - 20_000) {
    try {
      result.monitor = await monitorPublishedPosts({ limit: envInt("VIRAL_RADAR_MONITOR_PER_RUN", 10, 0, 100), deadline: deadline - 10_000, fetchImpl: options.fetchImpl });
    } catch (error) {
      console.error(JSON.stringify({ scope: "viral-radar", event: "tick.monitor_crash", message: (error as Error)?.message?.slice(0, 200) }));
    }
  }
  try {
    await purgeExpiredCache(now());
  } catch {
    // limpeza de cache é melhor esforço
  }
  return result;
}
