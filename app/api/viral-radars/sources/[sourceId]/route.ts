import { NextResponse } from "next/server";
import { editSource, removeSource } from "@/lib/viral-radar/backend/radar-service";
import { badBody, readJsonBody, requireSessionUserId, unauthenticated, viralRadarErrorResponse } from "@/lib/viral-radar/backend/route-helpers";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ sourceId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  const body = await readJsonBody(request);
  if (!body) return badBody();
  const { sourceId } = await params;
  try {
    await editSource(userId, sourceId, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return viralRadarErrorResponse(error, "source.update_failed");
  }
}

export async function DELETE(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  const { sourceId } = await params;
  try {
    await removeSource(userId, sourceId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return viralRadarErrorResponse(error, "source.delete_failed");
  }
}
