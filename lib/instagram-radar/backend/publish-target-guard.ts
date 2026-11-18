import "server-only";
import type { PostForPublish } from "@/lib/instagram/backend/instagram-post-repository";
import { getQueueTargetForPost } from "./radar-repository";

/**
 * Garantia de CONTA CORRETA imediatamente antes da API da Meta (camada única
 * de publicação do Instagram). Devolve a mensagem de bloqueio, ou null.
 *
 *   1. a conta gravada na publicação precisa ser do MESMO usuário da publicação;
 *   2. publicação criada por Fila de vídeos / Radar Instagram: a conta da
 *      publicação precisa ser EXATAMENTE a conta escolhida na fila/radar
 *      (Radar → Fila → Agendamento → Cron → API Meta com o mesmo ID).
 *
 * Nunca escolhe outra conta: bloqueado = publicação falha com o motivo e a
 * Meta não é chamada.
 */
export const WRONG_ACCOUNT_MESSAGE =
  "Publicação bloqueada: a conta do Instagram desta publicação não é a conta escolhida para ela. Nada foi enviado ao Instagram.";

export async function verifyPublicationTarget(post: PostForPublish, userId: string): Promise<string | null> {
  if (post.accountUserId !== undefined && post.accountUserId !== null && post.accountUserId !== userId) return WRONG_ACCOUNT_MESSAGE;
  if (!post.videoQueueItemId) return null;
  const target = await getQueueTargetForPost(post.id);
  // Item da fila apagado: a publicação já existente segue as regras normais (conta do próprio usuário, conferida acima).
  if (!target) return null;
  if (target.queueUserId !== userId) return WRONG_ACCOUNT_MESSAGE;
  if (post.instagramAccountId !== undefined && target.queueInstagramAccountId !== post.instagramAccountId) return WRONG_ACCOUNT_MESSAGE;
  return null;
}
