import { NextResponse } from "next/server";
import {
  isSchedulerRequestAuthorized,
  parseSchedulerLimit,
  runInstagramScheduler,
} from "@/lib/instagram/backend/instagram-scheduler";
import { refreshExpiringInstagramTokens } from "@/lib/instagram/backend/instagram-oauth-service";
import { runFacebookScheduler } from "@/lib/facebook/backend/facebook-publish-service";
import { facebookSchedulerBudget } from "@/lib/facebook/facebook-scheduler-budget";

export const maxDuration = 60;
const MAX_DURATION_MS = maxDuration * 1000;
export const dynamic = "force-dynamic";

/**
 * Endpoint interno do agendador do Instagram. Publica as publicações
 * vencidas (status SCHEDULED com horário <= agora) e retoma containers
 * ainda em processamento. Protegido por `Authorization: Bearer <segredo>`
 * (CRON_SECRET ou INSTAGRAM_SCHEDULER_SECRET) — ver docs/instagram-scheduler.md.
 *
 * GET existe porque a Vercel Cron dispara com GET; POST para
 * disparadores externos. Os dois fazem exatamente a mesma coisa.
 */
async function handle(request: Request): Promise<NextResponse> {
  if (!isSchedulerRequestAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const startedAt = Date.now();
  try {
    const results = await runInstagramScheduler({ limit: parseSchedulerLimit(request) });
    // Facebook: destinos independentes, com orçamento próprio. Um erro aqui
    // nunca afeta o resultado (já gravado) do Instagram acima.
    // Mesma camada de publicação do "Publicar agora" (publishFacebookDestination).
    const facebook = await runFacebookScheduler({
      limit: parseSchedulerLimit(request),
      timeBudgetMs: facebookSchedulerBudget(startedAt, MAX_DURATION_MS),
    }).catch(() => {
      console.error(JSON.stringify({ scope: "instagram-publish", event: "facebook.scheduler.crash" }));
      return null;
    });
    // Renova tokens de 60 dias perto de vencer (sem isso as contas param de publicar).
    const tokens = await refreshExpiringInstagramTokens({ limit: 10 }).catch(() => null);
    return NextResponse.json({ processed: results.length, results, facebook, tokens });
  } catch {
    console.error(JSON.stringify({ scope: "instagram-publish", event: "scheduler.crash" }));
    // O Instagram falhou: o Facebook ainda roda (falha em uma rede não bloqueia a outra).
    const facebook = await runFacebookScheduler({
      limit: parseSchedulerLimit(request),
      timeBudgetMs: facebookSchedulerBudget(startedAt, MAX_DURATION_MS),
    }).catch(() => null);
    return NextResponse.json({ error: "Falha ao executar o agendador.", facebook }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
