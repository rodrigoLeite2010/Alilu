import "server-only";
import { NextResponse } from "next/server";
import { ViralRadarError } from "./radar-service";

export { badBody, readJsonBody, requireSessionUserId, unauthenticated } from "@/lib/video-queue/backend/route-helpers";

export function viralRadarErrorResponse(error: unknown, event: string): NextResponse {
  if (error instanceof ViralRadarError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
  }
  console.error(JSON.stringify({ scope: "viral-radar", event, message: (error as Error)?.message?.slice(0, 300) }));
  return NextResponse.json({ error: "Não foi possível concluir agora. Tente novamente." }, { status: 500 });
}
