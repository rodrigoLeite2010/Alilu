/**
 * Regra ÚNICA de autorização de destinos Facebook (pura, sem banco).
 *
 * Usada em dois momentos:
 *   1. ao GRAVAR o destino (tela manual, Piloto Automático, filas);
 *   2. imediatamente ANTES de chamar a API do Facebook (cron, "Publicar
 *      agora", "Tentar novamente") — os destinos persistidos são
 *      revalidados; nada é inferido no meio do caminho.
 *
 * Princípios:
 *   - Só publica onde houve escolha explícita. A existência de uma Página
 *     conectada, do token Meta ou do vínculo Instagram↔Página NÃO autoriza nada.
 *   - Perfil da conta Instagram ("categoria") com Facebook desativado →
 *     nenhuma Página, em nenhum fluxo.
 *   - Perfil com Facebook ativo → somente as Páginas permitidas, por ID.
 *   - Sem perfil (contas ainda não configuradas) → vale a escolha explícita
 *     da publicação, exceto Páginas vinculadas a OUTRA conta Instagram do
 *     usuário (ex.: Página Alilu numa publicação do GTA 6) e destinos
 *     criados pelo antigo modo "Automático".
 *   - Nunca há fallback: um destino negado não é trocado por outro.
 */

export type DestinationSelectionSource = "manual" | "automation" | "video_queue" | "legacy" | "automation_auto_legacy";

export interface DestinationProfilePolicy {
  instagramAccountId: string;
  facebookEnabled: boolean;
  allowedFacebookPageRefs: string[];
  defaultFacebookPageRefs: string[];
}

export interface PolicyPage {
  /** facebook_pages.id */
  id: string;
  userId: string;
  /** Id da Página na Meta. */
  pageId: string;
  status: "connected" | "needs_reconnect" | "revoked";
  hasToken: boolean;
  /** Conta Instagram do usuário vinculada a esta Página (informativo, vindo da Meta). */
  instagramAccountId: string | null;
}

export interface PolicyInput {
  userId: string;
  /** Conta Instagram da publicação (instagram_posts.instagram_account_id). */
  instagramAccountId: string;
  /** null = a Página não existe mais / não é do usuário. */
  page: PolicyPage | null;
  /** Página pedida (facebook_pages.id) e o id externo gravado no destino, se já existir. */
  requestedPageRef: string | null;
  externalAccountId?: string | null;
  profile: DestinationProfilePolicy | null;
  source: DestinationSelectionSource;
  /** Na publicação, uma Página "precisa reconectar" é tratada pelo fluxo de erro de token, não aqui. */
  requireConnected?: boolean;
}

export type DenyReason =
  | "page_not_found"
  | "page_owner_mismatch"
  | "page_id_mismatch"
  | "page_not_connected"
  | "facebook_disabled_for_account"
  | "page_not_allowed_for_account"
  | "page_linked_to_other_account"
  | "implicit_selection";

export type PolicyDecision = { allowed: true } | { allowed: false; reason: DenyReason; message: string };

export const DENY_MESSAGES: Record<DenyReason, string> = {
  page_not_found: "A Página do Facebook escolhida não foi encontrada na sua conta.",
  page_owner_mismatch: "A Página do Facebook escolhida não pertence à sua conta.",
  page_id_mismatch: "O destino Facebook não corresponde à Página cadastrada. Escolha a Página novamente.",
  page_not_connected: "A Página do Facebook precisa ser reconectada antes de agendar.",
  facebook_disabled_for_account: "O Facebook está desativado para esta conta do Instagram. Nada foi enviado ao Facebook.",
  page_not_allowed_for_account: "Esta Página do Facebook não está autorizada para esta conta do Instagram.",
  page_linked_to_other_account: "Esta Página do Facebook pertence a outra conta do Instagram. Autorize-a nos destinos da conta antes de usar.",
  implicit_selection: "Destino Facebook criado sem escolha explícita (antigo modo Automático). Bloqueado: nada foi enviado ao Facebook.",
};

function deny(reason: DenyReason): PolicyDecision {
  return { allowed: false, reason, message: DENY_MESSAGES[reason] };
}

export function evaluateFacebookDestination(input: PolicyInput): PolicyDecision {
  const { page } = input;
  if (!page || (input.requestedPageRef && page.id !== input.requestedPageRef)) return deny("page_not_found");
  if (page.userId !== input.userId) return deny("page_owner_mismatch");
  if (input.externalAccountId && input.externalAccountId !== page.pageId) return deny("page_id_mismatch");
  if (input.requireConnected && (!page.hasToken || page.status !== "connected")) return deny("page_not_connected");

  const profile = input.profile && input.profile.instagramAccountId === input.instagramAccountId ? input.profile : null;
  if (profile) {
    if (!profile.facebookEnabled) return deny("facebook_disabled_for_account");
    if (!profile.allowedFacebookPageRefs.includes(page.id)) return deny("page_not_allowed_for_account");
    // Perfil explícito autoriza inclusive destinos legados do modo Automático.
    return { allowed: true };
  }

  if (input.source === "automation_auto_legacy") return deny("implicit_selection");
  if (page.instagramAccountId && page.instagramAccountId !== input.instagramAccountId) return deny("page_linked_to_other_account");
  return { allowed: true };
}

/** Páginas que a tela pode oferecer para uma conta (perfil restringe; sem perfil, oculta as de outras contas). */
export function selectablePagesFor<T extends { id: string; instagramAccountId?: string | null }>(
  pages: T[],
  instagramAccountId: string | null,
  profile: DestinationProfilePolicy | null,
): T[] {
  if (profile) return profile.facebookEnabled ? pages.filter((page) => profile.allowedFacebookPageRefs.includes(page.id)) : [];
  if (!instagramAccountId) return pages;
  return pages.filter((page) => !page.instagramAccountId || page.instagramAccountId === instagramAccountId);
}

/** Sugestão inicial editável: somente os padrões do perfil — nunca "a única/primeira Página conectada". */
export function initialFacebookSelection(profile: DestinationProfilePolicy | null, connectedPageRefs: string[]): string[] {
  if (!profile || !profile.facebookEnabled) return [];
  return profile.defaultFacebookPageRefs.filter(
    (id) => profile.allowedFacebookPageRefs.includes(id) && connectedPageRefs.includes(id),
  );
}

export interface ProfileUpdateInput {
  label: string | null;
  facebookEnabled: boolean;
  allowedFacebookPageRefs: string[];
  defaultFacebookPageRefs: string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lê/valida o corpo de "salvar destinos da conta". */
export function readProfileUpdate(raw: unknown): { value: ProfileUpdateInput } | { error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: "Corpo inválido." };
  const body = raw as Record<string, unknown>;
  if (typeof body.facebookEnabled !== "boolean") return { error: "facebookEnabled precisa ser verdadeiro ou falso." };
  const list = (value: unknown): string[] | null =>
    value === undefined ? [] : Array.isArray(value) && value.every((id) => typeof id === "string" && UUID.test(id)) ? [...new Set(value as string[])] : null;
  const allowed = list(body.allowedFacebookPageRefs);
  const defaults = list(body.defaultFacebookPageRefs);
  if (!allowed || !defaults) return { error: "Lista de Páginas inválida." };
  if (allowed.length > 5) return { error: "Autorize no máximo 5 Páginas por conta." };
  if (body.facebookEnabled && allowed.length === 0) return { error: "Escolha a Página do Facebook autorizada ou desative o Facebook para esta conta." };
  if (defaults.some((id) => !allowed.includes(id))) return { error: "A Página padrão precisa estar entre as Páginas autorizadas." };
  if (body.label !== undefined && body.label !== null && typeof body.label !== "string") return { error: "Nome da categoria inválido." };
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 80) : null;
  return {
    value: {
      label,
      facebookEnabled: body.facebookEnabled,
      // Facebook desativado: nada fica autorizado (evita reativação acidental).
      allowedFacebookPageRefs: body.facebookEnabled ? allowed : [],
      defaultFacebookPageRefs: body.facebookEnabled ? defaults : [],
    },
  };
}
