import { NextResponse } from "next/server";
import { registerYoutubeUpload } from "@/lib/youtube-import/backend/import-service";
import { serializeYoutubeImport } from "@/lib/youtube-import/backend/import-dto";
import { readJsonBody, requireYoutubeImportUser, unauthorized, youtubeErrorResponse } from "@/lib/youtube-import/backend/route-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** POST { blobUrl, authorized: true }: registra o arquivo enviado (conferido no Blob e validado com ffprobe). */
export async function POST(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const user = await requireYoutubeImportUser();
  if (!user) return unauthorized();
  const body = await readJsonBody(request);
  if (!body) return NextResponse.json({ error: "Corpo da requisição inválido.", code: "BAD_REQUEST" }, { status: 400 });
  const { id } = await params;
  try {
    const record = await registerYoutubeUpload(user.userId, id, { blobUrl: body.blobUrl, authorized: body.authorized });
    return NextResponse.json({ import: serializeYoutubeImport(record) });
  } catch (error) {
    return youtubeErrorResponse(error, "file.crash");
  }
}
