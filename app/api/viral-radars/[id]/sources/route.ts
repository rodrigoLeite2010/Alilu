import { NextResponse } from "next/server";
import { addSource } from "@/lib/viral-radar/backend/radar-service";
import { badBody, readJsonBody, requireSessionUserId, unauthenticated, viralRadarErrorResponse } from "@/lib/viral-radar/backend/route-helpers";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  const body = await readJsonBody(request);
  if (!body) return badBody();
  const { id } = await params;
  try {
    return NextResponse.json({ id: await addSource(userId, id, body) }, { status: 201 });
  } catch (error) {
    return viralRadarErrorResponse(error, "source.add_failed");
  }
}
