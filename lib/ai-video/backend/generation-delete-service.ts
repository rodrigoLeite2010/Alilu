import "server-only";
import { del as deleteBlob } from "@vercel/blob";
import { markGenerationDeletedByUser } from "./generation-repository";

/**
 * "Excluir vídeo" de uma geração do próprio usuário: tira do histórico e
 * apaga o MP4 do storage. Devolve `false` se não existe, não é do usuário
 * ou ainda está em andamento. Usado pela exclusão individual e em massa.
 */
export async function deleteGenerationForUser(id: string, userId: string): Promise<boolean> {
  const removed = await markGenerationDeletedByUser(id, userId);
  if (!removed) return false;
  if (removed.storageVideoUrl) {
    await deleteBlob(removed.storageVideoUrl).catch((error) =>
      console.error(JSON.stringify({ scope: "ai-video", event: "user_delete.blob_failed", generationId: id, message: (error as Error)?.message })),
    );
  }
  return true;
}
