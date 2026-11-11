"use client";

import { useEffect, useId, useState } from "react";
import { facebookSupportFor, FACEBOOK_CAPTION_MAX_LENGTH, type FacebookPostKind } from "@/lib/facebook/facebook-media-rules";

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

export function SocialDestinationsPicker({
  value,
  onChange,
  postType,
  hasVideoItems = false,
  instagramLabel,
  returnPath,
  disabled,
  pages: pagesProp,
  onConnect,
}: {
  value: SocialDestinationsValue;
  onChange: (value: SocialDestinationsValue) => void;
  postType: FacebookPostKind;
  hasVideoItems?: boolean;
  /** "@usuario" da conta do Instagram de destino. */
  instagramLabel: string | null;
  /** Para onde voltar depois de conectar a Página (rota /instagram/...). */
  returnPath: string;
  disabled?: boolean;
  /** Antes de sair para a Meta (ex.: guardar o rascunho local). Ausente = navegação normal. */
  onConnect?: (href: string) => void;
  /** Para testes / telas que já carregaram as Páginas. */
  pages?: { pages: ConnectedFacebookPage[]; loaded: boolean; configured: boolean };
}) {
  const fetched = useFacebookPages();
  const { pages, loaded, configured } = pagesProp ?? fetched;
  const captionId = useId();
  const support = facebookSupportFor(postType, hasVideoItems);
  const connected = pages.filter((page) => page.status === "connected");
  const needsReconnect = pages.filter((page) => page.status === "needs_reconnect");
  const connectHref = `/api/facebook/pages/oauth/start?returnTo=${encodeURIComponent(returnPath)}`;

  // Facebook desmarcado se o tipo deixou de ser suportado (ex.: virou carrossel com vídeo).
  useEffect(() => {
    if (!support.supported && value.facebook) onChange({ ...value, facebook: false, instagram: true });
  }, [support.supported, value, onChange]);

  function toggleFacebook(checked: boolean) {
    // Preseleciona só se houver exatamente uma Página conectada — sempre
    // visível e editável; nunca escolhe "a primeira" entre várias.
    const preselect = checked && value.facebookPageIds.length === 0 && connected.length === 1 ? [connected[0].id] : value.facebookPageIds;
    onChange({ ...value, facebook: checked, facebookPageIds: checked ? preselect : value.facebookPageIds });
  }

  function togglePage(id: string, checked: boolean) {
    const next = checked ? [...new Set([...value.facebookPageIds, id])] : value.facebookPageIds.filter((item) => item !== id);
    onChange({ ...value, facebookPageIds: next });
  }

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
          disabled={disabled || !support.supported || (loaded && connected.length === 0)}
          onChange={(event) => toggleFacebook(event.target.checked)}
        />
        Facebook
        {value.facebook && connected.length === 1 && value.facebookPageIds.includes(connected[0].id) ? (
          <span className="text-zinc-500">: {connected[0].pageName}</span>
        ) : null}
      </label>

      {!support.supported ? <p className="text-xs text-amber-800">{support.reason}</p> : null}

      {support.supported && loaded && connected.length === 0 ? (
        <p className="text-xs text-zinc-600">
          {configured ? (
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
          ) : (
            "A publicação no Facebook ainda não está habilitada neste ambiente."
          )}
        </p>
      ) : null}

      {needsReconnect.length > 0 ? (
        <p className="text-xs text-amber-800">
          {needsReconnect.map((page) => page.pageName).join(", ")}: precisa reconectar.{" "}
          <a href={connectHref} className="font-medium underline">
            Reconectar Página
          </a>
        </p>
      ) : null}

      {value.facebook && connected.length > 1 ? (
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
    </fieldset>
  );
}
