import "server-only";
import { NextResponse } from "next/server";
import { isMissingSchemaError, MIGRATION_PENDING_MESSAGE } from "@/lib/db/schema-errors";
import { ViralRadarError } from "./radar-service";

export { badBody, readJsonBody, requireSessionUserId, unauthenticated } from "@/lib/video-queue/backend/route-helpers";

export function viralRadarErrorResponse(error: unknown, event: string): NextResponse {
  if (error instanceof ViralRadarError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
  }
  if (isMissingSchemaError(error)) {
    console.error(JSON.stringify({ scope: "viral-radar", event, code: "MIGRATION_PENDING" }));
    return NextResponse.json({ error: MIGRATION_PENDING_MESSAGE, code: "MIGRATION_PENDING" }, { status: 503 });
  }
  console.error(JSON.stringify({ scope: "viral-radar", event, message: (error as Error)?.message?.slice(0, 300) }));
  return NextResponse.json({ error: "Não foi possível concluir agora. Tente novamente." }, { status: 500 });
}
