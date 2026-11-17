import { NextResponse } from "next/server";
import { registerItemUpload } from "@/lib/video-queue/backend/queue-service";
import { serializeItem } from "@/lib/video-queue/backend/queue-dto";
import { badBody, readJsonBody, requireSessionUserId, unauthenticated, videoQueueErrorResponse } from "@/lib/video-queue/backend/route-helpers";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ itemId: string }>;
}

/** POST { blobUrl, authorized: true } — registra o arquivo autorizado enviado direto ao Blob. */
export async function POST(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  const body = await readJsonBody(request);
  if (!body) return badBody();
  const { itemId } = await params;
  try {
    return NextResponse.json({ item: serializeItem(await registerItemUpload(userId, itemId, body)) });
  } catch (error) {
    return videoQueueErrorResponse(error, "item.upload.failed");
  }
}
