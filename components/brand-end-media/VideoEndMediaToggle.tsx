"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { EndMediaSummaryDto } from "@/lib/brand-end-media/end-media-config";
import { fetchEndMediaSummary } from "@/lib/brand-end-media/end-media-client";

/**
 * "Encerramento" em Reels e Split Screen: [✓] Adicionar mídia final.
 * Marcado por padrão quando a empresa ligou o tipo. `onChange(undefined)`
 * = nenhuma mídia de encerramento cadastrada (nada a aplicar).
 */
export function VideoEndMediaToggle({
  context,
  disabled,
  onChange,
}: {
  context: "REEL" | "SPLIT_SCREEN";
  disabled?: boolean;
  onChange: (wanted: boolean | undefined) => void;
}) {
  const [summary, setSummary] = useState<EndMediaSummaryDto | null>(null);
  const [checked, setChecked] = useState(false);

  const available = summary
    ? Boolean(
        (context === "SPLIT_SCREEN" && summary.assets.SPLIT_VIDEO) || summary.assets.REEL_VIDEO || summary.assets.REEL_IMAGE,
      )
    : false;

  useEffect(() => {
    let cancelled = false;
    fetchEndMediaSummary()
      .then((loaded) => {
        if (cancelled || !loaded) return;
        setSummary(loaded);
        setChecked(context === "SPLIT_SCREEN" ? loaded.settings.splitEnabled : loaded.settings.reelEnabled);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [context]);

  useEffect(() => {
    if (!summary) return;
    onChange(available ? checked : undefined);
  }, [summary, available, checked, onChange]);

  if (!summary) return null;
  const preview =
    (context === "SPLIT_SCREEN" ? summary.assets.SPLIT_VIDEO : undefined) ??
    (summary.settings.reelMediaKind === "IMAGE" ? summary.assets.REEL_IMAGE ?? summary.assets.REEL_VIDEO : summary.assets.REEL_VIDEO ?? summary.assets.REEL_IMAGE);

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3 text-sm" data-testid="video-end-media">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Encerramento</p>
      {!available ? (
        <p className="mt-1 text-xs text-zinc-600">
          Mídia final padrão não configurada.{" "}
          <Link href="/minha-conta/midia-final" className="font-medium text-teal-700 underline">
            Configurar
          </Link>
        </p>
      ) : (
        <>
          <label className="mt-1 flex items-center gap-2 font-medium text-zinc-900">
            <input type="checkbox" className="h-4 w-4" checked={checked} disabled={disabled} onChange={(event) => setChecked(event.target.checked)} />
            {context === "SPLIT_SCREEN" ? "Adicionar vídeo final padrão (depois do split)" : "Adicionar mídia final padrão"}
          </label>
          {checked && preview ? (
            <p className="mt-1 text-xs text-zinc-500">
              {preview.durationSeconds ? `Vídeo de ${preview.durationSeconds.toFixed(1)}s` : `Imagem por ${summary.settings.imageDurationSeconds}s`} no final do vídeo, montado pelo Alilu antes de publicar.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
