import { NextResponse } from "next/server";
import { applyQueueAction, getQueueDashboard, reorderQueue, updateSettings, type QueueAction } from "@/lib/video-queue/backend/queue-service";
import { serializeDashboard } from "@/lib/video-queue/backend/queue-dto";
import { badBody, readJsonBody, requireSessionUserId, unauthenticated, videoQueueErrorResponse } from "@/lib/video-queue/backend/route-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Painel: fila, contadores, itens (com o status de cada rede), programação e histórico. */
export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  const { id } = await params;
  try {
    return NextResponse.json(serializeDashboard(await getQueueDashboard(userId, id)));
  } catch (error) {
    return videoQueueErrorResponse(error, "dashboard.failed");
  }
}

const ACTIONS: QueueAction[] = ["activate", "pause", "resume", "archive"];

/**
 * PATCH { action: "activate" | "pause" | "resume" | "archive" }
 *       { action: "update", ...configurações }
 *       { action: "reorder", order: [itemIds] }
 */
export async function PATCH(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  const body = await readJsonBody(request);
  if (!body) return badBody();
  const { id } = await params;
  try {
    if (body.action === "update") await updateSettings(userId, id, body);
    else if (body.action === "reorder") await reorderQueue(userId, id, body.order);
    else if (ACTIONS.includes(body.action as QueueAction)) await applyQueueAction(userId, id, body.action as QueueAction);
    else return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return videoQueueErrorResponse(error, "action.failed");
  }
}

/** DELETE: arquiva a fila (publicações futuras que ainda não começaram são desfeitas; o histórico fica). */
export async function DELETE(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  const { id } = await params;
  try {
    await applyQueueAction(userId, id, "archive");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return videoQueueErrorResponse(error, "archive.failed");
  }
}
