import { NextResponse } from "next/server";
import { addLinks } from "@/lib/video-queue/backend/queue-service";
import { badBody, readJsonBody, requireSessionUserId, unauthenticated, videoQueueErrorResponse } from "@/lib/video-queue/backend/route-helpers";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** POST { links: "um por linha", authorized: true } — adiciona mais links ao fim da fila. */
export async function POST(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  const body = await readJsonBody(request);
  if (!body) return badBody();
  const { id } = await params;
  try {
    return NextResponse.json(await addLinks(userId, id, body));
  } catch (error) {
    return videoQueueErrorResponse(error, "add_links.failed");
  }
}
