import { NextResponse } from "next/server";
import { previewNewRadar } from "@/lib/instagram-radar/backend/radar-service";
import { radarErrorResponse } from "@/lib/instagram-radar/backend/radar-dto";
import { badBody, readJsonBody, requireSessionUserId, unauthenticated } from "@/lib/video-queue/backend/route-helpers";

export const dynamic = "force-dynamic";

/** POST { instagramAccountId, schedule, links } → prévia da programação (nada é gravado). */
export async function POST(request: Request): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  const body = await readJsonBody(request);
  if (!body) return badBody();
  try {
    return NextResponse.json(await previewNewRadar(userId, body));
  } catch (error) {
    return radarErrorResponse(error, "preview.failed");
  }
}
