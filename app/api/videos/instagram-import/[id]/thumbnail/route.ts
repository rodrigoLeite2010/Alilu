import { NextResponse } from "next/server";
import { getImportForUser } from "@/lib/instagram-import/backend/import-repository";
import { safeDownload } from "@/lib/instagram-import/backend/safe-download";
import { IMPORT_IMAGE_CONTENT_TYPES } from "@/lib/instagram-import/backend/import-service";
import { requireUserId } from "@/lib/instagram-import/backend/route-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET ?item=N: miniatura da prévia, servida PELO ALILU (as CDNs do
 * Instagram costumam bloquear exibição em outros sites, e assim a URL
 * temporária do provedor nunca vai para o navegador). Download seguro
 * (SSRF), só imagem, até 5 MB.
 */
export async function GET(request: Request, { params }: RouteParams): Promise<Response> {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const record = await getImportForUser(id, userId);
  if (!record) return NextResponse.json({ error: "Importação não encontrada." }, { status: 404 });
  const index = Number(new URL(request.url).searchParams.get("item") ?? 0);
  const item = record.resolvedItems[Number.isInteger(index) ? index : 0];
  const source = item?.thumbnailUrl ?? (item?.mediaType === "IMAGE" ? item.mediaUrl : null) ?? record.thumbnailUrl;
  if (!source) return NextResponse.json({ error: "Sem miniatura." }, { status: 404 });
  try {
    const image = await safeDownload(source, { maxBytes: 5 * 1024 * 1024, allowedContentTypes: IMPORT_IMAGE_CONTENT_TYPES, timeoutMs: 15_000 });
    return new Response(new Uint8Array(image.buffer), {
      headers: { "Content-Type": image.contentType, "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return NextResponse.json({ error: "Miniatura indisponível." }, { status: 404 });
  }
}
