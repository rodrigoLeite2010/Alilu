import { NextResponse } from "next/server";
import { cancelItem, prepareItemForImmediatePublish, removeItem, updateItem } from "@/lib/video-queue/backend/queue-service";
import { serializeItem } from "@/lib/video-queue/backend/queue-dto";
import { badBody, readJsonBody, requireSessionUserId, unauthenticated, videoQueueErrorResponse } from "@/lib/video-queue/backend/route-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface RouteParams {
  params: Promise<{ itemId: string }>;
}

/** PATCH { action: "cancel" | "prepare_publish" } | { title?, caption?, facebookCaption? } */
export async function PATCH(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  const body = await readJsonBody(request);
  if (!body) return badBody();
  const { itemId } = await params;
  try {
    if (body.action === "cancel") {
      await cancelItem(userId, itemId);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "prepare_publish") {
      return NextResponse.json({ postId: await prepareItemForImmediatePublish(userId, itemId) });
    }
    return NextResponse.json({ item: serializeItem(await updateItem(userId, itemId, body)) });
  } catch (error) {
    return videoQueueErrorResponse(error, "item.update.failed");
  }
}

/** DELETE: remove o link da fila (publicações já iniciadas/concluídas nunca são desfeitas). */
export async function DELETE(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  const { itemId } = await params;
  try {
    await removeItem(userId, itemId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return videoQueueErrorResponse(error, "item.remove.failed");
  }
}
