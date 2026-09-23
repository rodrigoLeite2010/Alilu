import "server-only";
import { logPublicationEvent } from "@/lib/instagram/backend/publication-log";

/**
 * Ponto único de notificação do resultado de uma publicação (sucesso ou
 * falha definitiva). Hoje só registra em log — o projeto ainda não tem um
 * canal de notificação ao usuário. Para ativar e-mail no futuro (o projeto
 * já usa Resend no login por código), basta implementar o envio aqui; os
 * chamadores (instagram-publish-service.ts) não mudam.
 *
 * Nunca lança: uma falha de notificação jamais pode desfazer ou repetir
 * uma publicação.
 */
export interface PublicationResultNotification {
  userId: string;
  publicationId: string;
  status: "PUBLISHED" | "FAILED";
  message?: string;
}

export async function notifyPublicationResult(notification: PublicationResultNotification): Promise<void> {
  try {
    logPublicationEvent({ event: "notify", publicationId: notification.publicationId, status: notification.status });
  } catch {
    // notificação é "melhor esforço"
  }
}
