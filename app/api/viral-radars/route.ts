import { NextResponse } from "next/server";
import { connectorAvailability } from "@/lib/viral-radar/backend/connectors";
import { serializeOverview } from "@/lib/viral-radar/backend/radar-dto";
import { createRadar, listRadarsOverview } from "@/lib/viral-radar/backend/radar-service";
import { badBody, readJsonBody, requireSessionUserId, unauthenticated, viralRadarErrorResponse } from "@/lib/viral-radar/backend/route-helpers";
import type { RadarSourceType } from "@/lib/viral-radar/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TYPES: RadarSourceType[] = ["YOUTUBE_SEARCH", "YOUTUBE_CHANNEL", "RSS", "INSTAGRAM_HASHTAG", "TIKTOK"];

/** Lista de radares + indicadores gerais + disponibilidade dos conectores (para o formulário). */
export async function GET(): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  try {
    return NextResponse.json({
      ...serializeOverview(await listRadarsOverview(userId)),
      connectors: Object.fromEntries(TYPES.map((type) => [type, connectorAvailability(type)])),
    });
  } catch (error) {
    return viralRadarErrorResponse(error, "list.failed");
  }
}

/** Cria o radar (e a fila de vídeos dele, com as contas e horários escolhidos). */
export async function POST(request: Request): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  const body = await readJsonBody(request);
  if (!body) return badBody();
  try {
    return NextResponse.json(await createRadar(userId, body), { status: 201 });
  } catch (error) {
    return viralRadarErrorResponse(error, "create.failed");
  }
}
