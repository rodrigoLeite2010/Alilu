import "server-only";
import { planQueue, type PlanQueueResult } from "./queue-planner";
import { runQueueImports, type ProcessItemResult } from "./queue-processor";
import { listQueueIdsForCron } from "./queue-repository";

/**
 * Execução periódica da Fila de vídeos (rota /api/cron/video-queue, mesmo
 * segredo do agendador do Instagram). Não depende de navegador aberto.
 *
 *   1. planeja as filas ativas (barato: só banco) — cria as publicações dos
 *      próximos horários no agendador EXISTENTE e sincroniza os resultados;
 *   2. importa vídeos em SEQUÊNCIA, com teto global de downloads
 *      simultâneos e orçamento de tempo (nunca 50 downloads de uma vez);
 *   3. planeja de novo as filas que ganharam vídeos prontos.
 *
 * A publicação em si continua sendo feita só por /api/cron/instagram-publish.
 */

export interface VideoQueueCronOptions {
  now?: () => Date;
  /** Orçamento total (ms). */
  timeBudgetMs?: number;
  maxImports?: number;
  maxInFlight?: number;
  maxQueues?: number;
}

export interface VideoQueueCronResult {
  planned: PlanQueueResult[];
  imports: ProcessItemResult[];
}

/** Uma importação (download até 50 s + ffprobe + Blob) precisa de folga para não ser cortada no meio. */
export const IMPORT_SAFETY_MARGIN_MS = 90_000;

function envInt(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

export async function runVideoQueueCron(options: VideoQueueCronOptions = {}): Promise<VideoQueueCronResult> {
  const started = Date.now();
  const now = options.now ?? (() => new Date());
  const budget = options.timeBudgetMs ?? 240_000;
  const maxImports = options.maxImports ?? envInt("VIDEO_QUEUE_MAX_IMPORTS_PER_RUN", 3, 0, 20);
  const maxInFlight = options.maxInFlight ?? envInt("VIDEO_QUEUE_MAX_CONCURRENT_IMPORTS", 2, 1, 10);
  const maxQueues = options.maxQueues ?? 50;

  const planned: PlanQueueResult[] = [];
  const planAll = async (ids: string[]) => {
    for (const id of ids) {
      if (Date.now() - started > budget - 5_000) break;
      try {
        const result = await planQueue(id, now());
        if (result) planned.push(result);
      } catch (error) {
        console.error(JSON.stringify({ scope: "video-queue", event: "plan.crash", queueId: id, message: (error as Error)?.message?.slice(0, 200) }));
      }
    }
  };

  await planAll(await listQueueIdsForCron(maxQueues));

  const imports = await runQueueImports({
    maxItems: maxImports,
    maxInFlight,
    deadline: started + budget - IMPORT_SAFETY_MARGIN_MS,
    now,
  });

  const readyQueues = [...new Set(imports.filter((result) => result.status === "READY").map((result) => result.queueId))];
  if (readyQueues.length > 0) await planAll(readyQueues);

  return { planned, imports };
}
