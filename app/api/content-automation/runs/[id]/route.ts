import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { approveAutomationRun, AutomationValidationError, rejectAutomationRun } from "@/lib/content-automation/backend/automation-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH: `{ action: "approve" }` agenda a publicação gerada (seção 33 —
 * modo aprovação); `{ action: "reject" }` cancela a publicação gerada
 * sem publicar.
 */
export async function PATCH(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const { action } = (body as { action?: unknown }) ?? {};

  try {
    if (action === "approve") {
      await approveAutomationRun(id, userId);
      return NextResponse.json({ status: "SCHEDULED" });
    }
    if (action === "reject") {
      await rejectAutomationRun(id, userId);
      return NextResponse.json({ status: "CANCELLED" });
    }
    return NextResponse.json({ error: "action precisa ser 'approve' ou 'reject'." }, { status: 400 });
  } catch (error) {
    console.error("[content-automation/runs/id] falha ao processar aprovação", error);
    const message = error instanceof AutomationValidationError ? error.message : "Não foi possível processar esta ação.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
