import { NextResponse } from "next/server";
import { addRadarLinks } from "@/lib/instagram-radar/backend/radar-service";
import { radarErrorResponse } from "@/lib/instagram-radar/backend/radar-dto";
import { badBody, readJsonBody, requireSessionUserId, unauthenticated } from "@/lib/video-queue/backend/route-helpers";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** POST { links, mode: "AUTHORIZED" | "REFERENCE", authorized? } — acrescenta links ao fim da fila do radar. */
export async function POST(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  const body = await readJsonBody(request);
  if (!body) return badBody();
  const { id } = await params;
  try {
    return NextResponse.json(await addRadarLinks(userId, id, body));
  } catch (error) {
    return radarErrorResponse(error, "links.failed");
  }
}
