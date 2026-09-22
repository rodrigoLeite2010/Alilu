import "server-only";
import { decryptSecret } from "@/lib/instagram/backend/encryption";
import {
  InstagramGraphApiError,
  createImageMediaContainer,
  getMediaContainerStatus,
  publishMediaContainer,
} from "@/lib/instagram/backend/meta-graph-client";
import {
  getPostForPublish,
  markPostFailed,
  markPostProcessing,
  markPostPublished,
  recordPublishAttempt,
} from "@/lib/instagram/backend/instagram-post-repository";

/**
 * Orquestra a publicação de um post de imagem única já existente — etapa
 * "InstagramService" (post único primeiro; carrossel e Reels vêm depois,
 * cada um com sua própria orquestração). Nunca declara PUBLISHED sem a
 * Meta confirmar de volta o id da mídia publicada (media_publish
 * bem-sucedido) — regra inegociável do projeto.
 *
 * Polling limitado: a documentação da Meta recomenda consultar o status do
 * container até uma vez por minuto, por até 5 minutos — tempo incompatível
 * com uma única invocação síncrona de Vercel Function. Este serviço faz um
 * polling curto (intervalo de 2s, até ~24s) e, se o container não terminar
 * de processar nessa janela, deixa o post em PROCESSING com o container
 * salvo, SEM marcar falha — uma nova chamada a publishImagePost (manual
 * por enquanto; futuramente pelo endpoint do scheduler, etapa própria)
 * retoma o polling de onde parou, sem criar um segundo container. Imagem
 * única normalmente termina em poucos segundos; isso é uma salvaguarda,
 * não o caminho esperado. Lock/idempotência formais contra chamadas
 * concorrentes ficam para a etapa do scheduler.
 */

export class InstagramPublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstagramPublishError";
  }
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 12; // ~24s de espera limitada dentro desta chamada

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeErrorForStorage(error: unknown): string {
  if (error instanceof InstagramGraphApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Erro desconhecido ao publicar no Instagram.";
}

/**
 * Loga o erro ORIGINAL (nunca o `InstagramPublishError` genérico que
 * devolvemos pro chamador) — inclui `.details` quando é um
 * `InstagramGraphApiError`, que carrega o corpo da resposta de erro da
 * própria Meta (código, mensagem, fbtrace_id). Nunca inclui o
 * `access_token` (não faz parte de `.details`, que é só o corpo JSON da
 * resposta de erro da Meta). Só em `console.error` (logs do servidor) —
 * o chamador desta função sempre recebe uma mensagem genérica em
 * português, nunca este detalhe. Mesmo padrão já usado em
 * instagram-oauth-service.ts.
 */
function logPublishError(context: string, error: unknown): void {
  if (error instanceof InstagramGraphApiError) {
    console.error(`[instagram-publish-service] ${context}`, error.message, error.details);
    return;
  }
  console.error(`[instagram-publish-service] ${context}`, error);
}

export type PublishImagePostResult = "PUBLISHED" | "PROCESSING";

export async function publishImagePost(postId: string, userId: string): Promise<PublishImagePostResult> {
  const post = await getPostForPublish(postId, userId);
  if (!post) {
    throw new InstagramPublishError("Post não encontrado.");
  }
  if (post.postType !== "image") {
    throw new InstagramPublishError(
      "Esta etapa só publica posts de imagem única (carrossel/Reels vêm depois).",
    );
  }
  if (post.status === "PUBLISHED") {
    return "PUBLISHED"; // idempotente — não tenta publicar de novo
  }
  // SCHEDULED é publicável manualmente antes da hora — o calendário
  // editorial permite "Publicar agora" em qualquer post agendado, sem
  // esperar o scheduler (etapa futura, ainda sem disparo automático).
  if (post.status !== "DRAFT" && post.status !== "SCHEDULED" && post.status !== "PROCESSING") {
    throw new InstagramPublishError(`Post no status '${post.status}' não pode ser publicado agora.`);
  }
  if (post.mediaType !== "image") {
    throw new InstagramPublishError("A mídia associada a este post não é uma imagem.");
  }

  const accessToken = decryptSecret(post.accessTokenEncrypted);

  let containerId = post.metaContainerId;
  if (!containerId) {
    try {
      containerId = await createImageMediaContainer({
        igUserId: post.igUserId,
        accessToken,
        imageUrl: post.mediaStorageUrl,
        caption: post.caption,
      });
    } catch (error) {
      logPublishError("falha ao criar o container de mídia", error);
      const message = sanitizeErrorForStorage(error);
      await markPostFailed(postId, message);
      await recordPublishAttempt({ postId, outcome: "failure", errorSanitized: message });
      throw new InstagramPublishError("Falha ao criar o container de mídia no Instagram.");
    }
    await markPostProcessing(postId, containerId);
  }

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    let status;
    try {
      status = await getMediaContainerStatus({ containerId, accessToken });
    } catch (error) {
      logPublishError("falha ao consultar o status do processamento", error);
      const message = sanitizeErrorForStorage(error);
      await recordPublishAttempt({ postId, outcome: "failure", errorSanitized: message, containerId });
      throw new InstagramPublishError("Falha ao consultar o status do processamento no Instagram.");
    }

    if (status === "FINISHED") {
      try {
        const mediaId = await publishMediaContainer({ igUserId: post.igUserId, accessToken, containerId });
        await markPostPublished(postId, mediaId);
        await recordPublishAttempt({ postId, outcome: "success", containerId, mediaId });
        return "PUBLISHED";
      } catch (error) {
        logPublishError("falha ao publicar o container de mídia", error);
        const message = sanitizeErrorForStorage(error);
        await markPostFailed(postId, message);
        await recordPublishAttempt({ postId, outcome: "failure", errorSanitized: message, containerId });
        throw new InstagramPublishError("Falha ao publicar o container de mídia no Instagram.");
      }
    }

    if (status === "ERROR" || status === "EXPIRED") {
      const message = `Processamento da mídia falhou no Instagram (status: ${status}).`;
      await markPostFailed(postId, message);
      await recordPublishAttempt({ postId, outcome: "failure", errorSanitized: message, containerId });
      throw new InstagramPublishError(message);
    }

    // IN_PROGRESS, ou PUBLISHED numa corrida improvável com outra chamada
    // concorrente (sem lock nesta etapa — ver nota acima) — nos dois casos
    // não há nada novo e seguro a fazer aqui além de esperar mais uma
    // rodada ou, se as tentativas acabarem, devolver PROCESSING abaixo.
    if (attempt < MAX_POLL_ATTEMPTS - 1) {
      await sleep(POLL_INTERVAL_MS);
    }
  }

  await recordPublishAttempt({ postId, outcome: "pending", containerId });
  return "PROCESSING";
}
