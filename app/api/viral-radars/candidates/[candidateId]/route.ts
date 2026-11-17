import { NextResponse } from "next/server";
import { applyCandidateAction, type CandidateAction } from "@/lib/viral-radar/backend/radar-service";
import { badBody, readJsonBody, requireSessionUserId, unauthenticated, viralRadarErrorResponse } from "@/lib/viral-radar/backend/route-helpers";

export const dynamic = "force-dynamic";
// "Criar conteúdo original" chama a IA (e lê as fontes oficiais).
export const maxDuration = 60;

interface RouteParams {
  params: Promise<{ candidateId: string }>;
}

const ACTIONS: CandidateAction[] = ["approve", "ignore", "restore", "brief", "reprocess"];

/** POST { action: "approve", rightsConfirmed, licenseScope, licenseNote } | { action: "ignore" | "restore" | "brief" | "reprocess" } */
export async function POST(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  const body = await readJsonBody(request);
  if (!body) return badBody();
  if (!ACTIONS.includes(body.action as CandidateAction)) return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  const { candidateId } = await params;
  try {
    return NextResponse.json(await applyCandidateAction(userId, candidateId, body.action as CandidateAction, body));
  } catch (error) {
    return viralRadarErrorResponse(error, "candidate.action_failed");
  }
}
