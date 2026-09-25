"use client";

import { useId, useRef, useState } from "react";
import { DAY_OF_WEEK_LABEL, type AutomationContentMode, type AutomationContentType, type DayOfWeek, type ImageMode } from "@/lib/content-automation/backend/automation-types";
import { POST_TEMPLATES } from "@/lib/instagram/templates";
import { MediaPicker } from "./MediaPicker";

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
  publishTime: string;
  imageMediaId: string | null;
  videoMediaId: string | null;
}

const OVERLAY_LEVELS = [0, 0.1, 0.2, 0.3, 0.4] as const;

/** Textarea que cresce sozinha com o conteúdo (Parte 6: "não cortar visualmente o conteúdo"), sem depender de libs externas. */
function autoResize(el: HTMLTextAreaElement | null): void {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
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
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const visualTextRef = useRef<HTMLTextAreaElement | null>(null);
  const checkboxId = useId();
  const promptId = useId();
  const manualCaptionId = useId();
  const visualTextId = useId();
  const templateId = useId();
  const overlayId = useId();
  const timeId = useId();
  const isAutoTemplatePost = imageMode === "AUTO_TEMPLATE" && day.contentType === "POST";
  const previewImageMediaId = day.imageMediaId ?? defaultImageMediaId;

  async function handlePreview() {
    if (!previewImageMediaId || !day.visualText.trim()) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const response = await fetch("/api/content-automation/media/preview-art", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageMediaId: previewImageMediaId,
          templateId: day.templateId,
          visualText: day.visualText,
          overlayOpacity: day.overlayOpacity,
        }),
      });
      const payload = (await response.json()) as { dataUrl?: string; error?: string };
      if (!response.ok || !payload.dataUrl) {
        throw new Error(payload.error || "Não foi possível gerar a prévia.");
      }
      setPreviewUrl(payload.dataUrl);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Não foi possível gerar a prévia.");
    } finally {
      setPreviewLoading(false);
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
              {(["POST", "REEL"] as AutomationContentType[]).map((type) => (
                <label key={type} className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    name={`${day.dayOfWeek}-content-type`}
                    checked={day.contentType === type}
                    onChange={() => onChange({ contentType: type })}
                    className="h-4 w-4 border-zinc-300 text-teal-700"
                  />
                  {type === "POST" ? "Post" : "Reel"}
                </label>
              ))}
            </div>
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
                ref={promptRef}
                value={day.prompt}
                onChange={(event) => {
                  onChange({ prompt: event.target.value });
                  autoResize(event.target);
                }}
                onFocus={(event) => autoResize(event.target)}
                rows={6}
                maxLength={800}
                placeholder={
                  day.contentType === "POST"
                    ? `Descreva o conteúdo que deve ser criado para este dia. Ex.: Crie uma frase motivacional para ${DAY_OF_WEEK_LABEL[day.dayOfWeek].toLowerCase()} com tom leve, inspirador e humano.`
                    : `Descreva o Reel que deve ser criado para este dia. Ex.: Crie um Reel curto mostrando uma dica sobre ferramentas online, com tom leve e direto.`
                }
                className="w-full min-h-[144px] resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm leading-relaxed"
              />
              <p className="mt-1 text-xs text-zinc-500">
                {day.prompt.length}/800 — a IA usa exatamente {DAY_OF_WEEK_LABEL[day.dayOfWeek]} como o dia deste conteúdo, nunca outro dia.
              </p>
            </div>
          )}

          {isAutoTemplatePost ? (
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

              {day.contentMode === "MANUAL" ? (
                <div>
                  <label htmlFor={visualTextId} className="mb-1 block text-xs font-medium text-zinc-700">
                    Texto sobre a imagem
                  </label>
                  <textarea
                    id={visualTextId}
                    ref={visualTextRef}
                    value={day.visualText}
                    onChange={(event) => {
                      onChange({ visualText: event.target.value });
                      autoResize(event.target);
                    }}
                    onFocus={(event) => autoResize(event.target)}
                    rows={3}
                    maxLength={120}
                    placeholder="Frase curta desenhada sobre a foto — diferente da legenda."
                    className="w-full min-h-[96px] resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm leading-relaxed"
                  />
                  <p className="mt-1 text-xs text-zinc-500">{day.visualText.length}/120</p>

                  <div className="mt-2">
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
                    {previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- prévia é um data: URL gerado no servidor, nunca uma imagem otimizável pelo next/image.
                      <img
                        src={previewUrl}
                        alt={`Prévia da arte de ${DAY_OF_WEEK_LABEL[day.dayOfWeek]}`}
                        className="mt-2 max-w-[220px] rounded-md border border-zinc-200 shadow-sm"
                      />
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-600">A IA também gera o texto curto desenhado sobre a imagem, a partir do prompt acima. A prévia exata aparece depois da primeira geração.</p>
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
              Usar {day.contentType === "POST" ? "uma imagem" : "um vídeo"} diferente do padrão da automação neste dia
            </label>
            {overrideMedia ? (
              <div className="mt-2">
                {day.contentType === "POST" ? (
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
