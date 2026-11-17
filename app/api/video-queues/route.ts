import { NextResponse } from "next/server";
import { createQueue, listQueuesOverview } from "@/lib/video-queue/backend/queue-service";
import { serializeCounts, serializeQueue } from "@/lib/video-queue/backend/queue-dto";
import { badBody, readJsonBody, requireSessionUserId, unauthenticated, videoQueueErrorResponse } from "@/lib/video-queue/backend/route-helpers";

export const dynamic = "force-dynamic";

/** GET: filas do usuário com os contadores. */
export async function GET(): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  try {
    const overview = await listQueuesOverview(userId);
    return NextResponse.json({ queues: overview.map(({ queue, counts }) => ({ ...serializeQueue(queue), counts: serializeCounts(counts) })) });
  } catch (error) {
    return videoQueueErrorResponse(error, "list.failed");
  }
}

/** POST: cria a fila (em rascunho) com os links colados. Ativar é uma ação separada, depois da prévia. */
export async function POST(request: Request): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  const body = await readJsonBody(request);
  if (!body) return badBody();
  try {
    const result = await createQueue(userId, body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return videoQueueErrorResponse(error, "create.failed");
  }
}
