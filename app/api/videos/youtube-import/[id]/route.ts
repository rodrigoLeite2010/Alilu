import { NextResponse } from "next/server";
import { getYoutubeImportForUser } from "@/lib/youtube-import/backend/import-repository";
import { deleteYoutubeImportWithFile, isUuid } from "@/lib/youtube-import/backend/import-service";
import { serializeYoutubeImport } from "@/lib/youtube-import/backend/import-dto";
import { requireYoutubeImportUser, unauthorized, youtubeErrorResponse } from "@/lib/youtube-import/backend/route-helpers";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET: uma importação do próprio usuário (o Split-Screen e o Reels usam para pré-carregar o arquivo). */
export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const user = await requireYoutubeImportUser();
  if (!user) return unauthorized();
  const { id } = await params;
  try {
    const record = isUuid(id) ? await getYoutubeImportForUser(id, user.userId) : null;
    if (!record) return NextResponse.json({ error: "Importação não encontrada.", code: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ import: serializeYoutubeImport(record) });
  } catch (error) {
    return youtubeErrorResponse(error, "get.crash");
  }
}

/** DELETE: apaga o registro e o arquivo enviado. */
export async function DELETE(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const user = await requireYoutubeImportUser();
  if (!user) return unauthorized();
  const { id } = await params;
  try {
    const removed = await deleteYoutubeImportWithFile(user.userId, id);
    if (!removed) return NextResponse.json({ error: "Importação não encontrada.", code: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return youtubeErrorResponse(error, "delete.crash");
  }
}
