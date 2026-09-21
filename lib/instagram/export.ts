/**
 * Exportação da arte final em PNG/JPG (ETAPA 6). Como o canvas de prévia já
 * é desenhado na resolução real do formato escolhido (ver
 * lib/instagram/render.ts), exportar é apenas ler os pixels desse mesmo
 * canvas com `toBlob` — garante que a imagem baixada corresponda
 * exatamente à prévia, na resolução escolhida, independente da tela do
 * usuário (requisitos 1 e 2). Tudo acontece no navegador: nenhuma imagem é
 * enviada a um servidor.
 *
 * `canvasToBlob`, `waitForFonts` e `downloadBlob` são exportadas (Fase 2,
 * ETAPA 6: "Reutilizar a função existente de exportação do Criador de
 * Posts") para serem reaproveitadas pela exportação em ZIP do Criador de
 * Carrosséis (lib/instagram/carousel/carousel-export.ts), sem duplicar
 * nenhuma dessas três funções.
 */

import { buildPostFileName } from "./layout-math";

export type ExportFormat = "png" | "jpg";

export class PostExportError extends Error {}

export function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new PostExportError("Não foi possível gerar o arquivo de imagem."));
      },
      mimeType,
      quality
    );
  });
}

/**
 * Garante que todas as fontes usadas na página já terminaram de carregar
 * antes de ler os pixels do canvas (ETAPA 6, requisito 3). As fontes deste
 * editor são fontes de sistema (lib/instagram/fonts.ts), então isto
 * normalmente resolve de imediato — mas continuamos aguardando por
 * segurança e por compatibilidade com navegadores mais lentos.
 */
export async function waitForFonts(): Promise<void> {
  const fontSet = typeof document !== "undefined" ? document.fonts : undefined;
  if (!fontSet?.ready) return;

  try {
    await Promise.race([
      fontSet.ready,
      new Promise((resolve) => setTimeout(resolve, 500)),
    ]);
  } catch {
    // Se a verificação de fontes falhar por qualquer motivo, seguimos com a
    // exportação normalmente — as fontes de sistema já estão disponíveis.
  }
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export interface ExportResult {
  fileName: string;
  byteSize: number;
}

/**
 * Exporta e baixa o canvas informado como PNG ou JPG. JPG não suporta
 * transparência: como o motor de renderização sempre preenche o canvas
 * inteiro (cor/degradê ou imagem de fundo) antes de desenhar qualquer
 * texto, a exportação em JPG já sai com fundo sólido "de graça" (ETAPA 6,
 * requisito 6), sem nenhum tratamento extra necessário aqui.
 */
export async function exportCanvasAsImage(
  canvas: HTMLCanvasElement,
  format: ExportFormat
): Promise<ExportResult> {
  await waitForFonts();

  const mimeType = format === "png" ? "image/png" : "image/jpeg";
  const quality = format === "jpg" ? 0.92 : undefined;

  let blob: Blob;
  try {
    blob = await canvasToBlob(canvas, mimeType, quality);
  } catch (error) {
    if (error instanceof PostExportError) throw error;
    throw new PostExportError("Não foi possível exportar a imagem. Tente novamente.");
  }

  const fileName = buildPostFileName(format);
  downloadBlob(blob, fileName);

  return { fileName, byteSize: blob.size };
}
