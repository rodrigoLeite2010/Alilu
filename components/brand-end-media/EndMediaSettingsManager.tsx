"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  END_MEDIA_MAX_VIDEO_SECONDS,
  carouselImageRatioWarning,
  isVideoSlot,
  type EndMediaSlot,
  type EndMediaSummaryDto,
} from "@/lib/brand-end-media/end-media-config";
import { deleteEndMediaFile, saveEndMediaSettingsRequest, uploadEndMediaFile } from "@/lib/brand-end-media/end-media-client";

function MediaPreview({ slot, summary }: { slot: EndMediaSlot; summary: EndMediaSummaryDto }) {
  const asset = summary.assets[slot];
  if (!asset) return <div className="flex h-40 w-28 items-center justify-center rounded-md border border-dashed border-zinc-300 text-xs text-zinc-400">Sem arquivo</div>;
  return isVideoSlot(slot) ? (
    <video src={asset.url} className="h-40 w-auto rounded-md bg-black" controls muted playsInline preload="metadata" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={asset.url} alt="Prévia da mídia final" className="h-40 w-auto rounded-md border border-zinc-200 object-contain" />
  );
}

function AssetSlot({
  slot,
  label,
  hint,
  summary,
  busy,
  onUpload,
  onDelete,
}: {
  slot: EndMediaSlot;
  label: string;
  hint: string;
  summary: EndMediaSummaryDto;
  busy: string | null;
  onUpload: (slot: EndMediaSlot, file: File) => void;
  onDelete: (slot: EndMediaSlot) => void;
}) {
  const asset = summary.assets[slot];
  const warning = slot === "CAROUSEL_IMAGE" && asset ? carouselImageRatioWarning(asset.width, asset.height) : null;
  return (
    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
      <MediaPreview slot={slot} summary={summary} />
      <div className="flex-1 text-sm">
        <p className="font-medium text-zinc-800">{label}</p>
        <p className="text-xs text-zinc-500">{hint}</p>
        {asset ? (
          <p className="mt-1 text-xs text-zinc-500">
            {asset.width}×{asset.height}
            {asset.durationSeconds ? ` · ${asset.durationSeconds.toFixed(1)}s` : ""} · {(asset.fileSizeBytes / 1024 / 1024).toFixed(1)} MB
          </p>
        ) : null}
        {warning ? <p className="mt-1 text-xs text-amber-700">{warning}</p> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <label className={`inline-flex cursor-pointer items-center rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 ${busy ? "pointer-events-none opacity-60" : ""}`}>
            {busy === slot ? "Enviando…" : asset ? "Alterar" : "Enviar arquivo"}
            <input
              type="file"
              className="sr-only"
              accept={isVideoSlot(slot) ? "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" : "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"}
              disabled={Boolean(busy)}
              onClick={(event) => {
                event.currentTarget.value = "";
              }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUpload(slot, file);
              }}
            />
          </label>
          {asset ? (
            <Button type="button" variant="ghost" disabled={Boolean(busy)} onClick={() => onDelete(slot)}>
              Excluir
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-zinc-900">
      <input type="checkbox" className="h-4 w-4" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

export function EndMediaSettingsManager({ userId, initialSummary }: { userId: string; initialSummary: EndMediaSummaryDto }) {
  const [summary, setSummary] = useState(initialSummary);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const settings = summary.settings;

  async function run(key: string, action: () => Promise<EndMediaSummaryDto>, done?: string) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      setSummary(await action());
      if (done) setNotice(done);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(null);
    }
  }

  const save = (patch: Record<string, unknown>) => run("settings", () => saveEndMediaSettingsRequest(patch), "Configuração salva.");
  const upload = (slot: EndMediaSlot, file: File) =>
    run(slot, () => uploadEndMediaFile(userId, slot, file), isVideoSlot(slot) ? "Vídeo salvo e preparado para os Reels." : "Imagem salva.");
  const remove = (slot: EndMediaSlot) => run(slot, () => deleteEndMediaFile(slot), "Mídia removida.");

  const card = "rounded-lg border border-zinc-200 bg-white p-4 sm:p-5";
  return (
    <div className="space-y-5">
      {error ? <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}

      <section className={card}>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Carrossel</h2>
        <div className="mt-2">
          <Toggle
            label="Usar imagem final padrão (entra como último slide)"
            checked={settings.carouselEnabled}
            disabled={Boolean(busy) || !summary.assets.CAROUSEL_IMAGE}
            onChange={(value) => save({ carouselEnabled: value })}
          />
        </div>
        <AssetSlot slot="CAROUSEL_IMAGE" label="Imagem final" hint="JPG, PNG ou WebP. Recomendado 4:5 (1080×1350)." summary={summary} busy={busy} onUpload={upload} onDelete={remove} />
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Reels</h2>
        <div className="mt-2 space-y-2">
          <Toggle
            label="Usar encerramento padrão"
            checked={settings.reelEnabled}
            disabled={Boolean(busy) || (!summary.assets.REEL_VIDEO && !summary.assets.REEL_IMAGE)}
            onChange={(value) => save({ reelEnabled: value })}
          />
          <fieldset className="flex flex-wrap gap-4 text-sm text-zinc-700">
            <legend className="sr-only">Tipo do encerramento</legend>
            {(["VIDEO", "IMAGE"] as const).map((kind) => (
              <label key={kind} className="flex items-center gap-2">
                <input type="radio" name="reel-kind" checked={settings.reelMediaKind === kind} disabled={Boolean(busy)} onChange={() => save({ reelMediaKind: kind })} />
                {kind === "VIDEO" ? "Vídeo" : "Imagem"}
              </label>
            ))}
          </fieldset>
        </div>
        <AssetSlot slot="REEL_VIDEO" label="Vídeo final" hint={`MP4, MOV ou WEBM, até ${END_MEDIA_MAX_VIDEO_SECONDS}s. Vertical 9:16 de preferência.`} summary={summary} busy={busy} onUpload={upload} onDelete={remove} />
        <AssetSlot slot="REEL_IMAGE" label="Imagem final (vira um trecho de vídeo)" hint="JPG, PNG ou WebP. Vertical 9:16 de preferência." summary={summary} busy={busy} onUpload={upload} onDelete={remove} />
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Split Screen</h2>
        <div className="mt-2">
          <Toggle
            label="Adicionar encerramento automaticamente (depois do split inteiro)"
            checked={settings.splitEnabled}
            disabled={Boolean(busy) || (!summary.assets.SPLIT_VIDEO && !summary.assets.REEL_VIDEO && !summary.assets.REEL_IMAGE)}
            onChange={(value) => save({ splitEnabled: value })}
          />
        </div>
        <AssetSlot slot="SPLIT_VIDEO" label="Vídeo final do Split Screen" hint="Opcional — sem ele, usa o encerramento dos Reels." summary={summary} busy={busy} onUpload={upload} onDelete={remove} />
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Ajustes</h2>
        <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
          <label className="block">
            <span className="font-medium text-zinc-800">Duração da imagem (segundos)</span>
            <input
              type="number"
              min={1}
              max={10}
              step={0.5}
              defaultValue={settings.imageDurationSeconds}
              disabled={Boolean(busy)}
              onBlur={(event) => save({ imageDurationSeconds: Number(event.target.value) })}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="font-medium text-zinc-800">Limitar o vídeo final a (segundos)</span>
            <input
              type="number"
              min={1}
              max={END_MEDIA_MAX_VIDEO_SECONDS}
              step={0.5}
              placeholder="Duração original"
              defaultValue={settings.maxVideoSeconds ?? ""}
              disabled={Boolean(busy)}
              onBlur={(event) => save({ maxVideoSeconds: event.target.value ? Number(event.target.value) : null })}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <fieldset className="text-zinc-700">
            <legend className="font-medium text-zinc-800">Áudio do vídeo final</legend>
            <label className="mt-1 flex items-center gap-2">
              <input type="radio" name="end-audio" checked={!settings.keepAudio} disabled={Boolean(busy)} onChange={() => save({ keepAudio: false })} /> Sem áudio (recomendado)
            </label>
            <label className="mt-1 flex items-center gap-2">
              <input type="radio" name="end-audio" checked={settings.keepAudio} disabled={Boolean(busy)} onChange={() => save({ keepAudio: true })} /> Manter áudio
            </label>
          </fieldset>
          <label className="block">
            <span className="font-medium text-zinc-800">Transição (fade)</span>
            <select
              value={String(settings.fadeSeconds)}
              disabled={Boolean(busy)}
              onChange={(event) => save({ fadeSeconds: Number(event.target.value) })}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
            >
              <option value="0">Sem fade</option>
              <option value="0.2">Suave (0,2s)</option>
              <option value="0.3">Padrão (0,3s)</option>
              <option value="0.5">Mais lento (0,5s)</option>
            </select>
          </label>
        </div>
        <div className="mt-4">
          <Toggle
            label="Aplicar automaticamente também no Piloto Automático e em telas sem a opção"
            checked={settings.applyAutomatically}
            disabled={Boolean(busy)}
            onChange={(value) => save({ applyAutomatically: value })}
          />
        </div>
      </section>
    </div>
  );
}
