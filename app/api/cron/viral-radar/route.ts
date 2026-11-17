import { NextResponse } from "next/server";
import { isSchedulerRequestAuthorized } from "@/lib/instagram/backend/instagram-scheduler";
import { runViralRadarTick } from "@/lib/viral-radar/backend/radar-cron";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Cron OPCIONAL do Radar Viral. O radar já roda dentro de
 * /api/cron/video-queue (mesmo disparador); esta rota existe para quem
 * preferir um disparador separado (ex.: VIRAL_RADAR_IN_QUEUE_CRON=false).
 * Mesmo segredo: Authorization: Bearer <CRON_SECRET | INSTAGRAM_SCHEDULER_SECRET>.
 */
async function handle(request: Request): Promise<NextResponse> {
  if (!isSchedulerRequestAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  try {
    const result = await runViralRadarTick({ timeBudgetMs: (maxDuration - 30) * 1000 });
    return NextResponse.json({
      runs: result.runs,
      abandoned: result.abandoned,
      monitored: result.monitor?.checked ?? 0,
    });
  } catch {
    console.error(JSON.stringify({ scope: "viral-radar", event: "cron.crash" }));
    return NextResponse.json({ error: "Falha ao executar o Radar Viral." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
