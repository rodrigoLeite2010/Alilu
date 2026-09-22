import "server-only";
import { decryptSecret } from "@/lib/instagram/backend/encryption";
import {
  InstagramGraphApiError,
  createCarouselContainer,
  createCarouselItemContainer,
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
  type PostForPublish,
} from "@/lib/instagram/backend/instagram-post-repository";

/**
 * Orquestra a publicação de posts já existentes — imagem única e
 * carrossel nesta etapa (Reels vem depois, com suas próprias regras de
 * vídeo). Nunca declara PUBLISHED sem a Meta confirmar de volta o id da
 * mídia publicada (media_publish bem-sucedido) — regra inegociável do
 * projeto. Nunca publica os itens de um carrossel individualmente — só o
 * container PAI (CAROUSEL) é publicado; os containers de item nunca
 * recebem media_publish.
 *
 * Polling limitado: a documentação da Meta recomenda consultar o status do
 * container até uma vez por minuto, por até 5 minutos — tempo incompatível
 * com uma única invocação síncrona de Vercel Function. Este serviço faz um
 * polling curto (intervalo de 2s, até ~24s) e, se o container não terminar
 * de processar nessa janela, deixa o post em PROCESSING com o container
 * salvo, SEM marcar falha — uma nova chamada (manual por enquanto;
 * futuramente pelo endpoint do scheduler, etapa própria) retoma o polling
 * de onde parou, sem criar um segundo container. Lock/idempotência formais
 * contra chamadas concorrentes ficam para a etapa do scheduler.
 */

export class InstagramPublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstagramPublishError";
  }
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 12; // ~24s de espera limitada dentro desta chamada

// Limites de um carrossel — os mesmos usados na criação (instagram-post-service.ts):
// mantidos aqui também porque um post pode, em teoria, ter sido criado antes de uma
// mudança futura nesses limites; a publicação sempre revalida por conta própria.
const MIN_CAROUSEL_ITEMS = 2;
const MAX_CAROUSEL_ITEMS = 10;

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

/**
 * Consulta o status de um container (imagem única ou o container PAI de
 * um carrossel — nunca um container de item, que nunca é publicado
 * individualmente) até FINISHED, publica, e registra o resultado.
 * Compartilhado por publishImagePost e publishCarouselPost — a única
 * diferença entre os dois é como o `containerId` foi criado antes de
 * chegar aqui.
 */
async function pollAndPublishContainer(
  postId: string,
  igUserId: string,
  accessToken: string,
  containerId: string,
): Promise<PublishImagePostResult> {
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
        const mediaId = await publishMediaContainer({ igUserId, accessToken, containerId });
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

/** Valida o que é comum a imagem única e carrossel antes de publicar: post existe, tipo bate, e o status atual permite publicar (ou já está PUBLISHED, idempotente). Retorna `null` quando já deve devolver PUBLISHED sem fazer mais nada. */
function assertPublishable(post: PostForPublish, expectedType: "image" | "carousel"): "PUBLISHED" | null {
  if (post.postType !== expectedType) {
    throw new InstagramPublishError(
      "Este post não é do tipo esperado para esta publicação — use a rota de publicação correspondente ao tipo.",
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
  return null;
}

/** Publica um post de imagem única já existente. */
export async function publishImagePost(postId: string, userId: string): Promise<PublishImagePostResult> {
  const post = await getPostForPublish(postId, userId);
  if (!post) {
    throw new InstagramPublishError("Post não encontrado.");
  }
  const idempotent = assertPublishable(post, "image");
  if (idempotent) return idempotent;

  const item = post.items[0];
  if (!item || item.mediaType !== "image") {
    throw new InstagramPublishError("A mídia associada a este post não é uma imagem.");
  }

  const accessToken = decryptSecret(post.accessTokenEncrypted);

  let containerId = post.metaContainerId;
  if (!containerId) {
    try {
      containerId = await createImageMediaContainer({
        igUserId: post.igUserId,
        accessToken,
        imageUrl: item.storageUrl,
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

  return pollAndPublishContainer(postId, post.igUserId, accessToken, containerId);
}

/**
 * Publica um post de carrossel já existente (2 a 10 imagens). Fluxo da
 * Content Publishing API (confirmado na documentação oficial da Meta,
 * consultada em 22/09/2026, antes de implementar): cria um container de
 * item por imagem (`is_carousel_item=true`, sem legenda), depois o
 * container PAI (`media_type=CAROUSEL`, `children` com os ids dos itens
 * na ordem certa, com a legenda), aguarda esse container PAI chegar a
 * FINISHED e só então publica — nunca publica um item individualmente.
 */
export async function publishCarouselPost(postId: string, userId: string): Promise<PublishImagePostResult> {
  const post = await getPostForPublish(postId, userId);
  if (!post) {
    throw new InstagramPublishError("Post não encontrado.");
  }
  const idempotent = assertPublishable(post, "carousel");
  if (idempotent) return idempotent;

  if (post.items.length < MIN_CAROUSEL_ITEMS || post.items.length > MAX_CAROUSEL_ITEMS) {
    throw new InstagramPublishError(
      `Um carrossel precisa ter entre ${MIN_CAROUSEL_ITEMS} e ${MAX_CAROUSEL_ITEMS} imagens (este tem ${post.items.length}).`,
    );
  }
  if (post.items.some((item) => item.mediaType !== "image")) {
    throw new InstagramPublishError("Esta etapa só publica carrosséis de imagem (vídeo/Reels vêm depois).");
  }

  const accessToken = decryptSecret(post.accessTokenEncrypted);

  let containerId = post.metaContainerId;
  if (!containerId) {
    // Cria os containers-filho em sequência (nunca em paralelo — mesma
    // cautela já usada na exportação do carrossel no navegador: evita
    // várias requisições simultâneas à Meta para o mesmo usuário). Se um
    // item falhar no meio, nenhum id de filho fica salvo no banco
    // (instagram_post_items não guarda isso, só o container PAI é salvo,
    // via markPostProcessing abaixo) — uma nova tentativa simplesmente
    // recria todos os containers-filho do zero; containers não publicados
    // expiram sozinhos na Meta depois de um tempo, sem custo nem post
    // duplicado, então isso é seguro para o baixo volume de um usuário.
    const childContainerIds: string[] = [];
    try {
      for (const item of post.items) {
        const childId = await createCarouselItemContainer({
          igUserId: post.igUserId,
          accessToken,
          imageUrl: item.storageUrl,
        });
        childContainerIds.push(childId);
      }
    } catch (error) {
      logPublishError("falha ao criar um dos containers de item do carrossel", error);
      const message = sanitizeErrorForStorage(error);
      await markPostFailed(postId, message);
      await recordPublishAttempt({ postId, outcome: "failure", errorSanitized: message });
      throw new InstagramPublishError("Falha ao preparar uma das imagens do carrossel no Instagram.");
    }

    try {
      containerId = await createCarouselContainer({
        igUserId: post.igUserId,
        accessToken,
        childrenContainerIds: childContainerIds,
        caption: post.caption,
      });
    } catch (error) {
      logPublishError("falha ao criar o container do carrossel", error);
      const message = sanitizeErrorForStorage(error);
      await markPostFailed(postId, message);
      await recordPublishAttempt({ postId, outcome: "failure", errorSanitized: message });
      throw new InstagramPublishError("Falha ao criar o container do carrossel no Instagram.");
    }
    await markPostProcessing(postId, containerId);
  }

  return pollAndPublishContainer(postId, post.igUserId, accessToken, containerId);
}

/**
 * Ponto único chamado pela rota de publicação (POST
 * .../posts/[id]/publish) — despacha para publishImagePost ou
 * publishCarouselPost conforme o tipo do post, para a rota não precisar
 * conhecer os tipos suportados. Um segundo `getPostForPublish` acontece
 * dentro da função escolhida (custo desprezível, uma consulta simples) —
 * preferido a reestruturar as duas funções para aceitar um post já
 * carregado, o que acoplaria demais suas assinaturas por uma otimização
 * que não importa neste volume.
 */
export async function publishPost(postId: string, userId: string): Promise<PublishImagePostResult> {
  const post = await getPostForPublish(postId, userId);
  if (!post) {
    throw new InstagramPublishError("Post não encontrado.");
  }
  switch (post.postType) {
    case "image":
      return publishImagePost(postId, userId);
    case "carousel":
      return publishCarouselPost(postId, userId);
    default:
      throw new InstagramPublishError(
        "Tipo de post ainda não suportado para publicação (Reels vem em etapa futura).",
      );
  }
}
