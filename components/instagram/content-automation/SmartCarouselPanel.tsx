"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { MediaPicker } from "./MediaPicker";
import { PlansLink } from "@/components/carousel/PlansLink";
import { CAROUSEL_TEMPLATES } from "@/lib/carousel/design/templates";
import { CAROUSEL_CATEGORIES, type CarouselCategoryId } from "@/lib/content-automation/smart-carousel/categories";
import { DEFAULT_SMART_CAROUSEL_CONFIG, type SmartCarouselConfig } from "@/lib/content-automation/smart-carousel/config";

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" && body.error ? body.error : fallback;
  } catch {
    return fallback;
  }
}

const IMAGE_SOURCE_LABEL: Record<SmartCarouselConfig["imageSource"], string> = {
  AUTO: "Automático (banco de fotos)",
  OWN: "Só minhas imagens",
  COMBINED: "Combinar minhas imagens e o banco de fotos",
  NONE: "Sem fotos (só o modelo visual)",
};

/**
 * Configuração do Carrossel Inteligente automático — mobile-first (campos empilhados,
 * alvos de toque de 40px+). Sem horário/dias aqui: são os do editor. "Gerar exemplo"
 * cria um carrossel para conferir; NÃO publica, NÃO agenda e NÃO consome a cota.
 */
export function SmartCarouselPanel({ automationId, userId, initial }: { automationId: string; userId: string; initial?: SmartCarouselConfig }) {
  const baseId = useId();
  const [config, setConfig] = useState<SmartCarouselConfig>(initial ?? DEFAULT_SMART_CAROUSEL_CONFIG);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewInfo, setPreviewInfo] = useState<{ category: string | null; topic: string; diagnostic: string | null } | null>(null);

  const patch = (next: Partial<SmartCarouselConfig>) => setConfig((current) => ({ ...current, ...next }));
  const toggleCategory = (id: CarouselCategoryId, on: boolean) =>
    patch({ enabledCategories: on ? [...config.enabledCategories.filter((item) => item !== id), id] : config.enabledCategories.filter((item) => item !== id) });
  const setWeight = (id: CarouselCategoryId, value: number) =>
    patch({ categoryWeights: { ...config.categoryWeights, [id]: Math.min(100, Math.max(0, Math.floor(Number.isFinite(value) ? value : 0))) } });
  const totalWeight = CAROUSEL_CATEGORIES.reduce((sum, category) => sum + (config.enabledCategories.includes(category.id) ? (config.categoryWeights[category.id] ?? 0) : 0), 0);
  const usesOwn = config.imageSource === "OWN" || config.imageSource === "COMBINED";

  async function call(action: string, body: Record<string, unknown>): Promise<Response> {
    return fetch(`/api/content-automation/automations/${automationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
  }

  async function save(): Promise<boolean> {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await call("update-smart-carousel", { config });
      if (!response.ok) throw new Error(await readError(response, "Não foi possível salvar."));
      setNotice("Salvo. Os próximos carrosséis seguem estas opções.");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function preview() {
    setError(null);
    setNotice(null);
    setPreviewId(null);
    setPreviewInfo(null);
    if (!(await save())) return;
    setPreviewing(true);
    try {
      const response = await call("smart-carousel-preview", {});
      if (!response.ok) throw new Error(await readError(response, "Não foi possível gerar o exemplo."));
      const body = (await response.json()) as { projectId: string; category?: string | null; topic?: string; diagnostic?: string | null };
      setPreviewId(body.projectId);
      setPreviewInfo({ category: body.category ?? null, topic: body.topic ?? "", diagnostic: body.diagnostic ?? null });
      setNotice("Exemplo gerado. Nada foi publicado nem agendado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar o exemplo.");
    } finally {
      setPreviewing(false);
    }
  }

  const field = "w-full min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900";

  return (
    <section aria-label="Carrossel Inteligente automático" className="space-y-4 rounded-lg border border-teal-200 bg-teal-50/30 p-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Carrossel Inteligente automático</h2>
        <p className="mt-1 text-sm text-zinc-600">
          No horário, a Alilu escolhe o tema, escreve, busca as imagens, aplica o modelo e a imagem final e cria a legenda. Só usa a cota do Carrossel Inteligente.
        </p>
      </div>

      {error ? (
        <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>{error}</p>
          <PlansLink message={error} />
        </div>
      ) : null}
      {notice ? <p role="status" className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">{notice}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${baseId}-slides`} className="mb-1 block text-sm font-medium text-zinc-800">Quantidade de slides</label>
          <select id={`${baseId}-slides`} className={field} value={config.slideCount} onChange={(e) => patch({ slideCount: Number(e.target.value) })}>
            {[5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>{n} slides</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">Com a imagem final ligada ela entra como último slide (máximo 10 no total).</p>
        </div>

        <div>
          <label htmlFor={`${baseId}-template`} className="mb-1 block text-sm font-medium text-zinc-800">Modelo visual</label>
          <select
            id={`${baseId}-template`}
            className={field}
            value={config.templateMode === "FIXED" ? (config.templateId ?? "") : "AUTO"}
            onChange={(e) => (e.target.value === "AUTO" ? patch({ templateMode: "AUTO", templateId: null }) : patch({ templateMode: "FIXED", templateId: e.target.value }))}
          >
            <option value="AUTO">Automático (varia e combina com a categoria)</option>
            {CAROUSEL_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor={`${baseId}-images`} className="mb-1 block text-sm font-medium text-zinc-800">Imagens</label>
          <select id={`${baseId}-images`} className={field} value={config.imageSource} onChange={(e) => patch({ imageSource: e.target.value as SmartCarouselConfig["imageSource"] })}>
            {(Object.keys(IMAGE_SOURCE_LABEL) as SmartCarouselConfig["imageSource"][]).map((key) => (
              <option key={key} value={key}>{IMAGE_SOURCE_LABEL[key]}</option>
            ))}
          </select>
        </div>

        {usesOwn ? (
          <div className="space-y-2 sm:col-span-2">
            <p className="text-sm font-medium text-zinc-800">Minhas imagens ({config.ownImageMediaIds.length})</p>
            {config.ownImageMediaIds.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {config.ownImageMediaIds.map((id, index) => (
                  <li key={id} className="flex items-center gap-2 rounded-md bg-white px-2 py-1 text-xs text-zinc-700">
                    Imagem {index + 1}
                    <button type="button" className="min-h-8 px-1 text-red-700" onClick={() => patch({ ownImageMediaIds: config.ownImageMediaIds.filter((item) => item !== id) })}>
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-xs text-zinc-500">Escolha ou envie uma imagem para adicionar à lista.</p>
            <MediaPicker
              userId={userId}
              mediaType="image"
              value={null}
              onChange={(id) => id && !config.ownImageMediaIds.includes(id) && config.ownImageMediaIds.length < 50 && patch({ ownImageMediaIds: [...config.ownImageMediaIds, id] })}
            />
          </div>
        ) : null}


        <fieldset className="space-y-3 sm:col-span-2">
          <legend className="text-sm font-medium text-zinc-800">Temas dos carrosséis</legend>
          <div>
            <label htmlFor={`${baseId}-topic-source`} className="mb-1 block text-xs text-zinc-600">De onde vem o tema</label>
            <select id={`${baseId}-topic-source`} className={field} value={config.topicSource} onChange={(e) => patch({ topicSource: e.target.value as SmartCarouselConfig["topicSource"] })}>
              <option value="AUTO">Automático: a Alilu escolhe categoria e tema (o prompt define só o estilo)</option>
              <option value="PROMPT">Usar o texto do prompt como tema (modo antigo)</option>
            </select>
          </div>
          {config.topicSource === "AUTO" ? (
            <>
              <p className="text-xs text-zinc-500">
                Marque as categorias e ajuste o peso (quanto maior, mais frequente). Peso 0 nunca sorteia. Criação de conteúdo é só uma entre várias.
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {CAROUSEL_CATEGORIES.map((category) => {
                  const on = config.enabledCategories.includes(category.id);
                  const weight = config.categoryWeights[category.id] ?? category.weight;
                  const share = on && totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0;
                  return (
                    <li key={category.id} className="flex min-h-11 items-center justify-between gap-2 rounded-md bg-white px-3 py-1">
                      <label className="flex min-h-10 flex-1 items-center gap-2 text-sm text-zinc-800">
                        <input type="checkbox" className="h-4 w-4" checked={on} onChange={(e) => toggleCategory(category.id, e.target.checked)} />
                        {category.label}
                      </label>
                      <span className="text-xs text-zinc-500">{on ? `${share}%` : ""}</span>
                      <input
                        aria-label={`Peso de ${category.label}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={100}
                        disabled={!on}
                        className="min-h-9 w-16 rounded-md border border-zinc-300 px-2 text-sm"
                        value={weight}
                        onChange={(e) => setWeight(category.id, Number(e.target.value))}
                      />
                    </li>
                  );
                })}
              </ul>
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <label htmlFor={`${baseId}-cat-window`} className="mb-1 block text-xs text-zinc-600">Não repetir categoria nos últimos</label>
                  <input id={`${baseId}-cat-window`} type="number" inputMode="numeric" min={0} max={10} className={field} value={config.avoidCategoryWindow} onChange={(e) => patch({ avoidCategoryWindow: Math.min(10, Math.max(0, Math.floor(Number(e.target.value) || 0))) })} />
                </div>
                <div>
                  <label htmlFor={`${baseId}-topic-window`} className="mb-1 block text-xs text-zinc-600">Não repetir tema nos últimos</label>
                  <input id={`${baseId}-topic-window`} type="number" inputMode="numeric" min={1} max={60} className={field} value={config.avoidTopicWindow} onChange={(e) => patch({ avoidTopicWindow: Math.min(60, Math.max(1, Math.floor(Number(e.target.value) || 1))) })} />
                </div>
                <div>
                  <label htmlFor={`${baseId}-min-photos`} className="mb-1 block text-xs text-zinc-600">Fotos por carrossel (mín.)</label>
                  <input id={`${baseId}-min-photos`} type="number" inputMode="numeric" min={0} max={8} className={field} value={config.minPhotos} onChange={(e) => { const v = Math.min(8, Math.max(0, Math.floor(Number(e.target.value) || 0))); patch({ minPhotos: v, maxPhotos: Math.max(v, config.maxPhotos) }); }} />
                </div>
                <div>
                  <label htmlFor={`${baseId}-max-photos`} className="mb-1 block text-xs text-zinc-600">Fotos por carrossel (máx.)</label>
                  <input id={`${baseId}-max-photos`} type="number" inputMode="numeric" min={0} max={8} className={field} value={config.maxPhotos} onChange={(e) => { const v = Math.min(8, Math.max(0, Math.floor(Number(e.target.value) || 0))); patch({ maxPhotos: v, minPhotos: Math.min(v, config.minPhotos) }); }} />
                </div>
              </div>
            </>
          ) : null}
        </fieldset>

        <div>
          <label htmlFor={`${baseId}-window`} className="mb-1 block text-sm font-medium text-zinc-800">Não repetir os últimos</label>
          <input
            id={`${baseId}-window`}
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            className={field}
            value={config.antiRepeatWindow}
            onChange={(e) => patch({ antiRepeatWindow: Math.min(60, Math.max(1, Math.floor(Number(e.target.value) || 1))) })}
          />
          <p className="mt-1 text-xs text-zinc-500">carrosséis (tema, gancho, títulos e imagens).</p>
        </div>

        <div className="space-y-2 self-end">
          <label className="flex min-h-10 items-center gap-2 text-sm text-zinc-800">
            <input type="checkbox" className="h-4 w-4" checked={config.addFinalImage} onChange={(e) => patch({ addFinalImage: e.target.checked })} />
            Adicionar a imagem final padrão
          </label>
          <label className="flex min-h-10 items-center gap-2 text-sm text-zinc-800">
            <input type="checkbox" className="h-4 w-4" checked={config.generateCaption} onChange={(e) => patch({ generateCaption: e.target.checked })} />
            Gerar a legenda com IA
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={save} disabled={saving || previewing}>{saving ? "Salvando…" : "Salvar opções"}</Button>
        <Button variant="secondary" onClick={preview} disabled={saving || previewing}>
          {previewing ? "Gerando exemplo… (pode levar 1–2 min)" : "Gerar exemplo"}
        </Button>
      </div>
      {previewInfo ? (
        <div className="rounded-md bg-white px-3 py-2 text-sm text-zinc-700">
          {previewInfo.category ? <p><span className="font-medium">Categoria:</span> {previewInfo.category}</p> : null}
          {previewInfo.topic ? <p><span className="font-medium">Tema:</span> {previewInfo.topic}</p> : null}
          {previewInfo.diagnostic ? (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-zinc-500">Diagnóstico da geração</summary>
              <p className="mt-1 break-words text-xs text-zinc-600">{previewInfo.diagnostic}</p>
            </details>
          ) : null}
        </div>
      ) : null}
      {previewId ? (
        <Link href={`/instagram/carrossel-inteligente/${previewId}`} className="inline-flex min-h-10 items-center text-sm font-medium text-teal-800 underline">
          Abrir o exemplo no editor
        </Link>
      ) : null}
    </section>
  );
}
