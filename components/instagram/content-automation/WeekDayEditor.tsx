"use client";

import { useId, useState } from "react";
import {
  CONTENT_CATEGORIES,
  CONTENT_CATEGORY_LABEL,
  DAY_OF_WEEK_LABEL,
  MAX_VISUAL_TEXT_LENGTH,
  MAX_CAROUSEL_VISUAL_TEXT_LENGTH,
  type AutomationContentCategory,
  type AutomationContentMode,
  type AutomationContentType,
  type DayOfWeek,
  type ImageMode,
} from "@/lib/content-automation/backend/automation-types";
import { POST_TEMPLATES } from "@/lib/instagram/templates";
import { MediaPicker } from "./MediaPicker";
import { autoResizeTextarea } from "./textarea-utils";
import { ColorSwatchInput } from "@/components/tools/instagram-post-creator/ColorSwatchInput";
import { PROMPT_VARIABLES } from "@/lib/content-automation/prompt-variables";
import { suggestedPromptFor } from "@/lib/content-automation/category-prompts";

export interface DayFormState {
  /** Id do horário (content_automation_days.id) — ausente só no assistente de criação, antes de a automação existir. */
  id?: string;
  dayOfWeek: DayOfWeek;
  /** 0 = horário principal do dia; 1, 2, … = horários extras ("+ Adicionar horário"). */
  slotIndex: number;
  /** Categoria opcional (Motivacional, Financeiro…) — alimenta {{categoria}} e sugere um prompt. */
  contentCategory: AutomationContentCategory | null;
  enabled: boolean;
  contentType: AutomationContentType;
  /** "AI" (padrão) gera a legenda a partir de `prompt`; "MANUAL" publica `manualCaption` tal como escrito, sem chamar IA. */
  contentMode: AutomationContentMode;
  prompt: string;
  manualCaption: string;
  /** Texto curto desenhado sobre a imagem quando a automação usa imageMode = "AUTO_TEMPLATE" e este dia está em modo manual. */
  visualText: string;
  /** Template do compositor (lib/instagram/templates.ts) usado quando imageMode = "AUTO_TEMPLATE". null usa o padrão. */
  templateId: string | null;
  /** Véu (0/0.1/0.2/0.3/0.4) sobre a foto quando imageMode = "AUTO_TEMPLATE". null usa o padrão (20%). */
  overlayOpacity: number | null;
  /** Cor (hex #rrggbb) do texto desenhado sobre a imagem quando imageMode = "AUTO_TEMPLATE". null usa o padrão (branco). */
  visualTextColor: string | null;
  publishTime: string;
  imageMediaId: string | null;
  videoMediaId: string | null;
}

const OVERLAY_LEVELS = [0, 0.1, 0.2, 0.3, 0.4] as const;

const CONTENT_TYPE_LABEL: Record<AutomationContentType, string> = {
  POST: "Post",
  CAROUSEL: "Carrossel",
  STORY: "Story",
  REEL: "Reel",
  SMART_CAROUSEL: "Carrossel Inteligente",
};

/** Contexto opcional só para a prévia do Story resolver {{nomeConta}}/{{tema}} e o contexto da marca. */
export interface StoryPreviewContext {
  instagramAccountId?: string | null;
  automationName?: string;
  brandContext?: string;
}

/**
 * Um card por dia da semana (seção 6 do briefing): liga/desliga, formato
 * (Post/Reel), horário e "o que publicar". A mídia (imagem/vídeo) do dia
 * é opcional — quando vazia, o dia usa a imagem/vídeo padrão da
 * automação (configurados na seção "Imagem padrão" do formulário).
 */
export function WeekDayEditor({
  userId,
  day,
  imageMode,
  defaultImageMediaId = null,
  onChange,
  onRemove,
  previewContext,
  shared = false,
  smartStory = false,
}: {
  userId: string;
  day: DayFormState;
  /** Modo de imagem da automação (não do dia) — controla se aparece o seletor de template/texto visual. */
  imageMode: ImageMode;
  /** Imagem padrão da automação (usada quando o dia não tem uma própria) — só para a prévia da arte saber qual foto usar. */
  defaultImageMediaId?: string | null;
  onChange: (patch: Partial<DayFormState>) => void;
  /** Só para horários extras (slotIndex > 0): mostra "Remover horário". */
  onRemove?: () => void;
  previewContext?: StoryPreviewContext;
  /**
   * Modo "Prompt único recorrente": este card edita o conteúdo
   * COMPARTILHADO por todas as execuções — sem dia, sem liga/desliga e
   * sem horário próprio (dias e horários ficam em SharedPromptEditor).
   */
  shared?: boolean;
  /**
   * Modo inteligente de Stories ligado: num Story o motor escolhe tipo,
   * tema, template e fundo — somem a escolha IA/manual, véu, cor, prévia
   * antiga e imagem própria (os valores salvos ficam intactos).
   */
  smartStory?: boolean;
}) {
  const [overrideMedia, setOverrideMedia] = useState(Boolean(day.imageMediaId || day.videoMediaId));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [carouselPreviewSlides, setCarouselPreviewSlides] = useState<string[] | null>(null);
  const [carouselPreviewOverflow, setCarouselPreviewOverflow] = useState<string | null>(null);
  const [carouselPreviewLoading, setCarouselPreviewLoading] = useState(false);
  const [carouselPreviewError, setCarouselPreviewError] = useState<string | null>(null);
  const checkboxId = useId();
  const promptId = useId();
  const manualCaptionId = useId();
  const visualTextId = useId();
  const templateId = useId();
  const overlayId = useId();
  const colorId = useId();
  const timeId = useId();
  const categoryId = useId();
  const [storyPreviewUrl, setStoryPreviewUrl] = useState<string | null>(null);
  const [storyPreviewText, setStoryPreviewText] = useState<string | null>(null);
  const [storyPreviewLoading, setStoryPreviewLoading] = useState(false);
  const [storyPreviewError, setStoryPreviewError] = useState<string | null>(null);
  const isCarousel = day.contentType === "CAROUSEL";
  const isStory = day.contentType === "STORY";
  const smartDay = smartStory && isStory;
  const radioPrefix = shared ? "shared" : `${day.dayOfWeek}-${day.slotIndex}`;
  const isAutoTemplateImage = imageMode === "AUTO_TEMPLATE" && (day.contentType === "POST" || isCarousel);
  const previewImageMediaId = day.imageMediaId ?? defaultImageMediaId;
  const visualTextMaxLength = isCarousel ? MAX_CAROUSEL_VISUAL_TEXT_LENGTH : MAX_VISUAL_TEXT_LENGTH;

  async function handlePreviewStory() {
    if (!previewImageMediaId) return;
    setStoryPreviewLoading(true);
    setStoryPreviewError(null);
    setStoryPreviewUrl(null);
    setStoryPreviewText(null);
    try {
      const response = await fetch("/api/content-automation/media/preview-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageMediaId: previewImageMediaId,
          mode: day.contentMode,
          visualText: day.visualText,
          prompt: day.prompt,
          dayOfWeek: day.dayOfWeek,
          publishTime: day.publishTime,
          contentCategory: day.contentCategory,
          overlayOpacity: day.overlayOpacity,
          visualTextColor: day.visualTextColor,
          instagramAccountId: previewContext?.instagramAccountId ?? null,
          automationName: previewContext?.automationName ?? "",
          brandContext: previewContext?.brandContext ?? "",
        }),
      });
      const payload = (await response.json()) as { dataUrl?: string; visualText?: string; error?: string };
      if (!response.ok || !payload.dataUrl) throw new Error(payload.error || "Não foi possível gerar a prévia do Story.");
      setStoryPreviewUrl(payload.dataUrl);
      setStoryPreviewText(payload.visualText ?? null);
    } catch (error) {
      setStoryPreviewError(error instanceof Error ? error.message : "Não foi possível gerar a prévia do Story.");
    } finally {
      setStoryPreviewLoading(false);
    }
  }

  async function handlePreview() {
    if (!previewImageMediaId || !day.visualText.trim()) return;
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewUrl(null);
    setPreviewMeta(null);
    try {
      const response = await fetch("/api/content-automation/media/preview-art", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageMediaId: previewImageMediaId,
          templateId: day.templateId,
          visualText: day.visualText,
          overlayOpacity: day.overlayOpacity,
          visualTextColor: day.visualTextColor,
        }),
      });
      const payload = (await response.json()) as {
        dataUrl?: string;
        error?: string;
        meta?: {
          templateIdUsed?: string;
          sourceWidth?: number;
          sourceHeight?: number;
          finalWidth?: number;
          finalHeight?: number;
          jpegQuality?: number;
          renderVersion?: string;
          fileSizeBytes?: number;
          visualTextLength?: number;
        };
      };
      if (!response.ok || !payload.dataUrl) {
        throw new Error(payload.error || "Não foi possível gerar a prévia.");
      }
      setPreviewUrl(payload.dataUrl);
      if (payload.meta) {
        setPreviewMeta(
          `${payload.meta.templateIdUsed ?? "template"} · ${payload.meta.finalWidth ?? "?"}×${payload.meta.finalHeight ?? "?"} · JPEG ${payload.meta.jpegQuality ?? "?"} · ${payload.meta.renderVersion ?? "render ?"}`
        );
      }
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Não foi possível gerar a prévia.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handlePreviewCarousel() {
    if (!previewImageMediaId || !day.visualText.trim()) return;
    setCarouselPreviewLoading(true);
    setCarouselPreviewError(null);
    setCarouselPreviewSlides(null);
    setCarouselPreviewOverflow(null);
    try {
      const response = await fetch("/api/content-automation/media/preview-carousel-art", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageMediaId: previewImageMediaId,
          templateId: day.templateId,
          visualText: day.visualText,
          overlayOpacity: day.overlayOpacity,
          visualTextColor: day.visualTextColor,
        }),
      });
      const payload = (await response.json()) as {
        slides?: { dataUrl: string }[];
        overflowText?: string | null;
        error?: string;
      };
      if (!response.ok || !payload.slides) {
        throw new Error(payload.error || "Não foi possível gerar a prévia do carrossel.");
      }
      setCarouselPreviewSlides(payload.slides.map((slide) => slide.dataUrl));
      setCarouselPreviewOverflow(payload.overflowText ?? null);
    } catch (error) {
      setCarouselPreviewError(error instanceof Error ? error.message : "Não foi possível gerar a prévia do carrossel.");
    } finally {
      setCarouselPreviewLoading(false);
    }
  }

  return (
    <fieldset className={`min-w-0 rounded-lg border p-3 transition-colors sm:p-4 ${day.enabled ? "border-teal-300 bg-teal-50/30" : "border-zinc-200"}`}>
      <legend className="px-1 text-sm font-semibold text-zinc-900">
        {shared ? "Conteúdo (o mesmo em todas as execuções)" : DAY_OF_WEEK_LABEL[day.dayOfWeek]}
        {!shared && day.slotIndex > 0 ? <span className="font-normal text-zinc-600"> · horário extra ({day.publishTime})</span> : null}
      </legend>

      {shared ? null : (
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={checkboxId}
          type="checkbox"
          checked={day.enabled}
          onChange={(event) => onChange({ enabled: event.target.checked })}
          className="h-4 w-4 rounded border-zinc-300 text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        />
        <label htmlFor={checkboxId} className="text-sm text-zinc-800">
          {day.slotIndex > 0 ? "Publicar neste horário" : "Publicar neste dia"}
        </label>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="ml-auto text-xs font-medium text-red-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            Remover horário
          </button>
        ) : null}
      </div>
      )}

      {day.enabled ? (
        <div className="mt-3 space-y-3">
          <div>
            <span className="mb-1 block text-xs font-medium text-zinc-700">Formato</span>
            <div className="flex flex-wrap gap-3 text-sm">
              {(
                imageMode === "AUTO_TEMPLATE"
                  ? (["POST", "CAROUSEL", "SMART_CAROUSEL", "STORY", "REEL"] as AutomationContentType[])
                  : (["POST", "SMART_CAROUSEL", "STORY", "REEL"] as AutomationContentType[])
              ).map((type) => (
                <label key={type} className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    name={`${radioPrefix}-content-type`}
                    checked={day.contentType === type}
                    onChange={() => onChange({ contentType: type })}
                    className="h-4 w-4 border-zinc-300 text-teal-700"
                  />
                  {CONTENT_TYPE_LABEL[type]}
                </label>
              ))}
            </div>
            {smartDay ? (
              <p className="mt-1 text-xs text-zinc-500">
                Modo inteligente: a Alilu escolhe automaticamente o tipo, o tema, o template e o fundo de cada Story.
              </p>
            ) : isStory ? (
              <p className="mt-1 text-xs text-zinc-500">
                Story 9:16 (1080×1920) com o texto grande no centro, longe das bordas cobertas pelo Instagram. Stories não têm legenda e somem depois de 24 horas.
              </p>
            ) : null}
            {isCarousel ? (
              <p className="mt-1 text-xs text-zinc-500">
                Um texto comprido (IA ou escrito à mão) é dividido automaticamente em vários slides — exatamente como o Carrossel automático manual.
              </p>
            ) : null}
          </div>

          {shared ? null : (
          <div>
            <label htmlFor={timeId} className="mb-1 block text-xs font-medium text-zinc-700">
              Horário de publicação
            </label>
            <input
              id={timeId}
              type="time"
              value={day.publishTime}
              onChange={(event) => onChange({ publishTime: event.target.value })}
              className="min-h-11 rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          )}

          <div>
            <label htmlFor={categoryId} className="mb-1 block text-xs font-medium text-zinc-700">
              Tipo de conteúdo (opcional)
            </label>
            <select
              id={categoryId}
              value={day.contentCategory ?? ""}
              onChange={(event) => {
                const category = (event.target.value || null) as AutomationContentCategory | null;
                const patch: Partial<DayFormState> = { contentCategory: category };
                // Sugere um prompt pronto só quando o campo ainda está vazio — nunca apaga o que o usuário escreveu.
                if (category && !day.prompt.trim()) {
                  const suggestion = suggestedPromptFor(category, day.contentType);
                  if (suggestion) patch.prompt = suggestion;
                }
                onChange(patch);
              }}
              className="w-full min-h-11 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Sem categoria</option>
              {CONTENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CONTENT_CATEGORY_LABEL[category]}
                </option>
              ))}
            </select>
          </div>

          {smartDay ? null : (
          <div>
            <span className="mb-1 block text-xs font-medium text-zinc-700">{isStory ? "Como gerar o texto do Story" : "Como gerar a legenda"}</span>
            <div className="flex gap-3 text-sm">
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name={`${radioPrefix}-content-mode`}
                  checked={day.contentMode === "AI"}
                  onChange={() => onChange({ contentMode: "AI" })}
                  className="h-4 w-4 border-zinc-300 text-teal-700"
                />
                Gerar com IA
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name={`${radioPrefix}-content-mode`}
                  checked={day.contentMode === "MANUAL"}
                  onChange={() => onChange({ contentMode: "MANUAL" })}
                  className="h-4 w-4 border-zinc-300 text-teal-700"
                />
                Escrever eu mesmo
              </label>
            </div>
          </div>
          )}

          {isStory && !smartDay && day.contentMode === "MANUAL" ? (
            <div>
              <label htmlFor={visualTextId} className="mb-1 block text-xs font-medium text-zinc-700">
                Texto do Story (opcional)
              </label>
              <textarea
                id={visualTextId}
                value={day.visualText}
                onChange={(event) => onChange({ visualText: event.target.value })}
                rows={3}
                maxLength={MAX_VISUAL_TEXT_LENGTH}
                placeholder="Frase curta, desenhada grande no centro do Story. Deixe em branco para publicar só a imagem."
                className="w-full min-h-[96px] resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm leading-relaxed"
              />
              <p className="mt-1 text-xs text-zinc-500">
                {day.visualText.length}/{MAX_VISUAL_TEXT_LENGTH} — textos curtos ficam maiores e mais legíveis no celular.
              </p>
            </div>
          ) : day.contentMode === "MANUAL" ? (
            <div>
              <label htmlFor={manualCaptionId} className="mb-1 block text-xs font-medium text-zinc-700">
                Legenda final
              </label>
              <textarea
                id={manualCaptionId}
                value={day.manualCaption}
                onChange={(event) => onChange({ manualCaption: event.target.value })}
                rows={4}
                maxLength={2200}
                placeholder="Escreva a legenda exatamente como ela deve ser publicada — nenhuma IA é chamada para este dia."
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-zinc-500">
                {day.manualCaption.length}/2200 — publicada exatamente como escrita, sem passar pela IA.
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor={promptId} className="mb-1 block text-xs font-medium text-zinc-700">
                {smartDay ? "Prompt base" : shared ? "Prompt" : `O que publicar em ${DAY_OF_WEEK_LABEL[day.dayOfWeek]}`}
              </label>
              <textarea
                id={promptId}
                ref={autoResizeTextarea}
                value={day.prompt}
                onChange={(event) => {
                  onChange({ prompt: event.target.value });
                  autoResizeTextarea(event.target);
                }}
                onFocus={(event) => autoResizeTextarea(event.target)}
                rows={6}
                maxLength={800}
                placeholder={
                  smartDay
                    ? "Assunto e tom dos seus Stories. Ex.: Reflexões sobre gratidão, recomeços e autoestima, em tom acolhedor. A Alilu varia o tipo e o formato a cada Story."
                    : isStory
                    ? `Descreva o texto curto do Story. Ex.: Hoje é {{diaSemana}}. Crie uma frase motivacional curta para começar bem o dia. Máximo 20 palavras, sem hashtags.`
                    : day.contentType === "POST"
                    ? shared
                      ? "Descreva o conteúdo. Ex.: Crie uma reflexão motivacional sobre persistência, família, amizade, fé e superação, com tom leve, inspirador e humano."
                      : `Descreva o conteúdo que deve ser criado para este dia. Ex.: Crie uma frase motivacional para ${DAY_OF_WEEK_LABEL[day.dayOfWeek].toLowerCase()} com tom leve, inspirador e humano.`
                    : isCarousel
                      ? `Descreva o carrossel que deve ser criado${shared ? "" : " para este dia"}. Ex.: Conte, em vários parágrafos, uma história inspiradora sobre superação${shared ? "" : `, para ${DAY_OF_WEEK_LABEL[day.dayOfWeek].toLowerCase()}`} — a IA escreve um texto comprido, dividido automaticamente entre os slides.`
                      : `Descreva o Reel que deve ser criado para este dia. Ex.: Crie um Reel curto mostrando uma dica sobre ferramentas online, com tom leve e direto.`
                }
                className="w-full min-h-[144px] resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm leading-relaxed"
              />
              <p className="mt-1 text-xs text-zinc-500">
                {day.prompt.length}/800 —{" "}
                {shared
                  ? "o mesmo prompt vale para todos os dias e horários; {{diaSemana}}, {{data}} e {{hora}} são preenchidos a cada execução."
                  : `a IA usa exatamente ${DAY_OF_WEEK_LABEL[day.dayOfWeek]} como o dia deste conteúdo, nunca outro dia.`}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Variáveis: {PROMPT_VARIABLES.map((name) => `{{${name}}}`).join(" ")}
              </p>
            </div>
          )}

          {isStory && !smartDay ? (
            <div className="rounded-md border border-teal-200 bg-teal-50/40 p-3 space-y-3">
              <div>
                <label htmlFor={overlayId} className="mb-1 block text-xs font-medium text-zinc-700">
                  Véu sobre a foto (legibilidade do texto)
                </label>
                <select
                  id={overlayId}
                  value={day.overlayOpacity === null ? "" : String(day.overlayOpacity)}
                  onChange={(event) => onChange({ overlayOpacity: event.target.value === "" ? null : Number(event.target.value) })}
                  className="w-full min-h-11 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Padrão (20%)</option>
                  {OVERLAY_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {Math.round(level * 100)}%{level === 0.2 ? " (recomendado)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <ColorSwatchInput
                  id={colorId}
                  label="Cor do texto"
                  value={day.visualTextColor ?? "#ffffff"}
                  onChange={(value) => onChange({ visualTextColor: value })}
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={handlePreviewStory}
                  disabled={storyPreviewLoading || !previewImageMediaId || (day.contentMode === "AI" && !day.prompt.trim())}
                  className="min-h-9 rounded-md border border-teal-300 bg-white px-3 py-1.5 text-xs font-medium text-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {storyPreviewLoading ? "Gerando prévia…" : day.contentMode === "AI" ? "Gerar prévia (executa o prompt, não publica)" : "Gerar prévia"}
                </button>
                {!previewImageMediaId ? (
                  <span className="ml-2 text-xs text-zinc-500">Selecione uma imagem de fundo (padrão da automação ou deste horário).</span>
                ) : null}
                {storyPreviewError ? <p className="mt-1 text-xs text-red-600">{storyPreviewError}</p> : null}
                {storyPreviewText && day.contentMode === "AI" ? (
                  <p className="mt-2 text-xs text-zinc-600">Texto gerado nesta prévia: “{storyPreviewText}”</p>
                ) : null}
                {storyPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- prévia é um data: URL gerado no servidor, nunca uma imagem otimizável pelo next/image.
                  <img
                    src={storyPreviewUrl}
                    alt={`Prévia do Story de ${DAY_OF_WEEK_LABEL[day.dayOfWeek]} às ${day.publishTime}`}
                    className="mt-2 w-full max-w-[220px] rounded-md border border-zinc-200 shadow-sm"
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          {isAutoTemplateImage ? (
            <div className="rounded-md border border-teal-200 bg-teal-50/40 p-3 space-y-3">
              <div>
                <label htmlFor={templateId} className="mb-1 block text-xs font-medium text-zinc-700">
                  Template da arte
                </label>
                <select
                  id={templateId}
                  value={day.templateId ?? ""}
                  onChange={(event) => onChange({ templateId: event.target.value || null })}
                  className="w-full min-h-11 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Padrão (Motivação Clean — foto inteira + frase central)</option>
                  {/* "Somente imagem" fica de fora: aqui a arte existe justamente para levar o texto gerado. */}
                  {POST_TEMPLATES.filter((template) => !template.imageOnly).map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor={overlayId} className="mb-1 block text-xs font-medium text-zinc-700">
                  Véu sobre a foto (legibilidade do texto)
                </label>
                <select
                  id={overlayId}
                  value={day.overlayOpacity === null ? "" : String(day.overlayOpacity)}
                  onChange={(event) => onChange({ overlayOpacity: event.target.value === "" ? null : Number(event.target.value) })}
                  className="w-full min-h-11 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Padrão (20%)</option>
                  {OVERLAY_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {Math.round(level * 100)}%{level === 0.2 ? " (recomendado)" : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-zinc-500">
                  Um véu escuro leve sobre a foto, só para o texto ficar legível — não escurece a imagem em si. 0% mostra a foto sem nenhum véu.
                </p>
              </div>

              <div>
                <ColorSwatchInput
                  id={colorId}
                  label="Cor do texto"
                  value={day.visualTextColor ?? "#ffffff"}
                  onChange={(value) => onChange({ visualTextColor: value })}
                />
                <p className="mt-1 text-xs text-zinc-500">Sem faixa atrás do texto — escolha uma cor com bom contraste sobre a sua foto. Branco é o padrão.</p>
              </div>

              {day.contentMode === "MANUAL" ? (
                <div>
                  <label htmlFor={visualTextId} className="mb-1 block text-xs font-medium text-zinc-700">
                    {isCarousel ? "Texto do carrossel (será dividido em vários slides)" : "Texto sobre a imagem"}
                  </label>
                  <textarea
                    id={visualTextId}
                    ref={autoResizeTextarea}
                    value={day.visualText}
                    onChange={(event) => {
                      onChange({ visualText: event.target.value });
                      autoResizeTextarea(event.target);
                    }}
                    onFocus={(event) => autoResizeTextarea(event.target)}
                    rows={isCarousel ? 10 : 3}
                    maxLength={visualTextMaxLength}
                    placeholder={
                      isCarousel
                        ? "Cole ou escreva um texto comprido — ele é dividido automaticamente entre os slides do carrossel, igual ao Carrossel automático manual."
                        : "Frase curta desenhada sobre a foto — diferente da legenda."
                    }
                    className={`w-full resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm leading-relaxed ${isCarousel ? "min-h-[220px]" : "min-h-[96px]"}`}
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    {day.visualText.length}/{visualTextMaxLength}
                  </p>

                  <div className="mt-2">
                    {isCarousel ? (
                      <>
                        <button
                          type="button"
                          onClick={handlePreviewCarousel}
                          disabled={carouselPreviewLoading || !previewImageMediaId || !day.visualText.trim()}
                          className="min-h-9 rounded-md border border-teal-300 bg-white px-3 py-1.5 text-xs font-medium text-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {carouselPreviewLoading ? "Gerando prévia…" : "Visualizar carrossel"}
                        </button>
                        {!previewImageMediaId ? (
                          <span className="ml-2 text-xs text-zinc-500">Selecione uma imagem (padrão da automação ou deste dia) para visualizar.</span>
                        ) : null}
                        {carouselPreviewError ? <p className="mt-1 text-xs text-red-600">{carouselPreviewError}</p> : null}
                        {carouselPreviewOverflow ? (
                          <p className="mt-2 text-xs text-amber-700">
                            O texto não coube inteiro nos slides — a parte a mais não vai ser publicada. Encurte o texto ou aceite que só o início será usado.
                          </p>
                        ) : null}
                        {carouselPreviewSlides && carouselPreviewSlides.length > 0 ? (
                          <div className="mt-2 flex gap-2 overflow-x-auto">
                            {carouselPreviewSlides.map((slideUrl, index) => (
                              // eslint-disable-next-line @next/next/no-img-element -- prévia é um data: URL gerado no servidor, nunca uma imagem otimizável pelo next/image.
                              <img
                                key={index}
                                src={slideUrl}
                                alt={`Prévia do slide ${index + 1} de ${DAY_OF_WEEK_LABEL[day.dayOfWeek]}`}
                                className="h-40 w-auto flex-none rounded-md border border-zinc-200 shadow-sm"
                              />
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handlePreview}
                          disabled={previewLoading || !previewImageMediaId || !day.visualText.trim()}
                          className="min-h-9 rounded-md border border-teal-300 bg-white px-3 py-1.5 text-xs font-medium text-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {previewLoading ? "Gerando prévia…" : "Visualizar arte"}
                        </button>
                        {!previewImageMediaId ? (
                          <span className="ml-2 text-xs text-zinc-500">Selecione uma imagem (padrão da automação ou deste dia) para visualizar.</span>
                        ) : null}
                        {previewError ? <p className="mt-1 text-xs text-red-600">{previewError}</p> : null}
                        {previewMeta ? <p className="mt-2 text-xs text-zinc-500">{previewMeta}</p> : null}
                        {previewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- prévia é um data: URL gerado no servidor, nunca uma imagem otimizável pelo next/image.
                          <img
                            src={previewUrl}
                            alt={`Prévia da arte de ${DAY_OF_WEEK_LABEL[day.dayOfWeek]}`}
                            className="mt-2 w-full max-w-[340px] rounded-md border border-zinc-200 shadow-sm"
                          />
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-600">
                  {isCarousel
                    ? "A IA também gera o texto comprido dividido entre os slides do carrossel, a partir do prompt acima. A prévia exata aparece depois da primeira geração."
                    : "A IA também gera o texto curto desenhado sobre a imagem, a partir do prompt acima. A prévia exata aparece depois da primeira geração."}
                </p>
              )}
            </div>
          ) : null}

          {smartDay ? null : (
          <div>
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700">
              <input
                type="checkbox"
                checked={overrideMedia}
                onChange={(event) => {
                  setOverrideMedia(event.target.checked);
                  if (!event.target.checked) onChange({ imageMediaId: null, videoMediaId: null });
                }}
                className="h-4 w-4 rounded border-zinc-300 text-teal-700"
              />
              Usar {day.contentType === "POST" || isCarousel || isStory ? "uma imagem" : "um vídeo"} diferente do padrão da automação {shared ? "nesta automação" : `neste ${day.slotIndex > 0 ? "horário" : "dia"}`}
            </label>
            {overrideMedia ? (
              <div className="mt-2">
                {day.contentType === "POST" || isCarousel || isStory ? (
                  <MediaPicker
                    userId={userId}
                    mediaType="image"
                    value={day.imageMediaId}
                    onChange={(mediaId) => onChange({ imageMediaId: mediaId })}
                  />
                ) : (
                  <MediaPicker
                    userId={userId}
                    mediaType="video"
                    value={day.videoMediaId}
                    onChange={(mediaId) => onChange({ videoMediaId: mediaId })}
                  />
                )}
              </div>
            ) : null}
          </div>
          )}
        </div>
      ) : null}
    </fieldset>
  );
}
