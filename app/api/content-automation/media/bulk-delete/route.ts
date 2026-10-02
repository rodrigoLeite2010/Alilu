import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteMediaForUser, MediaDeletionError } from "@/lib/content-automation/backend/media-delete-service";

const MAX_IDS = 200;

/**
 * POST { ids: string[] } — exclusão em massa da biblioteca (MediaPicker).
 * Aplica a MESMA regra da exclusão individual a cada mídia: só apaga o que
 * é do usuário logado; mantém (e explica) o que já foi usado em publicação
 * ou é imagem/vídeo padrão de alguma automação.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  let ids: string[];
  try {
    const body = (await request.json()) as { ids?: unknown };
    ids = Array.isArray(body.ids) ? [...new Set(body.ids.filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)))] : [];
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  if (ids.length === 0) return NextResponse.json({ error: "Nenhuma mídia selecionada." }, { status: 400 });
  if (ids.length > MAX_IDS) return NextResponse.json({ error: `Selecione no máximo ${MAX_IDS} mídias por vez.` }, { status: 400 });

  const deleted: string[] = [];
  const kept: Array<{ id: string; reason: string }> = [];
  for (const id of ids) {
    try {
      await deleteMediaForUser(id, userId);
      deleted.push(id);
    } catch (error) {
      if (error instanceof MediaDeletionError) {
        kept.push({ id, reason: error.message });
      } else {
        console.error("[content-automation/media/bulk-delete] falha ao apagar mídia", { mediaId: id, message: (error as Error)?.message });
        kept.push({ id, reason: "Não foi possível apagar agora." });
      }
    }
  }
  return NextResponse.json({ deleted, kept });
}
