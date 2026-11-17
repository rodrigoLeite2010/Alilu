import { NextResponse } from "next/server";
import { serializeCandidate } from "@/lib/viral-radar/backend/radar-dto";
import { listCandidates } from "@/lib/viral-radar/backend/radar-service";
import { requireSessionUserId, unauthenticated, viralRadarErrorResponse } from "@/lib/viral-radar/backend/route-helpers";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET ?status=AWAITING_AUTHORIZATION&route=C&page=1 */
export async function GET(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await requireSessionUserId();
  if (!userId) return unauthenticated();
  const { id } = await params;
  const search = new URL(request.url).searchParams;
  try {
    const result = await listCandidates(userId, id, { status: search.get("status"), route: search.get("route"), page: Number(search.get("page") ?? 1) || 1 });
    return NextResponse.json({ total: result.total, page: result.page, pageSize: result.pageSize, candidates: result.rows.map(serializeCandidate) });
  } catch (error) {
    return viralRadarErrorResponse(error, "candidates.failed");
  }
}
