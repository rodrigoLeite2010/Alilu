/**
 * Exportação do carrossel inteiro em um arquivo ZIP (Fase 2, ETAPA 6).
 * Reaproveita `drawPost` (o mesmo motor de desenho do Criador de Posts) e
 * `canvasToBlob`/`waitForFonts`/`downloadBlob` (lib/instagram/export.ts) —
 * a única lógica nova aqui é "desenhar cada slide num canvas próprio,
 * fora da tela, e empacotar tudo num ZIP", exatamente a separação entre
 * renderização e download sugerida na especificação.
 *
 * Cada slide é desenhado em sequência (nunca em paralelo) e com uma pausa
 * (`yieldToBrowser`) entre um e outro, para a página continuar respondendo
 * mesmo em carrosséis grandes (até 20 slides) em aparelhos mais fracos —
 * requisito de "não travar a página" da ETAPA 6. Qualquer erro interrompe
 * a exportação antes de gerar o ZIP, então nunca é baixado um arquivo
 * incompleto.
 */

import JSZip from "jszip";
import { canvasToBlob, downloadBlob, waitForFonts } from "../export";
import { getFormatById, type PostFormat } from "../formats";
import { drawPost } from "../render";
import { loadImageElement } from "../image-utils";
import type { CarouselFormatId, CarouselSlide } from "./carousel-state";

export class CarouselExportError extends Error {}

export interface CarouselExportProgress {
  completed: number;
  total: number;
}

function padSlideNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Desenha UM slide, fora da tela, e devolve o blob resultante — motor
 * compartilhado pela exportação em ZIP (`exportCarouselAsZip`, sempre
 * PNG) e pelo painel de publicação real do carrossel
 * (CarouselPublishPanel.tsx, sempre JPEG — a Content Publishing API da
 * Meta só aceita esse formato, ver ALLOWED_MEDIA_CONTENT_TYPES em
 * media-service.ts). `mimeType`/`quality` são opcionais e default para o
 * comportamento original (PNG) — exportado (em vez de privado ao módulo)
 * exatamente para essa reutilização, sem duplicar nenhuma lógica de
 * desenho.
 */
export async function renderSlideToBlob(
  slide: CarouselSlide,
  format: PostFormat,
  mimeType: string = "image/png",
  quality?: number
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = format.width;
  canvas.height = format.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new CarouselExportError("Não foi possível preparar a imagem de um dos slides.");
  }

  let image: HTMLImageElement | null = null;
  const url = slide.state.backgroundImage.url;
  if (url) {
    image = await loadImageElement(url);
  }

  drawPost(ctx, format, slide.state, image);
  return canvasToBlob(canvas, mimeType, quality);
}

export interface CarouselExportResult {
  fileName: string;
  slideCount: number;
}

/**
 * Gera e baixa `alilu-carrossel.zip` com um PNG por slide, nomeados
 * `slide-01.png`, `slide-02.png`... na ordem exibida no editor (ETAPA 6).
 * PNG já é um formato comprimido, então o ZIP usa `STORE` (sem recompactar)
 * — mais rápido e sem risco de inchar o arquivo.
 */
export async function exportCarouselAsZip(
  slides: CarouselSlide[],
  formatId: CarouselFormatId,
  onProgress?: (progress: CarouselExportProgress) => void
): Promise<CarouselExportResult> {
  if (slides.length === 0) {
    throw new CarouselExportError("Adicione pelo menos um slide antes de exportar o carrossel.");
  }

  await waitForFonts();
  const format = getFormatById(formatId);
  const zip = new JSZip();

  for (let index = 0; index < slides.length; index += 1) {
    onProgress?.({ completed: index, total: slides.length });

    let blob: Blob;
    try {
      blob = await renderSlideToBlob(slides[index], format);
    } catch (error) {
      if (error instanceof CarouselExportError) throw error;
      throw new CarouselExportError(
        `Não foi possível gerar o slide ${padSlideNumber(index)} do carrossel. ` +
          "Tente reduzir a quantidade de slides ou o formato escolhido e exportar novamente."
      );
    }

    zip.file(`slide-${padSlideNumber(index)}.png`, blob);
    await yieldToBrowser();
  }

  onProgress?.({ completed: slides.length, total: slides.length });

  let zipBlob: Blob;
  try {
    zipBlob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  } catch {
    throw new CarouselExportError(
      "Não foi possível gerar o arquivo ZIP agora. Tente reduzir a quantidade de slides e exportar novamente."
    );
  }

  const fileName = "alilu-carrossel.zip";
  downloadBlob(zipBlob, fileName);

  return { fileName, slideCount: slides.length };
}
