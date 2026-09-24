import "server-only";
import { del as deleteBlob } from "@vercel/blob";
import { deleteInstagramMedia, getInstagramMediaById, isMediaUsedInPosts } from "@/lib/instagram/backend/media-repository";
import { listAutomationNamesUsingMedia } from "./automation-repository";

/**
 * Exclusão de mídia da biblioteca (instagram_media) a partir do Piloto
 * Automático (MediaPicker.tsx, seção "Imagem e vídeo padrão"/"IA sobre a
 * imagem") — mas vale pra qualquer mídia do usuário, não só a usada em
 * automações. Fica em content-automation (não em lib/instagram/backend)
 * porque precisa saber quais automações/dias usam a mídia antes de
 * apagar; o padrão do projeto é content-automation importar de
 * lib/instagram/backend, nunca o contrário.
 */
export class MediaDeletionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaDeletionError";
  }
}

/**
 * Apaga a mídia (linha em instagram_media + arquivo no Vercel Blob),
 * restrito ao dono. Bloqueia (sem apagar nada) se a mídia:
 * - já foi usada em algum post/reel do Agendador (instagram_post_items
 *   tem FK "on delete restrict" — apagaria uma publicação existente); ou
 * - está definida como imagem/vídeo padrão de uma automação, ou de um dia
 *   específico dela (a FK é "on delete set null", então tecnicamente não
 *   quebraria o banco, mas deixaria a automação sem imagem/vídeo
 *   silenciosamente — melhor pedir pra trocar antes).
 */
export async function deleteMediaForUser(mediaId: string, userId: string): Promise<void> {
  const media = await getInstagramMediaById(mediaId, userId);
  if (!media) {
    throw new MediaDeletionError("Mídia não encontrada.");
  }

  const usedInPosts = await isMediaUsedInPosts(mediaId, userId);
  if (usedInPosts) {
    throw new MediaDeletionError("Essa mídia já foi usada em uma publicação e não pode ser apagada.");
  }

  const automationNames = await listAutomationNamesUsingMedia(mediaId, userId);
  if (automationNames.length > 0) {
    throw new MediaDeletionError(
      `Essa mídia está definida como imagem/vídeo padrão em: ${automationNames.join(", ")}. Troque a mídia lá antes de apagar.`,
    );
  }

  const deleted = await deleteInstagramMedia(mediaId, userId);
  if (!deleted) {
    throw new MediaDeletionError("Mídia não encontrada.");
  }

  try {
    await deleteBlob(deleted.storageUrl);
  } catch (error) {
    // A linha já foi apagada do banco — a mídia já não aparece mais na
    // biblioteca do usuário, que é o que importa pro produto. Um arquivo
    // órfão no Blob não afeta nada visível; só loga pra investigar depois.
    console.error("[media-delete-service] falha ao apagar arquivo no Vercel Blob (linha já removida do banco)", error);
  }
}
