import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteMediaForUser, MediaDeletionError } from "@/lib/content-automation/backend/media-delete-service";

/**
 * DELETE: apaga uma mídia da biblioteca do usuário (instagram_media +
 * arquivo no Vercel Blob) — usado pelo botão de excluir em
 * components/instagram/content-automation/MediaPicker.tsx. Bloqueia com
 * 400 (mensagem clara) se a mídia já foi usada em um post/reel ou está
 * definida como imagem/vídeo padrão de alguma automação — ver
 * media-delete-service.ts.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;

  try {
    await deleteMediaForUser(id, userId);
    return NextResponse.json({ status: "DELETED" });
  } catch (error) {
    if (error instanceof MediaDeletionError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[content-automation/media/:id] falha ao apagar mídia", error);
    return NextResponse.json({ error: "Não foi possível apagar a mídia." }, { status: 500 });
  }
}
