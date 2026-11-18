"use client";

import { useEffect, useId, useRef, useState } from "react";
import { facebookSupportFor, FACEBOOK_CAPTION_MAX_LENGTH, type FacebookPostKind } from "@/lib/facebook/facebook-media-rules";
import {
  initialFacebookSelection,
  selectablePagesFor,
  type DestinationProfilePolicy,
} from "@/lib/facebook/destination-policy";

/**
 * "Publicar nas redes sociais": Instagram e/ou Página(s) do Facebook numa
 * ÚNICA publicação/agendamento. O valor vai para POST /api/instagram/posts
 * como `destinations`. Nenhum token passa pelo navegador — só os ids
 * internos das Páginas conectadas.
 */

export interface SocialDestinationsValue {
  instagram: boolean;
  facebook: boolean;
  facebookPageIds: string[];
  customFacebookCaption: boolean;
  facebookCaption: string;
}

export const DEFAULT_SOCIAL_DESTINATIONS: SocialDestinationsValue = {
  instagram: true,
  facebook: false,
  facebookPageIds: [],
  customFacebookCaption: false,
  facebookCaption: "",
};

export interface ConnectedFacebookPage {
  id: string;
  pageName: string;
  status: "connected" | "needs_reconnect" | "revoked";
  linkedIgUsername: string | null;
  /** Conta Instagram do usuário vinculada à Página (informativo). */
  instagramAccountId?: string | null;
}

/** Perfis de destino ("categorias") — GET /api/social/destination-profiles. */
export interface DestinationProfilesState {
  loaded: boolean;
  primaryInstagramAccountId: string | null;
  profiles: DestinationProfilePolicy[];
}

/** Corpo `destinations` para a API, ou um erro para mostrar na tela. */
export function buildDestinationsBody(value: SocialDestinationsValue):
  | { body: { instagram: boolean; facebookPageIds: string[]; facebookCaption: string | null } }
  | { error: string } {
  const facebookPageIds = value.facebook ? value.facebookPageIds : [];
  if (!value.instagram && facebookPageIds.length === 0) {
    return { error: value.facebook ? "Escolha a Página do Facebook onde publicar." : "Escolha pelo menos uma rede social para publicar." };
  }
  if (value.facebook && facebookPageIds.length === 0) return { error: "Escolha a Página do Facebook onde publicar." };
  return {
    body: {
      instagram: value.instagram,
      facebookPageIds,
      facebookCaption: value.facebook && value.customFacebookCaption && value.facebookCaption.trim() ? value.facebookCaption : null,
    },
  };
}

/**
 * Para CRIAR uma publicação: só envia `destinations` quando há algo além do
 * padrão (só Instagram) — o corpo das publicações "só Instagram" continua
 * idêntico ao de antes.
 */
export function isInstagramOnly(body: { instagram: boolean; facebookPageIds: string[] }): boolean {
  return body.instagram && body.facebookPageIds.length === 0;
}

/** Linhas de "Esta publicação será enviada para:" (o que o backend vai receber). */
export function destinationSummaryLines(
  value: SocialDestinationsValue,
  pages: ConnectedFacebookPage[],
  instagramLabel: string | null,
): { instagram: string; facebook: string } {
  const names = value.facebook ? pages.filter((page) => value.facebookPageIds.includes(page.id)).map((page) => page.pageName) : [];
  return {
    instagram: value.instagram ? (instagramLabel ?? "conta conectada") : "não selecionado",
    facebook: names.length ? names.join(", ") : "não selecionado",
  };
}

export function describeDestinations(value: SocialDestinationsValue, pages: ConnectedFacebookPage[], instagramLabel: string | null): string {
  const parts: string[] = [];
  if (value.instagram) parts.push(`Instagram${instagramLabel ? ` (${instagramLabel})` : ""}`);
  if (value.facebook) {
    const names = pages.filter((page) => value.facebookPageIds.includes(page.id)).map((page) => page.pageName);
    if (names.length) parts.push(`Facebook (${names.join(", ")})`);
  }
  return parts.join(" e ");
}

export function useFacebookPages(): { pages: ConnectedFacebookPage[]; loaded: boolean; configured: boolean } {
  const [state, setState] = useState<{ pages: ConnectedFacebookPage[]; loaded: boolean; configured: boolean }>({ pages: [], loaded: false, configured: false });
  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => fetch("/api/facebook/pages", { cache: "no-store" }))
      .then(async (response) => (response.ok ? ((await response.json()) as { pages?: ConnectedFacebookPage[]; configured?: boolean }) : null))
      .then((body) => {
        if (!cancelled) setState({ pages: body?.pages ?? [], loaded: true, configured: Boolean(body?.configured) });
      })
      .catch(() => {
        if (!cancelled) setState({ pages: [], loaded: true, configured: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

export function useDestinationProfiles(enabled = true): DestinationProfilesState {
  const [state, setState] = useState<DestinationProfilesState>({ loaded: false, primaryInstagramAccountId: null, profiles: [] });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    Promise.resolve()
      .then(() => fetch("/api/social/destination-profiles", { cache: "no-store" }))
      .then(async (response) =>
        response?.ok
          ? ((await response.json()) as { primaryInstagramAccountId?: string | null; accounts?: Array<{ profile: DestinationProfilePolicy | null }> })
          : null,
      )
      .then((body) => {
        if (cancelled) return;
        setState({
          loaded: true,
          primaryInstagramAccountId: body?.primaryInstagramAccountId ?? null,
          profiles: (body?.accounts ?? []).map((account) => account.profile).filter((profile): profile is DestinationProfilePolicy => Boolean(profile)),
        });
      })
      .catch(() => {
        if (!cancelled) setState({ loaded: true, primaryInstagramAccountId: null, profiles: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return state;
}

export function SocialDestinationsPicker({
  value,
  onChange,
  postType,
  hasVideoItems = false,
  instagramLabel,
  instagramAccountId,
  returnPath,
  disabled,
  pages: pagesProp,
  profiles: profilesProp,
  suggestDefaults = false,
  onConnect,
}: {
  value: SocialDestinationsValue;
  onChange: (value: SocialDestinationsValue) => void;
  postType: FacebookPostKind;
  hasVideoItems?: boolean;
  /** "@usuario" da conta do Instagram de destino. */
  instagramLabel: string | null;
  /** Conta Instagram de destino; ausente = conta principal (onde as telas manuais publicam). */
  instagramAccountId?: string | null;
  /** Para onde voltar depois de conectar a Página (rota /instagram/...). */
  returnPath: string;
  disabled?: boolean;
  /** Antes de sair para a Meta (ex.: guardar o rascunho local). Ausente = navegação normal. */
  onConnect?: (href: string) => void;
  /** Para testes / telas que já carregaram as Páginas. */
  pages?: { pages: ConnectedFacebookPage[]; loaded: boolean; configured: boolean };
  /** Para testes / telas que já carregaram os perfis de destino. */
  profiles?: DestinationProfilesState;
  /** Criação: aplica UMA vez os destinos padrão da conta como sugestão editável. */
  suggestDefaults?: boolean;
}) {
  const fetched = useFacebookPages();
  const fetchedProfiles = useDestinationProfiles(!profilesProp);
  const { pages, loaded, configured } = pagesProp ?? fetched;
  const profilesState = profilesProp ?? fetchedProfiles;
  const captionId = useId();
  const support = facebookSupportFor(postType, hasVideoItems);
  const accountId = instagramAccountId ?? profilesState.primaryInstagramAccountId;
  const profile = (accountId && profilesState.profiles.find((item) => item.instagramAccountId === accountId)) || null;
  const facebookDisabledForAccount = Boolean(profile && !profile.facebookEnabled);
  // Só Páginas permitidas para ESTA conta: o perfil restringe; sem perfil,
  // Páginas vinculadas a outra conta Instagram não aparecem.
  const selectable = selectablePagesFor(pages, accountId, profile);
  const connected = selectable.filter((page) => page.status === "connected");
  const needsReconnect = selectable.filter((page) => page.status === "needs_reconnect");
  const connectHref = `/api/facebook/pages/oauth/start?returnTo=${encodeURIComponent(returnPath)}`;
  const suggested = useRef(false);

  // Facebook desmarcado se o tipo deixou de ser suportado (ex.: virou carrossel com vídeo)
  // ou se a conta tem o Facebook desativado.
  useEffect(() => {
    if ((!support.supported || facebookDisabledForAccount) && value.facebook) {
      onChange({ ...value, facebook: false, facebookPageIds: [], instagram: true });
    }
  }, [support.supported, facebookDisabledForAccount, value, onChange]);

  // Páginas que deixaram de ser permitidas saem da seleção (nunca são trocadas por outras).
  useEffect(() => {
    if (!loaded || !profilesState.loaded || value.facebookPageIds.length === 0) return;
    const allowed = new Set(selectable.map((page) => page.id));
    const kept = value.facebookPageIds.filter((id) => allowed.has(id));
    if (kept.length !== value.facebookPageIds.length) onChange({ ...value, facebookPageIds: kept });
  }, [loaded, profilesState.loaded, selectable, value, onChange]);

  // Sugestão inicial editável = destinos PADRÃO da conta (nunca "a única/primeira Página").
  useEffect(() => {
    if (!suggestDefaults || suggested.current || !loaded || !profilesState.loaded) return;
    suggested.current = true;
    if (!support.supported || value.facebook || value.facebookPageIds.length > 0) return;
    const defaults = initialFacebookSelection(profile, connected.map((page) => page.id));
    if (defaults.length > 0) onChange({ ...value, facebook: true, facebookPageIds: defaults });
  }, [suggestDefaults, loaded, profilesState.loaded, support.supported, profile, connected, value, onChange]);

  function toggleFacebook(checked: boolean) {
    // Nunca escolhe uma Página sozinho: só os padrões configurados da conta.
    const preselect = checked && value.facebookPageIds.length === 0 ? initialFacebookSelection(profile, connected.map((page) => page.id)) : value.facebookPageIds;
    onChange({ ...value, facebook: checked, facebookPageIds: checked ? preselect : [] });
  }

  function togglePage(id: string, checked: boolean) {
    const next = checked ? [...new Set([...value.facebookPageIds, id])] : value.facebookPageIds.filter((item) => item !== id);
    onChange({ ...value, facebookPageIds: next });
  }

  const summary = destinationSummaryLines(value, connected, instagramLabel);

  return (
    <fieldset className="space-y-2 rounded-md border border-zinc-200 bg-white p-3" aria-label="Publicar nas redes sociais">
      <legend className="px-1 text-sm font-medium text-zinc-800">Publicar nas redes sociais</legend>

      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          className="h-4 w-4 accent-teal-700"
          checked={value.instagram}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, instagram: event.target.checked })}
        />
        Instagram{instagramLabel ? <span className="text-zinc-500">: {instagramLabel}</span> : null}
      </label>

      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          className="h-4 w-4 accent-blue-700"
          checked={value.facebook}
          disabled={disabled || !support.supported || facebookDisabledForAccount || (loaded && connected.length === 0)}
          onChange={(event) => toggleFacebook(event.target.checked)}
        />
        Facebook
      </label>

      {!support.supported ? <p className="text-xs text-amber-800">{support.reason}</p> : null}

      {support.supported && facebookDisabledForAccount ? (
        <p className="text-xs text-zinc-600">
          O Facebook está desativado para esta conta do Instagram. Para mudar, ajuste os destinos da conta em Páginas do Facebook.
        </p>
      ) : null}

      {support.supported && !facebookDisabledForAccount && loaded && connected.length === 0 ? (
        <p className="text-xs text-zinc-600">
          {!configured ? (
            "A publicação no Facebook ainda não está habilitada neste ambiente."
          ) : pages.length > 0 ? (
            "Nenhuma Página do Facebook está autorizada para esta conta do Instagram."
          ) : (
            <>
              Nenhuma Página do Facebook conectada.{" "}
              <a
                href={connectHref}
                onClick={(event) => {
                  if (!onConnect) return;
                  event.preventDefault();
                  onConnect(connectHref);
                }}
                className="font-medium text-blue-800 underline"
              >
                Conectar Página do Facebook
              </a>
            </>
          )}
        </p>
      ) : null}

      {needsReconnect.length > 0 && !facebookDisabledForAccount ? (
        <p className="text-xs text-amber-800">
          {needsReconnect.map((page) => page.pageName).join(", ")}: precisa reconectar.{" "}
          <a href={connectHref} className="font-medium underline">
            Reconectar Página
          </a>
        </p>
      ) : null}

      {value.facebook && connected.length > 0 ? (
        <div className="space-y-1 pl-6">
          <p className="text-xs text-zinc-600">Escolha a(s) Página(s):</p>
          {connected.map((page) => (
            <label key={page.id} className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-blue-700"
                checked={value.facebookPageIds.includes(page.id)}
                disabled={disabled}
                onChange={(event) => togglePage(page.id, event.target.checked)}
              />
              {page.pageName}
              {page.linkedIgUsername ? <span className="text-xs text-zinc-500">(vinculada a @{page.linkedIgUsername})</span> : null}
            </label>
          ))}
        </div>
      ) : null}

      {value.facebook ? (
        <div className="space-y-1 pl-6">
          <label className="flex items-center gap-2 text-xs text-zinc-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-blue-700"
              checked={value.customFacebookCaption}
              disabled={disabled}
              onChange={(event) => onChange({ ...value, customFacebookCaption: event.target.checked })}
            />
            Personalizar a legenda do Facebook
          </label>
          {value.customFacebookCaption ? (
            <>
              <label htmlFor={captionId} className="sr-only">
                Legenda do Facebook
              </label>
              <textarea
                id={captionId}
                value={value.facebookCaption}
                maxLength={FACEBOOK_CAPTION_MAX_LENGTH}
                disabled={disabled}
                rows={3}
                placeholder="Vazio = usa a mesma legenda do Instagram"
                onChange={(event) => onChange({ ...value, facebookCaption: event.target.value })}
                className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
              />
            </>
          ) : (
            <p className="text-xs text-zinc-500">Usa a mesma legenda do Instagram.</p>
          )}
          {postType === "reels" ? (
            <p className="text-xs text-zinc-500">
              Reels no Facebook: vertical 9:16, de 3 a 90 segundos. Áudio com direitos autorais pode ser bloqueado pelo Facebook.
            </p>
          ) : null}
          {postType === "carousel" ? (
            <p className="text-xs text-zinc-500">No Facebook vira um único post com várias fotos, na mesma ordem.</p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-md bg-zinc-50 px-2 py-1.5 text-xs text-zinc-700" aria-label="Destinos desta publicação">
        <p className="font-medium text-zinc-800">Esta publicação será enviada para:</p>
        <p>Instagram: {summary.instagram}</p>
        <p>Facebook: {summary.facebook}</p>
      </div>
    </fieldset>
  );
}
