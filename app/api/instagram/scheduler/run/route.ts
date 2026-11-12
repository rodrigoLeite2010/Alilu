import { NextResponse } from "next/server";
import {
  isSchedulerRequestAuthorized,
  parseSchedulerLimit,
  runInstagramScheduler,
} from "@/lib/instagram/backend/instagram-scheduler";
import { runFacebookScheduler } from "@/lib/facebook/backend/facebook-publish-service";
import { facebookSchedulerBudget } from "@/lib/facebook/facebook-scheduler-budget";

export const maxDuration = 60;
const MAX_DURATION_MS = maxDuration * 1000;

/**
 * Endpoint antigo do agendador, mantido por compatibilidade com
 * disparadores já configurados. Usa exatamente a mesma lógica de
 * /api/cron/instagram-publish (claim atômico, retry, lock) — nenhuma
 * implementação paralela.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!isSchedulerRequestAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const startedAt = Date.now();
  const results = await runInstagramScheduler({ limit: parseSchedulerLimit(request) });
  const facebook = await runFacebookScheduler({
    limit: parseSchedulerLimit(request),
    timeBudgetMs: facebookSchedulerBudget(startedAt, MAX_DURATION_MS),
  }).catch(() => null);
  return NextResponse.json({ processed: results.length, results, facebook });
}
