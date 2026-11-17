import { NextResponse } from "next/server";
import { processNow } from "@/lib/video-queue/backend/queue-service";
import { requireSessionUserId, unauthenticated, videoQueueErrorResponse } from "@/lib/video-queue/backend/route-helpers";

export const dynamic = "force-dynamic";
// Uma importação (download até 50 s + ffprobe + miniatura + Blob).
export const maxDuration = 120;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** POST: "Processar agora" — importa o próximo vídeo DESTA fila e planeja, sem esperar o cron. */
export async function POST(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  const { id } = await params;
  try {
    return NextResponse.json(await processNow(userId, id));
  } catch (error) {
    return videoQueueErrorResponse(error, "process.failed");
  }
}
