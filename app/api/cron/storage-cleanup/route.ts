import { NextResponse } from "next/server";
import { runStorageCleanup } from "@/lib/storage-cleanup/backend/cleanup-service";
import { isStorageCleanupCronAuthorized } from "@/lib/storage-cleanup/backend/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Cron externo (1× por dia): GET|POST com Authorization: Bearer <segredo>. */
async function handle(request: Request): Promise<NextResponse> {
  if (!isStorageCleanupCronAuthorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const result = await runStorageCleanup({ trigger: "CRON" });
    return NextResponse.json(result.skipped ? { skipped: true } : { runId: result.runId, dryRun: result.report.dryRun, rules: result.report.rules });
  } catch {
    return NextResponse.json({ error: "Falha na limpeza." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
