"use client";

import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { exportCarouselAsZip, type CarouselExportProgress } from "@/lib/instagram/carousel/carousel-export";
import type { CarouselFormatId, CarouselSlide } from "@/lib/instagram/carousel/carousel-state";

/**
 * Botão "Baixar carrossel em ZIP" (ETAPA 6). Fica desabilitado durante o
 * processamento — evita exportações simultâneas (requisito 10) — e mostra
 * o progresso slide a slide. Qualquer erro é mostrado de forma amigável em
 * vez de baixar um ZIP incompleto.
 */
export function CarouselExportPanel({
  slides,
  formatId,
}: {
  slides: CarouselSlide[];
  formatId: CarouselFormatId;
}) {
  const [progress, setProgress] = useState<CarouselExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastRequestId = useRef(0);
  const isExporting = progress !== null;

  async function handleExport() {
    if (isExporting) return;

    const requestId = ++lastRequestId.current;
    setError(null);
    setProgress({ completed: 0, total: slides.length });

    try {
      await exportCarouselAsZip(slides, formatId, (update) => {
        if (lastRequestId.current === requestId) setProgress(update);
      });
    } catch (err) {
      if (lastRequestId.current === requestId) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Não foi possível exportar o carrossel agora. Tente novamente em alguns segundos.";
        setError(message);
      }
    } finally {
      if (lastRequestId.current === requestId) {
        setProgress(null);
      }
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/70 p-4">
      <p className="text-sm text-zinc-600">
        Baixe todos os {slides.length} slides em um arquivo ZIP, prontos para publicar na ordem exibida.
      </p>
      <Button type="button" onClick={handleExport} disabled={isExporting} className="w-full justify-center">
        <Download className="h-4 w-4" aria-hidden />
        {isExporting
          ? `Gerando slide ${Math.min(progress.completed + 1, progress.total)} de ${progress.total}...`
          : "Baixar carrossel em ZIP"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
