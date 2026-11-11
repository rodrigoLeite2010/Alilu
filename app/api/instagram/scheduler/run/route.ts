import { NextResponse } from "next/server";
import {
  isSchedulerRequestAuthorized,
  parseSchedulerLimit,
  runInstagramScheduler,
} from "@/lib/instagram/backend/instagram-scheduler";
import { runFacebookScheduler } from "@/lib/facebook/backend/facebook-publish-service";

export const maxDuration = 60;

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
  const results = await runInstagramScheduler({ limit: parseSchedulerLimit(request) });
  const facebook = await runFacebookScheduler({ limit: parseSchedulerLimit(request), timeBudgetMs: 15_000 }).catch(() => null);
  return NextResponse.json({ processed: results.length, results, facebook });
}
