import "server-only";
import { copy, del as deleteBlob } from "@vercel/blob";
import { buildMediaPathnamePrefix } from "@/lib/instagram/backend/media-service";
import { insertInstagramMedia } from "@/lib/instagram/backend/media-repository";
import { createCarouselPost } from "@/lib/instagram/backend/instagram-post-service";
import { getImportForUser } from "./import-repository";
import { InstagramImportError, MAX_CAROUSEL_IMPORT_ITEMS } from "./import-service";

/**
 * "Repostar carrossel": transforma um carrossel importado do Instagram
 * (fotos e vídeos, já guardados no Alilu) num post de carrossel do
 * Agendador — mesmo fluxo de qualquer carrossel (publicar agora/agendar).
 *
 * Os arquivos são COPIADOS para instagram-media/{usuário}/ (biblioteca):
 * a importação vence em 7 dias e é limpa automaticamente, mas a publicação
 * agendada precisa do arquivo até ser publicada.
 */
export interface RepostCarouselInput {
  importId?: unknown;
  /** Índices dos itens importados, na ordem desejada (pode remover itens). */
  order?: unknown;
  caption?: unknown;
  scheduledAt?: unknown;
  timezone?: unknown;
}

export async function createCarouselPostFromImport(userId: string, input: RepostCarouselInput): Promise<{ postId: string }> {
  const importId = typeof input.importId === "string" ? input.importId : "";
  const record = /^[0-9a-f-]{36}$/i.test(importId) ? await getImportForUser(importId, userId) : null;
  if (!record) throw new InstagramImportError("Importação não encontrada.", "NOT_FOUND", 404);
  if (record.status !== "COMPLETED" || record.importedItems.length < 2) {
    throw new InstagramImportError("Este conteúdo não é um carrossel importado.", "NOT_CAROUSEL", 400);
  }

  const order = Array.isArray(input.order) ? input.order.map(Number) : record.importedItems.map((item) => item.index);
  if (order.some((value) => !Number.isInteger(value)) || new Set(order).size !== order.length) {
    throw new InstagramImportError("Ordem dos itens inválida.", "INVALID_ORDER", 400);
  }
  if (order.length < 2 || order.length > MAX_CAROUSEL_IMPORT_ITEMS) {
    throw new InstagramImportError(`O carrossel precisa ter de 2 a ${MAX_CAROUSEL_IMPORT_ITEMS} itens.`, "INVALID_ORDER", 400);
  }
  const byIndex = new Map(record.importedItems.map((item) => [item.index, item]));
  const chosen = order.map((index) => byIndex.get(index));
  if (chosen.some((item) => !item)) throw new InstagramImportError("Item do carrossel não encontrado.", "INVALID_ORDER", 400);

  const caption = typeof input.caption === "string" ? input.caption.slice(0, 2200) : "";
  const copiedUrls: string[] = [];
  try {
    const mediaIds: string[] = [];
    for (const [position, item] of chosen.entries()) {
      const extension = item!.mediaType === "VIDEO" ? (item!.contentType === "video/quicktime" ? "mov" : "mp4") : "jpg";
      const copied = await copy(item!.fileUrl, `${buildMediaPathnamePrefix(userId)}repost-${record.id.slice(0, 8)}-${position + 1}.${extension}`, {
        access: "public",
        addRandomSuffix: true,
        contentType: item!.contentType,
      });
      copiedUrls.push(copied.url);
      mediaIds.push(
        await insertInstagramMedia({
          userId,
          storageUrl: copied.url,
          mediaType: item!.mediaType === "VIDEO" ? "video" : "image",
          fileSizeBytes: item!.fileSizeBytes,
          originalFilename: `repost-carrossel-${position + 1}.${extension}`,
        }),
      );
    }
    const postId = await createCarouselPost({
      userId,
      mediaIds,
      caption,
      scheduledAt: typeof input.scheduledAt === "string" && input.scheduledAt ? input.scheduledAt : null,
      timezone: typeof input.timezone === "string" ? input.timezone.slice(0, 64) : null,
    });
    console.info(JSON.stringify({ scope: "instagram-import", event: "carousel_repost_created", importId: record.id, userId, postId, items: mediaIds.length }));
    return { postId };
  } catch (error) {
    // Falhou no meio: não deixa cópias soltas na biblioteca (as linhas de mídia sem post continuam excluíveis pela tela).
    if (!(error instanceof InstagramImportError)) {
      for (const url of copiedUrls) await deleteBlob(url).catch(() => undefined);
    }
    throw error;
  }
}
