import { NextResponse } from "next/server";
import { createRadar, listRadarsOverview } from "@/lib/instagram-radar/backend/radar-service";
import { radarErrorResponse, serializeRadarOverview } from "@/lib/instagram-radar/backend/radar-dto";
import { badBody, readJsonBody, requireSessionUserId, unauthenticated } from "@/lib/video-queue/backend/route-helpers";

export const dynamic = "force-dynamic";

/** GET: radares do usuário logado (conta, status e contadores). */
export async function GET(): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  try {
    return NextResponse.json({ radars: (await listRadarsOverview(userId)).map(serializeRadarOverview) });
  } catch (error) {
    return radarErrorResponse(error, "list.failed");
  }
}

/**
 * POST { name, instagramAccountId, schedule, links?, mode?, authorized?, captionTemplate?, hashtags?, missingCaptionPolicy?, notReadyPolicy? }
 * Cria o radar em RASCUNHO (a pessoa confere a prévia e só então ativa).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  const body = await readJsonBody(request);
  if (!body) return badBody();
  try {
    return NextResponse.json(await createRadar(userId, body), { status: 201 });
  } catch (error) {
    return radarErrorResponse(error, "create.failed");
  }
}
