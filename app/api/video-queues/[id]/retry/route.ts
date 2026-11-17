import { NextResponse } from "next/server";
import { retryErrors } from "@/lib/video-queue/backend/queue-service";
import { readJsonBody, requireSessionUserId, unauthenticated, videoQueueErrorResponse } from "@/lib/video-queue/backend/route-helpers";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** POST { itemIds?: [] } — "Reprocessar erros": só itens com erro de importação voltam para a fila. */
export async function POST(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  const body = (await readJsonBody(request)) ?? {};
  const { id } = await params;
  try {
    return NextResponse.json({ retried: await retryErrors(userId, id, body.itemIds) });
  } catch (error) {
    return videoQueueErrorResponse(error, "retry.failed");
  }
}
