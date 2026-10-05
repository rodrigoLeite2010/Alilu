import { NextResponse } from "next/server";
import { getInstagramImportQuota, resolveInstagramLink } from "@/lib/instagram-import/backend/import-service";
import { serializeImport } from "@/lib/instagram-import/backend/import-dto";
import { errorResponse, readJson, requireImportUser } from "@/lib/instagram-import/backend/route-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST { url, authorized: true, force? }: identifica o conteúdo e devolve a prévia (ou o já importado). */
export async function POST(request: Request): Promise<NextResponse> {
  const user = await requireImportUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { userId, isAdmin } = user;
  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  try {
    const result = await resolveInstagramLink(userId, { url: body.url, authorized: body.authorized, force: body.force }, new Date(), { isAdmin });
    return NextResponse.json({
      import: result.record ? serializeImport(result.record) : null,
      duplicate: result.duplicate ? serializeImport(result.duplicate) : null,
      quota: await getInstagramImportQuota(userId, isAdmin),
    });
  } catch (error) {
    return errorResponse(error, "resolve.crash");
  }
}
