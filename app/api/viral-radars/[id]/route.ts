import { NextResponse } from "next/server";
import { serializeDashboard } from "@/lib/viral-radar/backend/radar-dto";
import { applyRadarAction, getRadarDashboard, updateRadar, type RadarAction } from "@/lib/viral-radar/backend/radar-service";
import { badBody, readJsonBody, requireSessionUserId, unauthenticated, viralRadarErrorResponse } from "@/lib/viral-radar/backend/route-helpers";

export const dynamic = "force-dynamic";
// "Executar agora" roda uma execução curta (orçamento de 45 s).
export const maxDuration = 60;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  const { id } = await params;
  try {
    return NextResponse.json(serializeDashboard(await getRadarDashboard(userId, id)));
  } catch (error) {
    return viralRadarErrorResponse(error, "dashboard.failed");
  }
}

const ACTIONS: RadarAction[] = ["pause", "resume", "archive", "run", "activate_publishing"];

/** PATCH { action: "update", ...configurações } | { action: "pause" | "resume" | "archive" | "run" | "activate_publishing" } */
export async function PATCH(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  const body = await readJsonBody(request);
  if (!body) return badBody();
  const { id } = await params;
  try {
    if (body.action === "update") {
      await updateRadar(userId, id, body);
      return NextResponse.json({ ok: true });
    }
    if (!ACTIONS.includes(body.action as RadarAction)) return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    return NextResponse.json(await applyRadarAction(userId, id, body.action as RadarAction));
  } catch (error) {
    return viralRadarErrorResponse(error, "action.failed");
  }
}
