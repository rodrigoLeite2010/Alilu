import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/admin-access";
import { updateImportSettings } from "@/lib/instagram-import/backend/import-repository";

export const dynamic = "force-dynamic";

function range(value: unknown, min: number, max: number, label: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`${label}: valor inválido (entre ${min} e ${max}).`);
  return number;
}

/** PATCH { maxImportsPerDay, maxImportedVideoSizeMb, maxImportedDurationMinutes, providerCostUsd } — só ADMIN_EMAILS. */
export async function PATCH(request: Request): Promise<NextResponse> {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    await updateImportSettings({
      maxImportsPerDay: Math.round(range(body.maxImportsPerDay, 1, 1000, "Importações por dia")),
      maxImportedVideoSizeMb: Math.round(range(body.maxImportedVideoSizeMb, 1, 500, "Tamanho máximo")),
      maxImportedDurationMinutes: Math.round(range(body.maxImportedDurationMinutes, 1, 60, "Duração máxima")),
      providerCostUsd: range(body.providerCostUsd, 0, 1, "Custo por importação"),
    });
    return NextResponse.json({ saved: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Dados inválidos." }, { status: 400 });
  }
}
