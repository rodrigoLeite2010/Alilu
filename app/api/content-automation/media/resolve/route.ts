import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveUploadedMediaId } from "@/lib/instagram/backend/instagram-post-service";

/**
 * POST `{ url }`: resolve a URL de um blob recém-enviado (upload direto
 * ao Vercel Blob) para o id de mídia correspondente — reaproveita o MESMO
 * poll curto já usado ao criar posts (resolveUploadedMediaId), nunca uma
 * segunda implementação de upload.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const { url } = (body as { url?: unknown }) ?? {};
  if (typeof url !== "string" || !url) {
    return NextResponse.json({ error: "url é obrigatório." }, { status: 400 });
  }

  try {
    const mediaId = await resolveUploadedMediaId(url, userId);
    return NextResponse.json({ mediaId });
  } catch (error) {
    console.error("[content-automation/media/resolve] falha ao resolver mídia", error);
    return NextResponse.json({ error: "O upload ainda não terminou de ser registrado. Tente novamente." }, { status: 400 });
  }
}
