import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/admin-access";
import { runStorageCleanup, updateCleanupSettings } from "@/lib/storage-cleanup/backend/cleanup-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function range(value: unknown, min: number, max: number, label: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`${label}: valor inválido (entre ${min} e ${max}).`);
  return Math.round(number);
}

/**
 * POST { action: "settings", ... } salva a regra; { action: "run", dryRun } executa agora.
 * Só ADMIN_EMAILS.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }
  try {
    if (body.action === "settings") {
      await updateCleanupSettings({
        enabled: body.enabled === true,
        dryRun: body.dryRun !== false,
        orphanGraceHours: range(body.orphanGraceHours, 6, 720, "Carência de órfãos (horas)"),
        splitScreenOutputDays: range(body.splitScreenOutputDays, 1, 365, "Split-Screen (dias)"),
        instagramImportDays: range(body.instagramImportDays, 1, 365, "Importações (dias)"),
        aiVideoInputDays: range(body.aiVideoInputDays, 7, 365, "Entradas do vídeo com IA (dias)"),
        maxDeletesPerRun: range(body.maxDeletesPerRun, 1, 5000, "Exclusões por execução"),
      });
      return NextResponse.json({ saved: true });
    }
    if (body.action === "run") {
      const result = await runStorageCleanup({ trigger: "ADMIN", dryRunOverride: body.dryRun !== false });
      return NextResponse.json({ runId: result.runId, report: result.report });
    }
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha." }, { status: 400 });
  }
}
