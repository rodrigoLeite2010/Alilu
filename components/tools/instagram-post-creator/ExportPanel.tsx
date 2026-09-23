"use client";

import { useRef, useState, type RefObject } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { exportCanvasAsImage, type ExportFormat } from "@/lib/instagram/export";
import type { PostFormat } from "@/lib/instagram/formats";

/**
 * Exportação PNG/JPG (ETAPA 6). Os dois botões ficam desabilitados durante
 * o processamento para evitar múltiplos downloads acidentais (requisito
 * 10), e qualquer erro de exportação é mostrado de forma amigável
 * (requisito 9) em vez de falhar silenciosamente.
 */
export function ExportPanel({
  canvasRef,
  format,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  format: PostFormat;
}) {
  const [pendingFormat, setPendingFormat] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastRequestId = useRef(0);

  async function handleExport(exportFormat: ExportFormat) {
    const canvas = canvasRef.current;
    if (!canvas || pendingFormat) return;

    const requestId = ++lastRequestId.current;
    setPendingFormat(exportFormat);
    setError(null);

    try {
      await exportCanvasAsImage(canvas, exportFormat);
    } catch {
      if (lastRequestId.current === requestId) {
        setError("Não foi possível exportar a imagem agora. Tente novamente em alguns segundos.");
      }
    } finally {
      if (lastRequestId.current === requestId) {
        setPendingFormat(null);
      }
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/70 p-4">
      <div>
        <p className="text-sm font-semibold text-zinc-900">Seu post está pronto!</p>
        <p className="mt-0.5 text-sm text-zinc-600">
          Baixe sua arte em {format.width} × {format.height}px, prontinha para publicar.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={() => handleExport("png")}
          disabled={pendingFormat !== null}
          className="flex-1 sm:flex-none"
        >
          <Download className="h-4 w-4" aria-hidden />
          {pendingFormat === "png" ? "Gerando PNG..." : "Baixar PNG"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => handleExport("jpg")}
          disabled={pendingFormat !== null}
          className="flex-1 sm:flex-none"
        >
          <Download className="h-4 w-4" aria-hidden />
          {pendingFormat === "jpg" ? "Gerando JPG..." : "Baixar JPG"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
