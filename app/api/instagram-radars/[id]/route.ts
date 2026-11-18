import { NextResponse } from "next/server";
import { getRadarDashboard, requireRadar, updateRadarSettings } from "@/lib/instagram-radar/backend/radar-service";
import { radarErrorResponse, serializeRadarDashboard } from "@/lib/instagram-radar/backend/radar-dto";
import { applyQueueAction, reorderQueue, type QueueAction } from "@/lib/video-queue/backend/queue-service";
import { badBody, readJsonBody, requireSessionUserId, unauthenticated } from "@/lib/video-queue/backend/route-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Painel do radar: configuração, contadores, itens, prévia/próximos horários e histórico. */
export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  const { id } = await params;
  try {
    return NextResponse.json(serializeRadarDashboard(await getRadarDashboard(userId, id)));
  } catch (error) {
    return radarErrorResponse(error, "dashboard.failed");
  }
}

const ACTIONS: QueueAction[] = ["activate", "pause", "resume", "archive"];

/**
 * PATCH { action: "activate" | "pause" | "resume" | "archive" }  (cancelar o radar = "archive")
 *       { action: "update", name?, schedule?, captionTemplate?, hashtags?, missingCaptionPolicy?, notReadyPolicy? }
 *       { action: "reorder", order: [itemIds] }
 */
export async function PATCH(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  const body = await readJsonBody(request);
  if (!body) return badBody();
  const { id } = await params;
  try {
    await requireRadar(userId, id);
    if (body.action === "update") await updateRadarSettings(userId, id, body);
    else if (body.action === "reorder") await reorderQueue(userId, id, body.order);
    else if (ACTIONS.includes(body.action as QueueAction)) await applyQueueAction(userId, id, body.action as QueueAction);
    else return badBody();
    return NextResponse.json(serializeRadarDashboard(await getRadarDashboard(userId, id)));
  } catch (error) {
    return radarErrorResponse(error, "update.failed");
  }
}
