import "server-only";
import { getFacebookPageForUser } from "@/lib/facebook/backend/facebook-page-repository";
import {
  DestinationAuthorizationError,
  authorizeFacebookPagesForAccount,
  filterAuthorizedFacebookPages,
  getPostInstagramAccountId,
} from "@/lib/facebook/backend/destination-authorization";
import { getPostDetailsForUser } from "@/lib/instagram/backend/instagram-post-repository";
import { logPublicationEvent } from "@/lib/instagram/backend/publication-log";
import {
  addFacebookDestinationsIfMissing,
  cancelFacebookDestinations,
  listDestinationsForPost,
  listDestinationsForUser,
  resetFacebookDestinationsAfterEdit,
  setFacebookDestinations,
  UNAUTHORIZED_DESTINATION_REASON,
  type DestinationSummary,
  type FacebookDestinationInput,
} from "@/lib/facebook/backend/social-destination-repository";
import { FACEBOOK_CAPTION_MAX_LENGTH, facebookSupportFor, type FacebookPostKind } from "@/lib/facebook/facebook-media-rules";
import { needsPageReconnect } from "@/lib/facebook/backend/facebook-publish-errors";
import type { PublicationDestinationView } from "@/lib/facebook/destination-view";
import { DENY_MESSAGES } from "@/lib/facebook/destination-policy";
import { isInstagramRadarPost } from "@/lib/instagram-radar/backend/radar-repository";

export type { PublicationDestinationView };

/**
 * Regras de "Publicar nas redes sociais" (Instagram / Facebook) de uma
 * publicação: leitura do corpo da requisição, validação de posse das
 * Páginas e gravação dos destinos.
 */

export class SocialDestinationsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SocialDestinationsError";
  }
}

export interface SocialDestinationsRequest {
  instagram: boolean;
  /** ids internos (facebook_pages.id) das Páginas escolhidas. */
  facebookPageIds: string[];
  /** Legenda específica do Facebook; vazia/null = usa a legenda principal. */
  facebookCaption: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lê `destinations` do corpo. Ausente = comportamento histórico (só
 * Instagram) — telas e integrações antigas continuam iguais.
 */
export function readSocialDestinations(raw: unknown): { value: SocialDestinationsRequest | null } | { error: string } {
  if (raw === undefined || raw === null) return { value: null };
  if (typeof raw !== "object" || Array.isArray(raw)) return { error: "destinations inválido." };
  const { instagram, facebookPageIds, facebookCaption } = raw as Record<string, unknown>;
  if (instagram !== undefined && typeof instagram !== "boolean") return { error: "destinations.instagram precisa ser verdadeiro ou falso." };
  if (facebookPageIds !== undefined && (!Array.isArray(facebookPageIds) || facebookPageIds.some((id) => typeof id !== "string" || !UUID.test(id)))) {
    return { error: "destinations.facebookPageIds inválido." };
  }
  if (facebookCaption !== undefined && facebookCaption !== null && typeof facebookCaption !== "string") {
    return { error: "A legenda do Facebook precisa ser um texto." };
  }
  if (typeof facebookCaption === "string" && facebookCaption.length > FACEBOOK_CAPTION_MAX_LENGTH) {
    return { error: `A legenda do Facebook pode ter no máximo ${FACEBOOK_CAPTION_MAX_LENGTH} caracteres.` };
  }
  const pageIds = [...new Set((facebookPageIds as string[] | undefined) ?? [])];
  const value: SocialDestinationsRequest = {
    instagram: instagram !== false,
    facebookPageIds: pageIds,
    facebookCaption: typeof facebookCaption === "string" && facebookCaption.trim() ? facebookCaption : null,
  };
  if (!value.instagram && value.facebookPageIds.length === 0) {
    return { error: "Escolha pelo menos uma rede social para publicar." };
  }
  if (pageIds.length > 5) return { error: "Escolha no máximo 5 Páginas do Facebook por publicação." };
  return { value };
}

/** Confere que cada Página é do usuário e está conectada; devolve os dados para gravar o destino. */
export async function resolveFacebookPages(userId: string, pageIds: string[]): Promise<FacebookDestinationInput[]> {
  const pages: FacebookDestinationInput[] = [];
  for (const id of pageIds) {
    const page = await getFacebookPageForUser(id, userId);
    if (!page) throw new SocialDestinationsError("A Página do Facebook escolhida não foi encontrada na sua conta.");
    if (!page.hasToken || page.status !== "connected") {
      throw new SocialDestinationsError(`A Página "${page.pageName}" precisa ser reconectada antes de agendar.`);
    }
    pages.push({ facebookPageRef: page.id, pageId: page.pageId, pageName: page.pageName });
  }
  return pages;
}

export function assertFacebookSupports(postType: FacebookPostKind, hasVideoItems: boolean): void {
  const support = facebookSupportFor(postType, hasVideoItems);
  if (!support.supported) throw new SocialDestinationsError(support.reason);
}

/** Validação prévia (sem gravar nada) das Páginas pedidas para uma publicação existente. */
export async function assertFacebookDestinationsAllowedForPost(postId: string, userId: string, pageIds: string[]): Promise<void> {
  if (pageIds.length === 0) return;
  if (await isInstagramRadarPost(postId)) throw new SocialDestinationsError(DENY_MESSAGES.instagram_radar_only);
  const instagramAccountId = await getPostInstagramAccountId(postId, userId);
  if (!instagramAccountId) throw new SocialDestinationsError("Publicação não encontrada.");
  try {
    await authorizeFacebookPagesForAccount({ userId, instagramAccountId, pageRefs: pageIds, source: "manual", publicationId: postId });
  } catch (error) {
    if (error instanceof DestinationAuthorizationError) throw new SocialDestinationsError(error.message);
    throw error;
  }
}

/**
 * Grava os destinos Facebook ESCOLHIDOS na publicação. Cada Página passa
 * pela autorização do servidor contra a conta Instagram DA PUBLICAÇÃO
 * (perfil de destinos / "categoria"); uma Página negada interrompe tudo
 * com a mensagem do motivo — nunca é trocada por outra. Lista vazia remove
 * os destinos ainda não enviados (somente Instagram).
 */
export async function applyFacebookDestinations(postId: string, userId: string, request: SocialDestinationsRequest): Promise<void> {
  let pages: FacebookDestinationInput[] = [];
  if (request.facebookPageIds.length > 0) {
    if (await isInstagramRadarPost(postId)) throw new SocialDestinationsError(DENY_MESSAGES.instagram_radar_only);
    const instagramAccountId = await getPostInstagramAccountId(postId, userId);
    if (!instagramAccountId) throw new SocialDestinationsError("Publicação não encontrada.");
    try {
      pages = await authorizeFacebookPagesForAccount({
        userId,
        instagramAccountId,
        pageRefs: request.facebookPageIds,
        source: "manual",
        publicationId: postId,
      });
    } catch (error) {
      if (error instanceof DestinationAuthorizationError) throw new SocialDestinationsError(error.message);
      throw error;
    }
  }
  await setFacebookDestinations(postId, userId, pages, request.facebookCaption, "manual");
  logPublicationEvent({
    event: "facebook.destinations.selected",
    platform: "facebook",
    publicationId: postId,
    selectionSource: "manual",
    claimed: pages.length,
    status: request.instagram ? "INSTAGRAM_ON" : "INSTAGRAM_OFF",
  });
}

export { cancelFacebookDestinations, resetFacebookDestinationsAfterEdit };

export interface AutomaticFacebookDestinationsInput {
  postId: string;
  userId: string;
  /** Conta Instagram de destino da publicação (a autorização é feita contra ela). */
  instagramAccountId: string;
  /**
   * Destino Facebook configurado na automação:
   *   null  = nada configurado → NÃO publica no Facebook (o antigo modo
   *           "Automático", que usava a Página vinculada ao Instagram, foi
   *           removido: vínculo não é autorização);
   *   []    = não publicar no Facebook;
   *   [ids] = exatamente estas Páginas (facebook_pages.id), se autorizadas.
   */
  facebookPageIds: string[] | null;
}

export interface AutomaticFacebookDestinationsResult {
  /** Destinos efetivamente criados agora (0 em retry: já existiam). */
  created: number;
  /** Por que nada foi criado (para log/diagnóstico). */
  skipped?: "disabled" | "not_configured" | "no_pages" | "unsupported" | "post_not_found";
  /** Páginas configuradas mas negadas pela autorização (nunca substituídas). */
  rejected?: number;
}

/**
 * Publicações AUTOMÁTICAS (Piloto Automático): grava SOMENTE as Páginas
 * escolhidas explicitamente na automação e autorizadas para a conta
 * Instagram. A partir daí o MESMO agendador e a MESMA camada de publicação
 * (publishFacebookDestination) cuidam do resto.
 *
 * - Respeita o formato: Story (e carrossel com vídeo) não vão ao Facebook.
 * - Idempotente: rodar de novo para a mesma publicação nunca duplica destino.
 * - Página desconectada/negada é ignorada e registrada (o Instagram segue).
 */
export async function attachAutomaticFacebookDestinations(
  input: AutomaticFacebookDestinationsInput,
): Promise<AutomaticFacebookDestinationsResult> {
  if (input.facebookPageIds === null) {
    logPublicationEvent({ event: "facebook.automation.not_configured", platform: "facebook", publicationId: input.postId, instagramAccountId: input.instagramAccountId, status: "SKIPPED" });
    return { created: 0, skipped: "not_configured" };
  }
  if (input.facebookPageIds.length === 0) return { created: 0, skipped: "disabled" };

  const { pages, rejected } = await filterAuthorizedFacebookPages({
    userId: input.userId,
    instagramAccountId: input.instagramAccountId,
    pageRefs: input.facebookPageIds,
    source: "automation",
    publicationId: input.postId,
  });
  if (pages.length === 0) return { created: 0, skipped: "no_pages", rejected: rejected.length };

  const details = await getPostDetailsForUser(input.postId, input.userId);
  if (!details) return { created: 0, skipped: "post_not_found" };
  const support = facebookSupportFor(details.postType, details.items.some((item) => item.mediaType === "video"));
  if (!support.supported) return { created: 0, skipped: "unsupported" };

  const created = await addFacebookDestinationsIfMissing(input.postId, input.userId, pages, null, "automation");
  logPublicationEvent({
    event: "facebook.automation.destinations",
    platform: "facebook",
    publicationId: input.postId,
    instagramAccountId: input.instagramAccountId,
    selectionSource: "automation",
    claimed: created,
  });
  return { created, rejected: rejected.length };
}

export function toDestinationView(row: DestinationSummary): PublicationDestinationView {
  return {
    id: row.id,
    platform: row.platform,
    accountName: row.accountName,
    status: row.status,
    externalUrl: row.externalPublicationUrl,
    publishedAt: row.publishedAt,
    nextAttemptAt: row.nextAttemptAt,
    attemptsCount: row.attemptsCount,
    error: row.lastErrorSanitized,
    needsReconnect: needsPageReconnect(row.lastErrorReason),
    captionOverride: row.captionOverride,
    facebookPageRef: row.facebookPageRef,
    blocked: row.status === "CANCELLED" && row.lastErrorReason === UNAUTHORIZED_DESTINATION_REASON,
  };
}

export async function destinationViewsByPost(userId: string): Promise<Map<string, PublicationDestinationView[]>> {
  const rows = await listDestinationsForUser(userId).catch(() => []);
  const map = new Map<string, PublicationDestinationView[]>();
  for (const row of rows) {
    const list = map.get(row.postId) ?? [];
    list.push(toDestinationView(row));
    map.set(row.postId, list);
  }
  return map;
}

export async function destinationViewsForPost(postId: string, userId: string): Promise<PublicationDestinationView[]> {
  return (await listDestinationsForPost(postId, userId)).map(toDestinationView);
}
