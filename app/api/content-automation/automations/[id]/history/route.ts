import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AutomationValidationError, listAutomationHistory } from "@/lib/content-automation/backend/automation-service";
import { serializeRun } from "@/lib/content-automation/backend/automation-dto";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET: histórico de execuções da automação (seção 31), mais recente primeiro. */
export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { id } = await params;
  try {
    const runs = await listAutomationHistory(id, userId);
    return NextResponse.json({ runs: runs.map(serializeRun) });
  } catch (error) {
    if (error instanceof AutomationValidationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[content-automation/automations/id/history] falha ao carregar histórico", error);
    return NextResponse.json({ error: "Não foi possível carregar o histórico." }, { status: 500 });
  }
}
