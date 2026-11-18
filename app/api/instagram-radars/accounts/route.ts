import { NextResponse } from "next/server";
import { listRadarAccountOptions } from "@/lib/instagram-radar/backend/radar-accounts";
import { radarErrorResponse } from "@/lib/instagram-radar/backend/radar-dto";
import { requireSessionUserId, unauthenticated } from "@/lib/video-queue/backend/route-helpers";

export const dynamic = "force-dynamic";

/** GET: contas Instagram CONECTADAS do usuário logado para o seletor do radar (sem tokens). */
export async function GET(): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  try {
    return NextResponse.json(await listRadarAccountOptions(userId));
  } catch (error) {
    return radarErrorResponse(error, "accounts.failed");
  }
}
