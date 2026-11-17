"use client";

import { useState } from "react";
import { inputClass, labelClass } from "@/components/video-queue/QueueSettingsFields";
import { LICENSE_LABEL, SOURCE_TYPE_LABEL, type RadarSourceType, type SourceLicense } from "@/lib/viral-radar/types";

export interface SourceDraft {
  type: RadarSourceType;
  label: string;
  enabled: boolean;
  config: { url?: string; channelId?: string };
  license: SourceLicense;
  licenseScope: { edit: boolean; republish: boolean; commercial: boolean };
  licenseNote: string;
  licenseEvidenceUrl: string;
  trustedForFacts: boolean;
  rightsConfirmed: boolean;
}

export const emptySource = (type: RadarSourceType = "YOUTUBE_SEARCH"): SourceDraft => ({
  type,
  label: "",
  enabled: true,
  config: {},
  license: "NONE",
  licenseScope: { edit: false, republish: false, commercial: false },
  licenseNote: "",
  licenseEvidenceUrl: "",
  trustedForFacts: false,
  rightsConfirmed: false,
});

export type ConnectorMap = Partial<Record<RadarSourceType, { available: boolean; reason: string | null }>>;

const SEARCH_TYPES: RadarSourceType[] = ["YOUTUBE_SEARCH", "INSTAGRAM_HASHTAG", "TIKTOK"];

/** Uma fonte: tipo, endereço e (para canal/feed) a declaração de direitos sobre os vídeos. */
export function SourceEditor({
  initial,
  connectors,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: SourceDraft;
  connectors: ConnectorMap;
  submitLabel: string;
  onSubmit: (draft: SourceDraft) => Promise<string | null> | string | null;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<SourceDraft>(initial ?? emptySource());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof SourceDraft>(key: K, value: SourceDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const availability = connectors[draft.type];
  const canLicense = !SEARCH_TYPES.includes(draft.type);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const problem = await onSubmit(draft);
      if (problem) setError(problem);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Tipo de fonte
          <select
            className={inputClass}
            value={draft.type}
            onChange={(event) => {
              const type = event.target.value as RadarSourceType;
              setDraft((current) => ({ ...current, type, config: {}, license: SEARCH_TYPES.includes(type) ? "NONE" : current.license }));
            }}
          >
            {(Object.keys(SOURCE_TYPE_LABEL) as RadarSourceType[]).map((type) => (
              <option key={type} value={type}>
                {SOURCE_TYPE_LABEL[type]}
                {connectors[type] && !connectors[type]!.available ? " — pendente" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Nome (opcional)
          <input className={inputClass} value={draft.label} maxLength={80} onChange={(event) => set("label", event.target.value)} />
        </label>
        {draft.type === "RSS" ? (
          <label className={`${labelClass} sm:col-span-2`}>
            Endereço do feed RSS/Atom
            <input className={inputClass} value={draft.config.url ?? ""} placeholder="https://…/feed.xml" onChange={(event) => set("config", { url: event.target.value })} />
          </label>
        ) : null}
        {draft.type === "YOUTUBE_CHANNEL" ? (
          <label className={`${labelClass} sm:col-span-2`}>
            ID do canal (começa com UC)
            <input className={inputClass} value={draft.config.channelId ?? ""} placeholder="UC…" onChange={(event) => set("config", { channelId: event.target.value.trim() })} />
          </label>
        ) : null}
      </div>
      {availability && !availability.available ? <p className="rounded bg-amber-50 p-2 text-xs text-amber-800">{availability.reason}</p> : null}
      {draft.type === "YOUTUBE_SEARCH" ? <p className="text-xs text-zinc-600">Usa as palavras-chave do radar. Resultados são de terceiros: servem de referência ou aguardam a sua aprovação com licença.</p> : null}

      {canLicense ? (
        <div className="space-y-2 rounded-md bg-white p-3 ring-1 ring-zinc-200">
          <label className={labelClass}>
            Direitos sobre os vídeos desta fonte
            <select className={inputClass} value={draft.license} onChange={(event) => set("license", event.target.value as SourceLicense)}>
              {(Object.keys(LICENSE_LABEL) as SourceLicense[]).map((license) => (
                <option key={license} value={license}>
                  {LICENSE_LABEL[license]}
                </option>
              ))}
            </select>
          </label>
          {draft.license !== "NONE" ? (
            <>
              <div className="flex flex-wrap gap-4 text-sm text-zinc-800">
                {(
                  [
                    ["edit", "Edição"],
                    ["republish", "Republicação"],
                    ["commercial", "Uso comercial"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input type="checkbox" checked={draft.licenseScope[key]} onChange={(event) => set("licenseScope", { ...draft.licenseScope, [key]: event.target.checked })} />
                    {label}
                  </label>
                ))}
              </div>
              <label className={labelClass}>
                Descrição da licença / comprovação
                <textarea className={`${inputClass} h-16`} value={draft.licenseNote} onChange={(event) => set("licenseNote", event.target.value)} placeholder="Ex.: contrato nº…, e-mail do titular em…" />
              </label>
              <label className={labelClass}>
                Link da comprovação (opcional)
                <input className={inputClass} value={draft.licenseEvidenceUrl} onChange={(event) => set("licenseEvidenceUrl", event.target.value)} />
              </label>
              <label className="flex items-start gap-2 text-sm text-zinc-800">
                <input type="checkbox" className="mt-1" checked={draft.rightsConfirmed} onChange={(event) => set("rightsConfirmed", event.target.checked)} />
                Declaro que tenho os direitos indicados sobre os vídeos desta fonte. A importação automática só acontece com edição, republicação e uso comercial marcados.
              </label>
            </>
          ) : null}
          {draft.type === "RSS" ? (
            <label className="flex items-start gap-2 text-sm text-zinc-800">
              <input type="checkbox" className="mt-1" checked={draft.trustedForFacts} onChange={(event) => set("trustedForFacts", event.target.checked)} />
              Fonte oficial/confiável para checar fatos dos roteiros originais
            </label>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={submit} className="min-h-10 rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Salvando…" : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="min-h-10 rounded-md px-3 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-300">
            Cancelar
          </button>
        ) : null}
      </div>
    </div>
  );
}
