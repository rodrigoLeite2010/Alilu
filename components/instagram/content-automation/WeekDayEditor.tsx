"use client";

import { useId, useState } from "react";
import { DAY_OF_WEEK_LABEL, type AutomationContentMode, type AutomationContentType, type DayOfWeek } from "@/lib/content-automation/backend/automation-types";
import { MediaPicker } from "./MediaPicker";

export interface DayFormState {
  dayOfWeek: DayOfWeek;
  enabled: boolean;
  contentType: AutomationContentType;
  /** "AI" (padrão) gera a legenda a partir de `prompt`; "MANUAL" publica `manualCaption` tal como escrito, sem chamar IA. */
  contentMode: AutomationContentMode;
  prompt: string;
  manualCaption: string;
  publishTime: string;
  imageMediaId: string | null;
  videoMediaId: string | null;
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
  onChange,
}: {
  userId: string;
  day: DayFormState;
  onChange: (patch: Partial<DayFormState>) => void;
}) {
  const [overrideMedia, setOverrideMedia] = useState(Boolean(day.imageMediaId || day.videoMediaId));
  const checkboxId = useId();
  const promptId = useId();
  const manualCaptionId = useId();
  const timeId = useId();

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
                O que publicar
              </label>
              <textarea
                id={promptId}
                value={day.prompt}
                onChange={(event) => onChange({ prompt: event.target.value })}
                rows={3}
                maxLength={800}
                placeholder={
                  day.contentType === "POST"
                    ? "Ex.: Crie uma dica curta de produtividade para pequenos empresários, tom profissional, com uma chamada para ação."
                    : "Ex.: Crie um Reel curto mostrando uma dica sobre ferramentas online."
                }
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
          )}

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
