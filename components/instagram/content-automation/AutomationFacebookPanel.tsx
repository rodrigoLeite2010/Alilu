"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * "Publicar também no Facebook" de uma automação do Piloto Automático.
 *
 * Valor salvo (content_automations.facebook_page_ids):
 *   null  = automático: Páginas conectadas vinculadas à conta Instagram da automação;
 *   []    = não publicar no Facebook;
 *   [ids] = exatamente as Páginas marcadas.
 * Vale para as PRÓXIMAS publicações geradas — nada já criado muda.
 */

interface PageDto {
  id: string;
  pageName: string;
  status: "connected" | "needs_reconnect" | "revoked";
  instagramAccountId: string | null;
  linkedIgUsername: string | null;
}

export type FacebookChoice = "AUTO" | "OFF" | "PAGES";

export function choiceFromValue(value: string[] | null | undefined): FacebookChoice {
  if (value === null || value === undefined) return "AUTO";
  return value.length === 0 ? "OFF" : "PAGES";
}

export function valueFromChoice(choice: FacebookChoice, selected: string[]): string[] | null {
  if (choice === "AUTO") return null;
  if (choice === "OFF") return [];
  return selected;
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" && body.error ? body.error : fallback;
  } catch {
    return fallback;
  }
}

export function AutomationFacebookPanel({
  automationId,
  instagramAccountId,
  initialValue,
  returnPath,
  pages: pagesProp,
}: {
  automationId: string;
  instagramAccountId?: string;
  initialValue: string[] | null | undefined;
  returnPath: string;
  /** Para testes: Páginas já carregadas. */
  pages?: PageDto[];
}) {
  const [pages, setPages] = useState<PageDto[] | null>(pagesProp ?? null);
  const [choice, setChoice] = useState<FacebookChoice>(choiceFromValue(initialValue));
  const [selected, setSelected] = useState<string[]>(Array.isArray(initialValue) ? initialValue : []);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (pagesProp) return;
    let cancelled = false;
    // Promise.resolve() primeiro: um fetch indisponível/simulado nunca derruba a tela.
    Promise.resolve()
      .then(() => fetch("/api/facebook/pages", { cache: "no-store" }))
      .then(async (response) => (response?.ok ? ((await response.json()) as { pages?: PageDto[] }) : null))
      .then((body) => {
        if (!cancelled) setPages(body?.pages ?? []);
      })
      .catch(() => {
        if (!cancelled) setPages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [pagesProp]);

  const connected = (pages ?? []).filter((page) => page.status === "connected");
  const linked = connected.filter((page) => instagramAccountId && page.instagramAccountId === instagramAccountId);
  const connectHref = `/api/facebook/pages/oauth/start?returnTo=${encodeURIComponent(returnPath)}`;

  async function save() {
    if (choice === "PAGES" && selected.length === 0) {
      setMessage({ kind: "error", text: "Marque a Página do Facebook onde publicar." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/content-automation/automations/${automationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-facebook", facebookPageIds: valueFromChoice(choice, selected) }),
      });
      if (!response.ok) throw new Error(await readError(response, "Não foi possível salvar o destino do Facebook."));
      setMessage({ kind: "ok", text: "Destino do Facebook salvo. Vale para as próximas publicações geradas." });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível salvar o destino do Facebook." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <fieldset className="rounded-md border border-zinc-200 p-3" aria-label="Publicar também no Facebook">
      <legend className="px-1 text-sm font-medium text-zinc-800">Publicar também no Facebook</legend>
      {pages === null ? (
        <p className="text-sm text-zinc-500">Carregando Páginas do Facebook…</p>
      ) : connected.length === 0 ? (
        <p className="text-sm text-zinc-600">
          Nenhuma Página do Facebook conectada. As publicações vão só para o Instagram.{" "}
          <a href={connectHref} className="font-medium text-teal-800 underline">
            Conectar Página do Facebook
          </a>
        </p>
      ) : (
        <div className="space-y-1 text-sm">
          <label className="flex items-start gap-2 py-1">
            <input
              type="radio"
              name={`fb-${automationId}`}
              checked={choice === "AUTO"}
              onChange={() => setChoice("AUTO")}
              className="mt-0.5 h-4 w-4 border-zinc-300 text-teal-700"
            />
            <span>
              Automático — Página vinculada a esta conta do Instagram
              <span className="block text-xs text-zinc-500">
                {linked.length > 0
                  ? `Publica também em: ${linked.map((page) => page.pageName).join(", ")}.`
                  : "Nenhuma Página conectada está vinculada a esta conta: as publicações vão só para o Instagram."}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 py-1">
            <input
              type="radio"
              name={`fb-${automationId}`}
              checked={choice === "PAGES"}
              onChange={() => setChoice("PAGES")}
              className="mt-0.5 h-4 w-4 border-zinc-300 text-teal-700"
            />
            Escolher as Páginas
          </label>
          {choice === "PAGES" ? (
            <div className="ml-6 space-y-1">
              {connected.map((page) => (
                <label key={page.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(page.id)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked ? [...current, page.id] : current.filter((id) => id !== page.id),
                      )
                    }
                    className="h-4 w-4 rounded border-zinc-300 text-teal-700"
                  />
                  {page.pageName}
                  {page.linkedIgUsername ? <span className="text-xs text-zinc-500">(@{page.linkedIgUsername})</span> : null}
                </label>
              ))}
            </div>
          ) : null}
          <label className="flex items-start gap-2 py-1">
            <input
              type="radio"
              name={`fb-${automationId}`}
              checked={choice === "OFF"}
              onChange={() => setChoice("OFF")}
              className="mt-0.5 h-4 w-4 border-zinc-300 text-teal-700"
            />
            Não publicar no Facebook
          </label>
          <p className="pt-1 text-xs text-zinc-500">
            Stories não são publicados no Facebook. A mudança vale para as próximas publicações geradas.
          </p>
          <div className="pt-2">
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? "Salvando…" : "Salvar destino do Facebook"}
            </Button>
          </div>
        </div>
      )}
      {message ? (
        <p role={message.kind === "error" ? "alert" : "status"} className={`mt-2 text-sm ${message.kind === "error" ? "text-red-700" : "text-teal-800"}`}>
          {message.text}
        </p>
      ) : null}
    </fieldset>
  );
}
