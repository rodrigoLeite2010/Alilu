import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/admin-access";
import {
  AdminActionError,
  adjustCredits,
  endPlan,
  extendTrial,
  grantComplimentaryPlan,
  setUserDisabled,
} from "@/lib/admin/user-admin-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/users/:id  { action, ... }
 * Ações manuais do admin sobre um cliente. Só ADMIN_EMAILS; tudo é auditado
 * em admin_audit_log pelo serviço.
 *  - adjust-credits   { credits (±), reason }
 *  - grant-plan       { planCode, days, note }
 *  - end-plan         { immediate?, reason }
 *  - extend-trial     { days, reason }
 *  - disable / enable { reason }
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  try {
    switch (body.action) {
      case "adjust-credits": {
        const result = await adjustCredits(admin, id, { credits: body.credits, reason: body.reason });
        return NextResponse.json({ ok: true, available: result.available });
      }
      case "grant-plan":
        await grantComplimentaryPlan(admin, id, { planCode: body.planCode, days: body.days, note: body.note });
        return NextResponse.json({ ok: true });
      case "end-plan":
        await endPlan(admin, id, { immediate: body.immediate === true, reason: body.reason });
        return NextResponse.json({ ok: true });
      case "extend-trial":
        await extendTrial(admin, id, { days: body.days, reason: body.reason });
        return NextResponse.json({ ok: true });
      case "disable":
      case "enable": {
        const result = await setUserDisabled(admin, id, { disabled: body.action === "disable", reason: body.reason });
        return NextResponse.json({ ok: true, ...result });
      }
      default:
        return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof AdminActionError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("[admin] falha na ação sobre usuário", { action: body.action, message: (error as Error)?.message });
    return NextResponse.json({ error: "Não foi possível concluir a ação. Tente novamente." }, { status: 500 });
  }
}
