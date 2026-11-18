"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * "Destinos por conta do Instagram" (configuração por categoria).
 *
 * Para cada conta do Instagram (ex.: Alilu, Prestador Seguro, Se Tá Bom Pra
 * Você, GTA 6) a pessoa define, por ID:
 *   - se o Facebook pode ser usado;
 *   - quais Páginas são PERMITIDAS;
 *   - quais Páginas vêm marcadas como SUGESTÃO ao criar (sempre editável).
 * O backend aplica a mesma regra em toda publicação (manual, Piloto,
 * filas, cron). Conectar uma Página nova NUNCA a habilita sozinho aqui.
 */

interface ProfileDto {
  instagramAccountId: string;
  label: string | null;
  facebookEnabled: boolean;
  allowedFacebookPageRefs: string[];
  defaultFacebookPageRefs: string[];
}

interface Overview {
  accounts: Array<{ id: string; username: string | null; status: string; profile: ProfileDto | null }>;
  pages: Array<{ id: string; pageName: string; pageId: string; status: string; instagramAccountId: string | null; linkedIgUsername: string | null }>;
  primaryInstagramAccountId: string | null;
}

interface Draft {
  label: string;
  facebookEnabled: boolean;
  allowed: string[];
  defaults: string[];
}

function draftFrom(profile: ProfileDto | null): Draft {
  return {
    label: profile?.label ?? "",
    facebookEnabled: profile?.facebookEnabled ?? false,
    allowed: profile?.allowedFacebookPageRefs ?? [],
    defaults: profile?.defaultFacebookPageRefs ?? [],
  };
}

export function SocialDestinationProfilesSection({ initial }: { initial?: Overview } = {}) {
  const [overview, setOverview] = useState<Overview | null>(initial ?? null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, { kind: "ok" | "error"; text: string }>>({});

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/social/destination-profiles", { cache: "no-store" });
      if (!response.ok) return;
      setOverview((await response.json()) as Overview);
    } catch {
      // Tela continua utilizável; nada é alterado.
    }
  }, []);

  useEffect(() => {
    if (!initial) void load();
  }, [initial, load]);

  useEffect(() => {
    if (!overview) return;
    setDrafts(Object.fromEntries(overview.accounts.map((account) => [account.id, draftFrom(account.profile)])));
  }, [overview]);

  if (!overview || overview.accounts.length === 0) return null;

  function update(accountId: string, patch: Partial<Draft>) {
    setDrafts((current) => {
      const next = { ...current[accountId], ...patch };
      next.defaults = next.defaults.filter((id) => next.allowed.includes(id));
      return { ...current, [accountId]: next };
    });
  }

  async function save(accountId: string) {
    const draft = drafts[accountId];
    if (!draft) return;
    setSaving(accountId);
    setMessages((current) => ({ ...current, [accountId]: { kind: "ok", text: "Salvando…" } }));
    try {
      const response = await fetch("/api/social/destination-profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramAccountId: accountId,
          label: draft.label || null,
          facebookEnabled: draft.facebookEnabled,
          allowedFacebookPageRefs: draft.facebookEnabled ? draft.allowed : [],
          defaultFacebookPageRefs: draft.facebookEnabled ? draft.defaults : [],
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Não foi possível salvar.");
      setMessages((current) => ({ ...current, [accountId]: { kind: "ok", text: "Destinos salvos. Valem para novas publicações e para os agendamentos ainda não enviados." } }));
      await load();
    } catch (error) {
      setMessages((current) => ({ ...current, [accountId]: { kind: "error", text: error instanceof Error ? error.message : "Não foi possível salvar." } }));
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="space-y-3 rounded-md border border-zinc-200 bg-white p-4" aria-label="Destinos por conta do Instagram">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">Destinos por conta do Instagram</h2>
        <p className="text-xs text-zinc-600">
          Defina em quais Páginas do Facebook cada conta pode publicar. Sem Página autorizada, a conta publica só no Instagram.
          O Alilu nunca publica no seu perfil pessoal do Facebook.
        </p>
      </div>
      {overview.accounts.map((account) => {
        const draft = drafts[account.id] ?? draftFrom(account.profile);
        const message = messages[account.id];
        const name = account.username ? `@${account.username}` : "Conta do Instagram";
        return (
          <fieldset key={account.id} className="space-y-2 rounded-md border border-zinc-200 p-3" aria-label={`Destinos de ${name}`}>
            <legend className="px-1 text-sm font-medium text-zinc-800">
              {name}
              {account.id === overview.primaryInstagramAccountId ? <span className="ml-1 text-xs text-zinc-500">(principal)</span> : null}
              {!account.profile ? <span className="ml-1 text-xs text-amber-700">— ainda não configurada</span> : null}
            </legend>
            <label className="block text-xs text-zinc-700">
              Nome da categoria
              <input
                type="text"
                value={draft.label}
                maxLength={80}
                placeholder="Ex.: Se Tá Bom Pra Você"
                onChange={(event) => update(account.id, { label: event.target.value })}
                className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1 text-sm"
              />
            </label>
            <p className="text-sm text-zinc-700">Instagram: {name} ✓</p>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-blue-700"
                checked={draft.facebookEnabled}
                onChange={(event) => update(account.id, { facebookEnabled: event.target.checked, allowed: event.target.checked ? draft.allowed : [], defaults: [] })}
              />
              Permitir Facebook para esta conta
            </label>
            {draft.facebookEnabled ? (
              <div className="space-y-1 pl-6">
                {overview.pages.length === 0 ? <p className="text-xs text-zinc-500">Nenhuma Página do Facebook conectada.</p> : null}
                {overview.pages.map((page) => (
                  <div key={page.id} className="flex flex-wrap items-center gap-3 text-sm text-zinc-700">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-blue-700"
                        checked={draft.allowed.includes(page.id)}
                        onChange={(event) =>
                          update(account.id, {
                            allowed: event.target.checked ? [...draft.allowed, page.id] : draft.allowed.filter((id) => id !== page.id),
                          })
                        }
                      />
                      Página {page.pageName}
                      {page.linkedIgUsername ? <span className="text-xs text-zinc-500">(vinculada a @{page.linkedIgUsername})</span> : null}
                      {page.status !== "connected" ? <span className="text-xs text-amber-700">— precisa reconectar</span> : null}
                    </label>
                    {draft.allowed.includes(page.id) ? (
                      <label className="flex items-center gap-1 text-xs text-zinc-600">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-teal-700"
                          checked={draft.defaults.includes(page.id)}
                          onChange={(event) =>
                            update(account.id, {
                              defaults: event.target.checked ? [...draft.defaults, page.id] : draft.defaults.filter((id) => id !== page.id),
                            })
                          }
                        />
                        marcar por padrão
                      </label>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="pl-6 text-xs text-zinc-500">Facebook: desativado — nada desta conta vai para o Facebook.</p>
            )}
            <Button type="button" onClick={() => void save(account.id)} disabled={saving !== null}>
              {saving === account.id ? "Salvando…" : "Salvar destinos"}
            </Button>
            {message ? (
              <p role={message.kind === "error" ? "alert" : "status"} className={`text-xs ${message.kind === "error" ? "text-red-700" : "text-teal-800"}`}>
                {message.text}
              </p>
            ) : null}
          </fieldset>
        );
      })}
    </section>
  );
}
