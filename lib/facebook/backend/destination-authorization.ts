import "server-only";
import { getDb } from "@/lib/db/client";
import { getFacebookPageForUser, listFacebookPagesForUser, type FacebookPageRecord } from "@/lib/facebook/backend/facebook-page-repository";
import {
  getDestinationProfile,
  listDestinationProfiles,
  upsertDestinationProfile,
  type DestinationProfileRecord,
} from "@/lib/facebook/backend/destination-profile-repository";
import {
  evaluateFacebookDestination,
  type DenyReason,
  type DestinationSelectionSource,
  type PolicyDecision,
  type ProfileUpdateInput,
} from "@/lib/facebook/destination-policy";
import { getInstagramAccountByIdForUser, listInstagramAccountsForUser } from "@/lib/instagram/backend/instagram-account-repository";
import { logPublicationEvent } from "@/lib/instagram/backend/publication-log";

/**
 * Autorização de destinos Facebook no SERVIDOR (o frontend nunca decide).
 * Ver as regras em lib/facebook/destination-policy.ts.
 */

export class DestinationAuthorizationError extends Error {
  constructor(message: string, readonly reason: DenyReason | "post_not_found" | "account_not_found") {
    super(message);
    this.name = "DestinationAuthorizationError";
  }
}

function toPolicyPage(page: FacebookPageRecord | null) {
  return page
    ? { id: page.id, userId: page.userId, pageId: page.pageId, status: page.status, hasToken: page.hasToken, instagramAccountId: page.instagramAccountId }
    : null;
}

export async function getPostInstagramAccountId(postId: string, userId: string): Promise<string | null> {
  const db = getDb();
  const rows = await db`select instagram_account_id from instagram_posts where id = ${postId} and user_id = ${userId}`;
  return rows[0] ? (rows[0].instagram_account_id as string) : null;
}

export interface AuthorizedPage {
  facebookPageRef: string;
  pageId: string;
  pageName: string;
}

/**
 * Confere CADA Página pedida para uma conta Instagram. Lança na primeira
 * negada (fluxos interativos: a pessoa vê o motivo). Nunca substitui uma
 * Página por outra.
 */
export async function authorizeFacebookPagesForAccount(input: {
  userId: string;
  instagramAccountId: string;
  pageRefs: string[];
  source: DestinationSelectionSource;
  publicationId?: string;
}): Promise<AuthorizedPage[]> {
  const profile = await getDestinationProfile(input.userId, input.instagramAccountId);
  const pages: AuthorizedPage[] = [];
  for (const ref of [...new Set(input.pageRefs)]) {
    const page = await getFacebookPageForUser(ref, input.userId);
    const decision = evaluateFacebookDestination({
      userId: input.userId,
      instagramAccountId: input.instagramAccountId,
      page: toPolicyPage(page),
      requestedPageRef: ref,
      profile,
      source: input.source,
      requireConnected: true,
    });
    if (!decision.allowed) {
      logPublicationEvent({
        event: "facebook.destination.rejected",
        platform: "facebook",
        publicationId: input.publicationId,
        instagramAccountId: input.instagramAccountId,
        facebookPageRef: ref,
        selectionSource: input.source,
        errorKind: decision.reason,
        status: "BLOCKED",
      });
      throw new DestinationAuthorizationError(page && decision.reason === "page_not_connected" ? `A Página "${page.pageName}" precisa ser reconectada antes de agendar.` : decision.message, decision.reason);
    }
    pages.push({ facebookPageRef: page!.id, pageId: page!.pageId, pageName: page!.pageName });
  }
  return pages;
}

/** Variante não interativa (Piloto/filas): devolve só as Páginas permitidas e registra as negadas. */
export async function filterAuthorizedFacebookPages(input: {
  userId: string;
  instagramAccountId: string;
  pageRefs: string[];
  source: DestinationSelectionSource;
  publicationId?: string;
}): Promise<{ pages: AuthorizedPage[]; rejected: Array<{ pageRef: string; reason: DenyReason }> }> {
  const profile = await getDestinationProfile(input.userId, input.instagramAccountId);
  const pages: AuthorizedPage[] = [];
  const rejected: Array<{ pageRef: string; reason: DenyReason }> = [];
  for (const ref of [...new Set(input.pageRefs)]) {
    const page = await getFacebookPageForUser(ref, input.userId);
    const decision = evaluateFacebookDestination({
      userId: input.userId,
      instagramAccountId: input.instagramAccountId,
      page: toPolicyPage(page),
      requestedPageRef: ref,
      profile,
      source: input.source,
      requireConnected: true,
    });
    if (decision.allowed) {
      pages.push({ facebookPageRef: page!.id, pageId: page!.pageId, pageName: page!.pageName });
    } else {
      rejected.push({ pageRef: ref, reason: decision.reason });
      logPublicationEvent({
        event: "facebook.destination.rejected",
        platform: "facebook",
        publicationId: input.publicationId,
        instagramAccountId: input.instagramAccountId,
        facebookPageRef: ref,
        selectionSource: input.source,
        errorKind: decision.reason,
        status: "BLOCKED",
      });
    }
  }
  return { pages, rejected };
}

export interface PublishTimeContext {
  destinationId: string;
  userId: string;
  postId: string;
  instagramAccountId: string;
  facebookPageRef: string | null;
  externalAccountId: string;
  selectionSource: DestinationSelectionSource;
}

/** Tudo que a checagem pré-publicação precisa, numa consulta (sem token). */
export async function loadPublishTimeContext(destinationId: string, userId: string): Promise<PublishTimeContext | null> {
  const db = getDb();
  const rows = await db`
    select d.id, d.user_id, d.post_id, d.facebook_page_ref, d.external_account_id, d.selection_source, p.instagram_account_id
    from social_publication_destinations d
    join instagram_posts p on p.id = d.post_id and p.user_id = d.user_id
    where d.id = ${destinationId} and d.user_id = ${userId}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    destinationId: row.id as string,
    userId: row.user_id as string,
    postId: row.post_id as string,
    instagramAccountId: row.instagram_account_id as string,
    facebookPageRef: (row.facebook_page_ref as string | null) ?? null,
    externalAccountId: row.external_account_id as string,
    selectionSource: ((row.selection_source as string | null) ?? "legacy") as DestinationSelectionSource,
  };
}

/**
 * Revalidação IMEDIATAMENTE antes da API do Facebook. Não exige Página
 * conectada (token expirado é tratado pelo fluxo de reconexão, sem nunca
 * usar outra Página), mas exige que o destino continue autorizado.
 */
export async function authorizeAtPublishTime(ctx: PublishTimeContext): Promise<PolicyDecision> {
  if (!ctx.facebookPageRef) {
    // Página apagada: o fluxo existente marca "desconectada" sem chamar a Meta.
    return { allowed: true };
  }
  const [page, profile] = await Promise.all([
    getFacebookPageForUser(ctx.facebookPageRef, ctx.userId),
    getDestinationProfile(ctx.userId, ctx.instagramAccountId),
  ]);
  if (!page) return { allowed: true }; // idem: sem Página, sem token, sem chamada.
  return evaluateFacebookDestination({
    userId: ctx.userId,
    instagramAccountId: ctx.instagramAccountId,
    page: toPolicyPage(page),
    requestedPageRef: ctx.facebookPageRef,
    externalAccountId: ctx.externalAccountId,
    profile,
    source: ctx.selectionSource,
    requireConnected: false,
  });
}

// ───────────────────── Perfis (configuração por categoria) ─────────────────────

export interface DestinationProfilesOverview {
  accounts: Array<{
    id: string;
    username: string | null;
    status: string;
    profile: DestinationProfileRecord | null;
  }>;
  pages: Array<{ id: string; pageName: string; pageId: string; status: string; instagramAccountId: string | null; linkedIgUsername: string | null }>;
  /** Conta "principal" (onde as telas manuais publicam). */
  primaryInstagramAccountId: string | null;
}

export async function getDestinationProfilesOverview(userId: string, primaryInstagramAccountId: string | null): Promise<DestinationProfilesOverview> {
  const [accounts, profiles, pages] = await Promise.all([
    listInstagramAccountsForUser(userId),
    listDestinationProfiles(userId),
    listFacebookPagesForUser(userId),
  ]);
  return {
    accounts: accounts.map((account) => ({
      id: account.id,
      username: account.igUsername,
      status: account.status,
      profile: profiles.find((profile) => profile.instagramAccountId === account.id) ?? null,
    })),
    pages: pages.map((page) => ({
      id: page.id,
      pageName: page.pageName,
      pageId: page.pageId,
      status: page.status,
      instagramAccountId: page.instagramAccountId,
      linkedIgUsername: page.linkedIgUsername,
    })),
    primaryInstagramAccountId,
  };
}

export async function saveDestinationProfile(userId: string, instagramAccountId: string, input: ProfileUpdateInput): Promise<DestinationProfileRecord> {
  const account = await getInstagramAccountByIdForUser(instagramAccountId, userId);
  if (!account) throw new DestinationAuthorizationError("Conta do Instagram não encontrada.", "account_not_found");
  for (const ref of input.allowedFacebookPageRefs) {
    const page = await getFacebookPageForUser(ref, userId);
    if (!page || page.userId !== userId) throw new DestinationAuthorizationError("A Página do Facebook escolhida não foi encontrada na sua conta.", "page_not_found");
  }
  const saved = await upsertDestinationProfile(userId, instagramAccountId, input);
  logPublicationEvent({
    event: "facebook.destination.profile_saved",
    platform: "facebook",
    instagramAccountId,
    status: input.facebookEnabled ? "ENABLED" : "DISABLED",
    claimed: input.allowedFacebookPageRefs.length,
  });
  return saved;
}
