"use client";

import { composeRadarCaption, normalizeHashtags } from "@/lib/instagram-radar/captions";
import { radarInputClass, radarLabelClass } from "./RadarScheduleFields";

export interface RadarCaptionValue {
  captionTemplate: string;
  hashtags: string;
  missingCaptionPolicy: "DEFAULT" | "REVIEW";
  notReadyPolicy: "WAIT" | "NEXT_READY";
}

export const DEFAULT_RADAR_CAPTION_VALUE: RadarCaptionValue = {
  captionTemplate: "{titulo}",
  hashtags: "",
  missingCaptionPolicy: "DEFAULT",
  notReadyPolicy: "NEXT_READY",
};

/** Legenda padrão, hashtags, regra para vídeo sem legenda e regra para vídeo não pronto — com prévia. */
export function RadarCaptionFields({ value, onChange, radarName }: { value: RadarCaptionValue; onChange: (next: RadarCaptionValue) => void; radarName: string }) {
  const set = <K extends keyof RadarCaptionValue>(key: K, next: RadarCaptionValue[K]) => onChange({ ...value, [key]: next });
  const sample = composeRadarCaption({
    ownCaption: null,
    title: "Descrição real do vídeo",
    template: value.captionTemplate,
    hashtags: value.hashtags,
    radarName,
    numero: 1,
    total: 10,
  });
  return (
    <div className="space-y-4">
      <label className={radarLabelClass}>
        Legenda padrão
        <textarea className={`${radarInputClass} h-24`} maxLength={2200} value={value.captionTemplate} onChange={(event) => set("captionTemplate", event.target.value)} />
        <span className="mt-1 block text-xs font-normal text-zinc-500">
          Variáveis: {"{titulo}"} (descrição do vídeo), {"{tema}"} (nome do radar), {"{numero}"} e {"{total}"}. Cada vídeo pode ter legenda própria — escrita por você ou gerada por IA e revisada no painel.
        </span>
      </label>
      <label className={radarLabelClass}>
        Hashtags (acrescentadas a todas as legendas)
        <input className={radarInputClass} value={value.hashtags} onChange={(event) => set("hashtags", event.target.value)} onBlur={() => set("hashtags", normalizeHashtags(value.hashtags))} placeholder="#gta6 #games" />
      </label>
      <fieldset className="space-y-1 text-sm">
        <legend className="font-medium text-zinc-800">Vídeo sem legenda própria</legend>
        <label className="flex items-start gap-2">
          <input type="radio" name="radar-missing-caption" className="mt-1" checked={value.missingCaptionPolicy === "DEFAULT"} onChange={() => set("missingCaptionPolicy", "DEFAULT")} />
          Usar a legenda padrão (texto neutro).
        </label>
        <label className="flex items-start gap-2">
          <input type="radio" name="radar-missing-caption" className="mt-1" checked={value.missingCaptionPolicy === "REVIEW"} onChange={() => set("missingCaptionPolicy", "REVIEW")} />
          Enviar para revisão — só publica depois que eu revisar a legenda do vídeo.
        </label>
      </fieldset>
      <fieldset className="space-y-1 text-sm">
        <legend className="font-medium text-zinc-800">Se um vídeo falhar ou ainda não estiver pronto</legend>
        <label className="flex items-start gap-2">
          <input type="radio" name="radar-not-ready" className="mt-1" checked={value.notReadyPolicy === "NEXT_READY"} onChange={() => set("notReadyPolicy", "NEXT_READY")} />
          Usar o próximo vídeo pronto (a fila não para).
        </label>
        <label className="flex items-start gap-2">
          <input type="radio" name="radar-not-ready" className="mt-1" checked={value.notReadyPolicy === "WAIT"} onChange={() => set("notReadyPolicy", "WAIT")} />
          Aguardar o vídeo (mantém a ordem exata).
        </label>
      </fieldset>
      <div className="rounded-md bg-zinc-50 p-3 text-xs text-zinc-700">
        <p className="font-medium text-zinc-800">Prévia da legenda</p>
        <p className="mt-1 whitespace-pre-wrap">{sample || "(vazia)"}</p>
      </div>
    </div>
  );
}
