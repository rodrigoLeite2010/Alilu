import "server-only";
import {
  getFacebookPageForUser,
  listConnectedPagesForInstagramAccount,
  type FacebookPageRecord,
} from "@/lib/facebook/backend/facebook-page-repository";
import { getPostDetailsForUser } from "@/lib/instagram/backend/instagram-post-repository";
import { logPublicationEvent } from "@/lib/instagram/backend/publication-log";
import {
  addFacebookDestinationsIfMissing,
  cancelFacebookDestinations,
  listDestinationsForPost,
  listDestinationsForUser,
  resetFacebookDestinationsAfterEdit,
  setFacebookDestinations,
  type DestinationSummary,
  type FacebookDestinationInput,
} from "@/lib/facebook/backend/social-destination-repository";
import { FACEBOOK_CAPTION_MAX_LENGTH, facebookSupportFor, type FacebookPostKind } from "@/lib/facebook/facebook-media-rules";
import { needsPageReconnect } from "@/lib/facebook/backend/facebook-publish-errors";
import type { PublicationDestinationView } from "@/lib/facebook/destination-view";

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

export async function applyFacebookDestinations(postId: string, userId: string, request: SocialDestinationsRequest): Promise<void> {
  const pages = await resolveFacebookPages(userId, request.facebookPageIds);
  await setFacebookDestinations(postId, userId, pages, request.facebookCaption);
}

export { cancelFacebookDestinations, resetFacebookDestinationsAfterEdit };

export interface AutomaticFacebookDestinationsInput {
  postId: string;
  userId: string;
  /** Conta Instagram de destino da publicação (modo automático usa as Páginas vinculadas a ela). */
  instagramAccountId: string;
  /**
   * Configuração de destino Facebook da automação:
   *   null  = automático (Páginas conectadas vinculadas à conta Instagram);
   *   []    = não publicar no Facebook;
   *   [ids] = estas Páginas (facebook_pages.id).
   */
  facebookPageIds: string[] | null;
}

export interface AutomaticFacebookDestinationsResult {
  /** Destinos efetivamente criados agora (0 em retry: já existiam). */
  created: number;
  /** Por que nada foi criado (para log/diagnóstico). */
  skipped?: "disabled" | "no_pages" | "unsupported" | "post_not_found";
}

function usablePage(page: FacebookPageRecord | null, userId: string): page is FacebookPageRecord {
  return Boolean(page && page.userId === userId && page.hasToken && page.status === "connected");
}

/**
 * Publicações AUTOMÁTICAS (Piloto Automático): grava os destinos Facebook
 * conforme a configuração da automação, no momento em que a publicação é
 * criada. A partir daí o MESMO agendador e a MESMA camada de publicação do
 * Facebook usados por "Publicar agora" (publishFacebookDestination) cuidam
 * do resto — não existe um segundo caminho de publicação.
 *
 * - Respeita o formato: Story (e carrossel com vídeo) não vão ao Facebook.
 * - Idempotente: rodar de novo para a mesma publicação nunca duplica destino.
 * - Página desconectada/sem token é ignorada (o Instagram segue normalmente).
 */
export async function attachAutomaticFacebookDestinations(
  input: AutomaticFacebookDestinationsInput,
): Promise<AutomaticFacebookDestinationsResult> {
  if (Array.isArray(input.facebookPageIds) && input.facebookPageIds.length === 0) return { created: 0, skipped: "disabled" };

  const pages: FacebookPageRecord[] = [];
  if (input.facebookPageIds === null) {
    pages.push(...(await listConnectedPagesForInstagramAccount(input.userId, input.instagramAccountId)));
  } else {
    for (const id of [...new Set(input.facebookPageIds)]) {
      const page = await getFacebookPageForUser(id, input.userId);
      if (usablePage(page, input.userId)) pages.push(page);
      else logPublicationEvent({ event: "facebook.automation.page_unavailable", platform: "facebook", publicationId: input.postId, status: "SKIPPED" });
    }
  }
  if (pages.length === 0) return { created: 0, skipped: "no_pages" };

  const details = await getPostDetailsForUser(input.postId, input.userId);
  if (!details) return { created: 0, skipped: "post_not_found" };
  const support = facebookSupportFor(details.postType, details.items.some((item) => item.mediaType === "video"));
  if (!support.supported) return { created: 0, skipped: "unsupported" };

  const created = await addFacebookDestinationsIfMissing(
    input.postId,
    input.userId,
    pages.map((page) => ({ facebookPageRef: page.id, pageId: page.pageId, pageName: page.pageName })),
  );
  logPublicationEvent({ event: "facebook.automation.destinations", platform: "facebook", publicationId: input.postId, claimed: created });
  return { created };
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
