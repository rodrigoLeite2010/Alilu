"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  DEFAULT_TYPE_WEIGHTS,
  defaultSmartStoryConfig,
  type SmartStoryConfig,
} from "@/lib/content-automation/smart-story/config";
import {
  STORY_THEMES,
  STORY_THEME_LABEL,
  STORY_TYPES,
  STORY_TYPE_LABEL,
  type StoryTheme,
  type StoryType,
} from "@/lib/content-automation/smart-story/types";

export interface SmartStoryState {
  enabled: boolean;
  config: SmartStoryConfig;
}

interface PreviewResponse {
  dataUrl: string;
  content: { type: StoryType; headline: string };
  plan: { type: StoryType; theme: string; useMascot: boolean };
  source: "AI" | "FALLBACK";
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" && body.error ? body.error : fallback;
  } catch {
    return fallback;
  }
}

/**
 * "Modo inteligente de Stories". Tela simples: ativar, ver o estilo
 * automático, gerar exemplo e salvar. Prompt base, dias e horários são os
 * do editor ao lado (não duplicamos). O avançado fica recolhido.
 * Prévia e salvar usam a API; a prévia NUNCA publica nem grava.
 */
export function SmartStoryPanel({
  automationId,
  initial,
  basePrompt,
  brandContext,
  previewTime,
  onEnabledChange,
}: {
  automationId: string;
  initial?: SmartStoryState;
  basePrompt: string;
  brandContext: string;
  /** "HH:mm" do primeiro horário (decide a faixa do dia na prévia). */
  previewTime: string;
  /** Avisa o editor (imagem de fundo e opções do fluxo manual somem enquanto o modo está ligado). */
  onEnabledChange?: (enabled: boolean) => void;
}) {
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [config, setConfig] = useState<SmartStoryConfig>(initial?.config ?? defaultSmartStoryConfig());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [shownTypes, setShownTypes] = useState<StoryType[]>([]);
  const baseId = useId();

  function patch(next: Partial<SmartStoryConfig>) {
    setConfig((current) => ({ ...current, ...next }));
    setNotice(null);
  }

  function toggleType(type: StoryType) {
    const has = config.enabledTypes.includes(type);
    if (has && config.enabledTypes.length === 1) return; // sempre pelo menos um tipo
    patch({ enabledTypes: has ? config.enabledTypes.filter((t) => t !== type) : STORY_TYPES.filter((t) => t === type || config.enabledTypes.includes(t)) });
  }

  function toggleTheme(theme: StoryTheme) {
    const has = config.themes.includes(theme);
    if (has && config.themes.length === 1) return;
    patch({ themes: has ? config.themes.filter((t) => t !== theme) : STORY_THEMES.filter((t) => t === theme || config.themes.includes(t)) });
  }

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/content-automation/automations/${automationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-smart-story", enabled, config }),
      });
      if (!response.ok) throw new Error(await readError(response, "Não foi possível salvar o modo inteligente."));
      setNotice(enabled ? "Salvo. Os próximos Stories serão gerados no modo inteligente." : "Salvo. Modo inteligente desligado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o modo inteligente.");
    } finally {
      setSaving(false);
    }
  }

  async function generate() {
    setPreviewing(true);
    setError(null);
    try {
      const response = await fetch("/api/content-automation/smart-story/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config,
          basePrompt,
          brandContext,
          time: previewTime,
          nonce: `${Date.now()}-${shownTypes.length}`,
          previousTypes: shownTypes,
        }),
      });
      if (!response.ok) throw new Error(await readError(response, "Não foi possível gerar o exemplo."));
      const data = (await response.json()) as PreviewResponse;
      setPreview(data);
      setShownTypes((current) => [data.plan.type, ...current].slice(0, 10));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar o exemplo.");
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <section aria-label="Modo inteligente de Stories" className="space-y-4 rounded-lg border border-teal-300 bg-teal-50/30 p-4">
      <label className="flex min-h-11 items-start gap-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => {
            setEnabled(event.target.checked);
            onEnabledChange?.(event.target.checked);
            setNotice(null);
          }}
          className="mt-1 h-5 w-5 shrink-0 accent-teal-700"
        />
        <span>
          <span className="block text-base font-semibold text-zinc-900">Modo inteligente de Stories</span>
          <span className="block text-sm text-zinc-600">
            A Alilu escolhe automaticamente o tipo, o tema e o template de cada Story, sem repetir o anterior. Você só define o prompt base, os dias e os horários.
          </span>
          <span className="mt-1 block text-xs text-zinc-500">
            No modo inteligente, os templates e fundos são escolhidos automaticamente — não é preciso escolher imagem de fundo.
          </span>
        </span>
      </label>

      {enabled ? (
        <div className="space-y-4">
          <div className="rounded-md bg-white p-3 text-sm text-zinc-700">
            <p className="font-medium text-zinc-900">Estilo automático</p>
            <p className="mt-1">
              Manhã: reflexões e perguntas · meio do dia: enquetes e escolhas · noite: chamadas e a marca Alilu. O mascote aparece de vez em
              quando e o idioma é português do Brasil.
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Enquetes e perguntas são desenhadas na imagem. O Instagram não permite publicar figurinhas interativas por aqui, então o Story não pede
              “vote” nem “toque”.
            </p>
            {!basePrompt.trim() ? <p className="mt-1 text-xs text-amber-700">Escreva o prompt base acima para a IA seguir o seu assunto.</p> : null}
          </div>

          <details className="rounded-md border border-zinc-200 bg-white p-3">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-zinc-900">Opções avançadas</summary>
            <div className="mt-3 space-y-5 text-sm">
              <fieldset>
                <legend className="font-medium text-zinc-900">Tipos de Story e peso</legend>
                <p className="text-xs text-zinc-500">Peso maior = aparece mais. Peso 0 = nunca.</p>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {STORY_TYPES.map((type) => {
                    const on = config.enabledTypes.includes(type);
                    return (
                      <li key={type} className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-zinc-200 px-2">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={on} onChange={() => toggleType(type)} className="h-4 w-4 accent-teal-700" />
                          <span>{STORY_TYPE_LABEL[type]}</span>
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={1000}
                          inputMode="numeric"
                          aria-label={`Peso de ${STORY_TYPE_LABEL[type]}`}
                          disabled={!on}
                          value={config.typeWeights[type]}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            patch({ typeWeights: { ...config.typeWeights, [type]: Number.isFinite(value) ? Math.min(1000, Math.max(0, value)) : 0 } });
                          }}
                          className="w-16 rounded-md border border-zinc-300 px-2 py-1 text-base disabled:opacity-40 sm:text-sm"
                        />
                      </li>
                    );
                  })}
                </ul>
              </fieldset>

              <fieldset>
                <legend className="font-medium text-zinc-900">Temas</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {STORY_THEMES.map((theme) => {
                    const on = config.themes.includes(theme);
                    return (
                      <button
                        key={theme}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleTheme(theme)}
                        className={`min-h-11 rounded-full border px-3 text-sm ${on ? "border-teal-700 bg-teal-700 text-white" : "border-zinc-300 bg-white text-zinc-700"}`}
                      >
                        {STORY_THEME_LABEL[theme]}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="font-medium text-zinc-900">Não repetir o tipo nos últimos</span>
                  <input
                    id={`${baseId}-avoid`}
                    type="number"
                    min={0}
                    max={10}
                    value={config.avoidTypeWindow}
                    onChange={(event) => patch({ avoidTypeWindow: Math.min(10, Math.max(0, Math.round(Number(event.target.value) || 0))) })}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
                  />
                </label>
                <label className="block">
                  <span className="font-medium text-zinc-900">Mascote a cada (0 = nunca)</span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={config.mascotEveryN}
                    onChange={(event) => {
                      const value = Math.round(Number(event.target.value) || 0);
                      patch({ mascotEveryN: value === 0 ? 0 : Math.min(20, Math.max(2, value)) });
                    }}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm"
                  />
                </label>
                <label className="flex min-h-11 items-center gap-2 self-end">
                  <input
                    type="checkbox"
                    checked={config.showBrandHandle}
                    onChange={(event) => patch({ showBrandHandle: event.target.checked })}
                    className="h-4 w-4 accent-teal-700"
                  />
                  <span>Mostrar logo e @alilu.tec</span>
                </label>
              </div>

              <button
                type="button"
                onClick={() => {
                  const base = defaultSmartStoryConfig();
                  setConfig({ ...base, typeWeights: { ...DEFAULT_TYPE_WEIGHTS } });
                  setNotice(null);
                }}
                className="min-h-11 text-sm font-medium text-teal-800 hover:underline"
              >
                Restaurar padrão
              </button>
            </div>
          </details>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={generate} disabled={previewing}>
                {previewing ? "Gerando…" : preview ? "Gerar outro" : "Gerar exemplo"}
              </Button>
            </div>
            <p className="text-xs text-zinc-500">O exemplo não é publicado nem consome gerações do plano.</p>
            {preview ? (
              <figure className="max-w-[16rem] space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerado agora, não otimizável */}
                <img
                  src={preview.dataUrl}
                  alt={`Exemplo de Story: ${preview.content.headline}`}
                  className="w-full rounded-lg border border-zinc-200"
                />
                <figcaption className="text-xs text-zinc-600">
                  {STORY_TYPE_LABEL[preview.plan.type]}
                  {preview.source === "FALLBACK" ? " · texto de reserva (a IA não respondeu)" : ""}
                </figcaption>
              </figure>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-teal-800">
          {notice}
        </p>
      ) : null}

      <Button className="w-full sm:w-auto" onClick={save} disabled={saving}>
        {saving ? "Salvando…" : "Salvar modo inteligente"}
      </Button>
    </section>
  );
}
