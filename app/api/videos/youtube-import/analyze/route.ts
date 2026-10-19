import { NextResponse } from "next/server";
import { analyzeYoutubeLink, getYoutubeImportQuota } from "@/lib/youtube-import/backend/import-service";
import { serializeYoutubeImport } from "@/lib/youtube-import/backend/import-dto";
import { readJsonBody, requireYoutubeImportUser, unauthorized, youtubeErrorResponse } from "@/lib/youtube-import/backend/route-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** POST { url, authorized: true, force? }: valida o link e consulta os metadados públicos na API oficial. */
export async function POST(request: Request): Promise<NextResponse> {
  const user = await requireYoutubeImportUser();
  if (!user) return unauthorized();
  const body = await readJsonBody(request);
  if (!body) return NextResponse.json({ error: "Corpo da requisição inválido.", code: "BAD_REQUEST" }, { status: 400 });
  try {
    const result = await analyzeYoutubeLink(user.userId, { url: body.url, authorized: body.authorized, force: body.force }, new Date(), {
      isAdmin: user.isAdmin,
    });
    return NextResponse.json({
      import: result.record ? serializeYoutubeImport(result.record) : null,
      duplicate: result.duplicate ? serializeYoutubeImport(result.duplicate) : null,
      quota: await getYoutubeImportQuota(user.userId, user.isAdmin),
    });
  } catch (error) {
    return youtubeErrorResponse(error, "analyze.crash");
  }
}
