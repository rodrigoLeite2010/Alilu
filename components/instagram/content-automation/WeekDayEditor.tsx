"use client";

import { useId, useState } from "react";
import {
  DAY_OF_WEEK_LABEL,
  MAX_VISUAL_TEXT_LENGTH,
  MAX_CAROUSEL_VISUAL_TEXT_LENGTH,
  type AutomationContentMode,
  type AutomationContentType,
  type DayOfWeek,
  type ImageMode,
} from "@/lib/content-automation/backend/automation-types";
import { POST_TEMPLATES } from "@/lib/instagram/templates";
import { MediaPicker } from "./MediaPicker";
import { autoResizeTextarea } from "./textarea-utils";
import { ColorSwatchInput } from "@/components/tools/instagram-post-creator/ColorSwatchInput";

export interface DayFormState {
  dayOfWeek: DayOfWeek;
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
}: {
  userId: string;
  day: DayFormState;
  /** Modo de imagem da automação (não do dia) — controla se aparece o seletor de template/texto visual. */
  imageMode: ImageMode;
  /** Imagem padrão da automação (usada quando o dia não tem uma própria) — só para a prévia da arte saber qual foto usar. */
  defaultImageMediaId?: string | null;
  onChange: (patch: Partial<DayFormState>) => void;
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
  const isCarousel = day.contentType === "CAROUSEL";
  const isAutoTemplateImage = imageMode === "AUTO_TEMPLATE" && (day.contentType === "POST" || isCarousel);
  const previewImageMediaId = day.imageMediaId ?? defaultImageMediaId;
  const visualTextMaxLength = isCarousel ? MAX_CAROUSEL_VISUAL_TEXT_LENGTH : MAX_VISUAL_TEXT_LENGTH;

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
    <fieldset className={`rounded-lg border p-4 transition-colors ${day.enabled ? "border-teal-300 bg-teal-50/30" : "border-zinc-200"}`}>
      <legend className="px-1 text-sm font-semibold text-zinc-900">{DAY_OF_WEEK_LABEL[day.dayOfWeek]}</legend>

      <div className="flex items-center gap-2">
        <input
          id={checkboxId}
          type="checkbox"
          checked={day.enabled}
          onChange={(event) => onChange({ enabled: event.target.checked })}
          className="h-4 w-4 rounded border-zinc-300 text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        />
        <label htmlFor={checkboxId} className="text-sm text-zinc-800">
          Publicar neste dia
        </label>
      </div>

      {day.enabled ? (
        <div className="mt-3 space-y-3">
          <div>
            <span className="mb-1 block text-xs font-medium text-zinc-700">Formato</span>
            <div className="flex gap-3 text-sm">
              {(
                imageMode === "AUTO_TEMPLATE"
                  ? (["POST", "CAROUSEL", "REEL"] as AutomationContentType[])
                  : (["POST", "REEL"] as AutomationContentType[])
              ).map((type) => (
                <label key={type} className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    name={`${day.dayOfWeek}-content-type`}
                    checked={day.contentType === type}
                    onChange={() => onChange({ contentType: type })}
                    className="h-4 w-4 border-zinc-300 text-teal-700"
                  />
                  {type === "POST" ? "Post" : type === "CAROUSEL" ? "Carrossel" : "Reel"}
                </label>
              ))}
            </div>
            {isCarousel ? (
              <p className="mt-1 text-xs text-zinc-500">
                Um texto comprido (IA ou escrito à mão) é dividido automaticamente em vários slides — exatamente como o Carrossel automático manual.
              </p>
            ) : null}
          </div>

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

          <div>
            <span className="mb-1 block text-xs font-medium text-zinc-700">Como gerar a legenda</span>
            <div className="flex gap-3 text-sm">
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name={`${day.dayOfWeek}-content-mode`}
                  checked={day.contentMode === "AI"}
                  onChange={() => onChange({ contentMode: "AI" })}
                  className="h-4 w-4 border-zinc-300 text-teal-700"
                />
                Gerar com IA
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name={`${day.dayOfWeek}-content-mode`}
                  checked={day.contentMode === "MANUAL"}
                  onChange={() => onChange({ contentMode: "MANUAL" })}
                  className="h-4 w-4 border-zinc-300 text-teal-700"
                />
                Escrever eu mesmo
              </label>
            </div>
          </div>

          {day.contentMode === "MANUAL" ? (
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
                O que publicar em {DAY_OF_WEEK_LABEL[day.dayOfWeek]}
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
                  day.contentType === "POST"
                    ? `Descreva o conteúdo que deve ser criado para este dia. Ex.: Crie uma frase motivacional para ${DAY_OF_WEEK_LABEL[day.dayOfWeek].toLowerCase()} com tom leve, inspirador e humano.`
                    : isCarousel
                      ? `Descreva o carrossel que deve ser criado para este dia. Ex.: Conte, em vários parágrafos, uma história inspiradora sobre superação, para ${DAY_OF_WEEK_LABEL[day.dayOfWeek].toLowerCase()} — a IA escreve um texto comprido, dividido automaticamente entre os slides.`
                      : `Descreva o Reel que deve ser criado para este dia. Ex.: Crie um Reel curto mostrando uma dica sobre ferramentas online, com tom leve e direto.`
                }
                className="w-full min-h-[144px] resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm leading-relaxed"
              />
              <p className="mt-1 text-xs text-zinc-500">
                {day.prompt.length}/800 — a IA usa exatamente {DAY_OF_WEEK_LABEL[day.dayOfWeek]} como o dia deste conteúdo, nunca outro dia.
              </p>
            </div>
          )}

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
                  {POST_TEMPLATES.map((template) => (
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
              Usar {day.contentType === "POST" || isCarousel ? "uma imagem" : "um vídeo"} diferente do padrão da automação neste dia
            </label>
            {overrideMedia ? (
              <div className="mt-2">
                {day.contentType === "POST" || isCarousel ? (
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
        </div>
      ) : null}
    </fieldset>
  );
}
