import { NextResponse } from "next/server";
import { isSchedulerRequestAuthorized } from "@/lib/instagram/backend/instagram-scheduler";
import { runVideoQueueCron } from "@/lib/video-queue/backend/queue-cron";

// Importações em sequência (download + ffprobe + miniatura) dentro do orçamento.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Cron da Fila de vídeos: planeja as filas ativas (cria as publicações dos
 * próximos horários no agendador existente) e importa os vídeos pendentes
 * com concorrência controlada. Mesmo segredo do agendador do Instagram
 * (`Authorization: Bearer <CRON_SECRET | INSTAGRAM_SCHEDULER_SECRET>`).
 * A publicação continua sendo feita por /api/cron/instagram-publish.
 */
async function handle(request: Request): Promise<NextResponse> {
  if (!isSchedulerRequestAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  try {
    const result = await runVideoQueueCron({ timeBudgetMs: (maxDuration - 20) * 1000 });
    return NextResponse.json({
      planned: result.planned.length,
      scheduled: result.planned.reduce((sum, plan) => sum + plan.scheduled, 0),
      published: result.planned.reduce((sum, plan) => sum + plan.published, 0),
      paused: result.planned.filter((plan) => plan.paused).map((plan) => ({ queueId: plan.queueId, reason: plan.paused })),
      imports: result.imports.map((entry) => ({ itemId: entry.itemId, status: entry.status, code: entry.code ?? null })),
      ...(result.radar ? { radar: { runs: result.radar.runs.map((run) => ({ radarId: run.radarId, status: run.status, queued: run.queued })), abandoned: result.radar.abandoned } } : {}),
    });
  } catch {
    console.error(JSON.stringify({ scope: "video-queue", event: "cron.crash" }));
    return NextResponse.json({ error: "Falha ao executar a fila de vídeos." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
