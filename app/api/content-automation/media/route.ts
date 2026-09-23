import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listMediaForUser } from "@/lib/instagram/backend/media-repository";

/** GET: mídias já enviadas pelo usuário (?type=image|video) — para o seletor de imagem/vídeo fixo das automações. */
export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const type = new URL(request.url).searchParams.get("type");
  const mediaType = type === "image" || type === "video" ? type : undefined;

  try {
    const media = await listMediaForUser(userId, mediaType);
    return NextResponse.json({
      media: media.map((item) => ({
        id: item.id,
        storageUrl: item.storageUrl,
        mediaType: item.mediaType,
        originalFilename: item.originalFilename,
        createdAt: item.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[content-automation/media] falha ao listar mídias", error);
    return NextResponse.json({ error: "Não foi possível carregar as mídias." }, { status: 500 });
  }
}
