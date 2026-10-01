import { NextResponse } from "next/server";
import { registerManualUpload } from "@/lib/instagram-import/backend/import-service";
import { serializeImport } from "@/lib/instagram-import/backend/import-dto";
import { errorResponse, readJson, requireUserId } from "@/lib/instagram-import/backend/route-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST { blobUrl, authorized: true, originalUrl? }: registra o upload manual (validado com ffprobe). */
export async function POST(request: Request): Promise<NextResponse> {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  try {
    const record = await registerManualUpload(userId, { blobUrl: body.blobUrl, authorized: body.authorized, originalUrl: body.originalUrl });
    return NextResponse.json({ import: serializeImport(record) });
  } catch (error) {
    return errorResponse(error, "manual.crash");
  }
}
