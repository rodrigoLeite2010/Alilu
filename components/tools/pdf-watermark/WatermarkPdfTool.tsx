"use client";

import { useState } from "react";
import { CheckCircle2, Download, LoaderCircle, ShieldCheck, Stamp, Trash2 } from "lucide-react";
import { SelectField } from "@/components/forms/SelectField";
import { TextField } from "@/components/forms/TextField";
import { Button } from "@/components/ui/Button";
import { FileUploadDropzone } from "@/components/tools/pdf-shared/FileUploadDropzone";
import { PageSelectionField } from "@/components/tools/pdf-shared/PageSelectionField";
import { PdfFileSummary } from "@/components/tools/pdf-shared/PdfFileSummary";
import { downloadPdf } from "@/lib/pdf/browser-download";
import {
  inspectPdfFile,
  PdfMergeError,
  type PdfFileError,
} from "@/lib/pdf/merge-pdfs";
import { getAllPageNumbers, parsePageSelection } from "@/lib/pdf/page-selection";
import {
  addWatermark,
  getWatermarkImageKind,
  type WatermarkInput,
  type WatermarkPosition,
} from "@/lib/pdf/watermark-pdf";

type SelectedPdf = { file: File; pageCount: number };
type WatermarkType = WatermarkInput["type"];
type PageMode = "all" | "selected";

function getValidationError(fileName: string, error: PdfFileError): string {
  switch (error) {
    case "too-large":
      return `O arquivo "${fileName}" excede o limite de 50 MB.`;
    case "password-protected":
      return `O arquivo "${fileName}" está protegido por senha. Desbloqueie-o antes de adicionar uma marca d'água.`;
    case "no-pages":
      return `O arquivo "${fileName}" não possui páginas para editar.`;
    case "read-failed":
      return `Não foi possível ler o arquivo "${fileName}".`;
    case "corrupted":
      return `O arquivo "${fileName}" parece estar corrompido.`;
    case "not-pdf":
    default:
      return `O arquivo "${fileName}" não é um PDF válido.`;
  }
}

export function WatermarkPdfTool() {
  const [selectedPdf, setSelectedPdf] = useState<SelectedPdf | null>(null);
  const [watermarkType, setWatermarkType] = useState<WatermarkType>("text");
  const [text, setText] = useState("CONFIDENCIAL");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [pageMode, setPageMode] = useState<PageMode>("all");
  const [pagesText, setPagesText] = useState("");
  const [position, setPosition] = useState<WatermarkPosition>("center");
  const [opacity, setOpacity] = useState(0.35);
  const [rotation, setRotation] = useState(-35);
  const [fontSize, setFontSize] = useState(42);
  const [imageWidthPercent, setImageWidthPercent] = useState(30);
  const [color, setColor] = useState("#0f172a");
  const [isInspecting, setIsInspecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | undefined>();
  const [result, setResult] = useState<Uint8Array | null>(null);

  const isBusy = isInspecting || isProcessing;

  function clearResult() {
    setResult(null);
  }

  async function selectPdf(files: File[]) {
    const file = files[0];
    if (!file || isBusy) return;

    setError(null);
    setPageError(undefined);
    clearResult();
    setIsInspecting(true);
    const validation = await inspectPdfFile(file);
    if (!validation.ok) {
      setSelectedPdf(null);
      setPagesText("");
      setError(getValidationError(file.name, validation.error));
      setIsInspecting(false);
      return;
    }

    setSelectedPdf({ file, pageCount: validation.pageCount });
    setPagesText(`1-${validation.pageCount}`);
    setIsInspecting(false);
  }

  async function selectImage(files: File[]) {
    const file = files[0];
    if (!file || isBusy) return;

    setError(null);
    clearResult();
    const kind = await getWatermarkImageKind(file);
    if (!kind) {
      setImageFile(null);
      setError("A imagem da marca d'água deve ser JPG/JPEG ou PNG válido e ter até 50 MB.");
      return;
    }

    setImageFile(file);
  }

  async function handleApply() {
    if (!selectedPdf || isBusy) return;

    setError(null);
    setPageError(undefined);
    clearResult();
    const selection =
      pageMode === "all"
        ? { ok: true as const, pages: getAllPageNumbers(selectedPdf.pageCount) }
        : parsePageSelection(pagesText, selectedPdf.pageCount);

    if (!selection.ok) {
      setPageError(selection.error);
      return;
    }

    if (watermarkType === "text" && !text.trim()) {
      setError("Digite o texto da marca d'água.");
      return;
    }
    if (watermarkType === "image" && !imageFile) {
      setError("Selecione uma imagem JPG/JPEG ou PNG para a marca d'água.");
      return;
    }

    setIsProcessing(true);
    try {
      setResult(
        await addWatermark(selectedPdf.file, {
          type: watermarkType,
          text,
          image: imageFile,
          pages: selection.pages,
          position,
          opacity,
          rotation,
          fontSize,
          imageWidthPercent,
          color,
        })
      );
    } catch (watermarkError) {
      setError(
        watermarkError instanceof PdfMergeError && watermarkError.message !== watermarkError.type
          ? watermarkError.message
          : "Não foi possível adicionar a marca d'água. Tente novamente com outro arquivo."
      );
    } finally {
      setIsProcessing(false);
    }
  }

  function reset() {
    if (isBusy) return;
    setSelectedPdf(null);
    setImageFile(null);
    setPagesText("");
    setError(null);
    setPageError(undefined);
    clearResult();
  }

  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 rounded-lg bg-teal-50 p-3 text-sm leading-relaxed text-teal-950">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden />
        O PDF e a imagem da marca d'água são processados somente no navegador, sem envio a servidores.
      </p>

      {!selectedPdf ? (
        <FileUploadDropzone
          inputId="pdf-watermark-input"
          title="Arraste um PDF aqui"
          description="Ou selecione um documento para aplicar uma marca d'água."
          limitDescription="Limite técnico: até 50 MB por PDF, para evitar falta de memória no navegador."
          accept="application/pdf,.pdf"
          buttonLabel="Selecionar PDF"
          disabled={isBusy}
          onFilesSelected={selectPdf}
        />
      ) : (
        <PdfFileSummary file={selectedPdf.file} pageCount={selectedPdf.pageCount} disabled={isBusy} onClear={reset} />
      )}

      {isInspecting ? <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-zinc-600"><LoaderCircle className="size-4 animate-spin" aria-hidden />Verificando PDF...</p> : null}
      {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm leading-relaxed text-red-800">{error}</p> : null}

      {selectedPdf ? (
        <section aria-labelledby="watermark-options-heading" className="space-y-5">
          <h2 id="watermark-options-heading" className="text-base font-semibold text-zinc-900">Configurar marca d'água</h2>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-zinc-700">Tipo de marca d'água</legend>
            <label className="flex min-h-11 items-center gap-3 text-sm text-zinc-700">
              <input type="radio" name="watermark-type" value="text" checked={watermarkType === "text"} onChange={() => { setWatermarkType("text"); clearResult(); }} disabled={isBusy} />
              Texto
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm text-zinc-700">
              <input type="radio" name="watermark-type" value="image" checked={watermarkType === "image"} onChange={() => { setWatermarkType("image"); clearResult(); }} disabled={isBusy} />
              Imagem JPG/JPEG ou PNG
            </label>
          </fieldset>

          {watermarkType === "text" ? (
            <TextField id="pdf-watermark-text" label="Texto da marca d'água" value={text} maxLength={200} onChange={(event) => { setText(event.target.value); clearResult(); }} hint="Até 200 caracteres." disabled={isBusy} />
          ) : (
            <div className="space-y-3">
              <FileUploadDropzone
                inputId="pdf-watermark-image-input"
                title="Arraste uma imagem aqui"
                description="Escolha uma imagem JPG/JPEG ou PNG para sobrepor ao PDF."
                limitDescription="Limite técnico: até 50 MB. A imagem é usada somente durante esta operação."
                accept="image/jpeg,.jpg,.jpeg,image/png,.png"
                buttonLabel="Selecionar imagem"
                disabled={isBusy}
                onFilesSelected={selectImage}
              />
              {imageFile ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-3">
                  <p className="min-w-0 break-all text-sm font-medium text-zinc-900">{imageFile.name}</p>
                  <button type="button" className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-red-700 transition-colors hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Remover ${imageFile.name}`} title="Remover imagem" onClick={() => { setImageFile(null); clearResult(); }} disabled={isBusy}>
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              ) : null}
            </div>
          )}

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-zinc-700">Aplicar em</legend>
            <label className="flex min-h-11 items-center gap-3 text-sm text-zinc-700"><input type="radio" name="watermark-page-mode" value="all" checked={pageMode === "all"} onChange={() => { setPageMode("all"); setPageError(undefined); clearResult(); }} disabled={isBusy} />Todas as páginas</label>
            <label className="flex min-h-11 items-center gap-3 text-sm text-zinc-700"><input type="radio" name="watermark-page-mode" value="selected" checked={pageMode === "selected"} onChange={() => { setPageMode("selected"); clearResult(); }} disabled={isBusy} />Somente páginas selecionadas</label>
          </fieldset>

          {pageMode === "selected" ? <PageSelectionField id="pdf-watermark-pages" value={pagesText} pageCount={selectedPdf.pageCount} disabled={isBusy} error={pageError} onChange={(value) => { setPagesText(value); setPageError(undefined); clearResult(); }} /> : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField id="pdf-watermark-position" label="Posição" value={position} onChange={(event) => { setPosition(event.target.value as WatermarkPosition); clearResult(); }} disabled={isBusy}>
              <option value="top-left">Superior esquerda</option>
              <option value="top-right">Superior direita</option>
              <option value="center">Centro</option>
              <option value="bottom-left">Inferior esquerda</option>
              <option value="bottom-right">Inferior direita</option>
            </SelectField>
            <SelectField id="pdf-watermark-rotation" label="Rotação" value={rotation} onChange={(event) => { setRotation(Number(event.target.value)); clearResult(); }} disabled={isBusy}>
              <option value="-45">-45 graus</option>
              <option value="-35">-35 graus</option>
              <option value="0">Sem rotação</option>
              <option value="35">35 graus</option>
              <option value="45">45 graus</option>
            </SelectField>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {watermarkType === "text" ? (
              <SelectField id="pdf-watermark-font-size" label="Tamanho do texto" value={fontSize} onChange={(event) => { setFontSize(Number(event.target.value)); clearResult(); }} disabled={isBusy}>
                <option value="20">Pequeno</option>
                <option value="32">Médio</option>
                <option value="42">Grande</option>
                <option value="60">Muito grande</option>
              </SelectField>
            ) : (
              <SelectField id="pdf-watermark-image-width" label="Largura da imagem" value={imageWidthPercent} onChange={(event) => { setImageWidthPercent(Number(event.target.value)); clearResult(); }} disabled={isBusy}>
                <option value="15">15% da página</option>
                <option value="30">30% da página</option>
                <option value="50">50% da página</option>
                <option value="70">70% da página</option>
              </SelectField>
            )}
            <div>
              <label htmlFor="pdf-watermark-opacity" className="mb-1.5 block text-sm font-medium text-zinc-700">Transparência: {Math.round(opacity * 100)}%</label>
              <input id="pdf-watermark-opacity" type="range" min="0.1" max="1" step="0.05" value={opacity} onChange={(event) => { setOpacity(Number(event.target.value)); clearResult(); }} className="mt-3 block min-h-11 w-full accent-teal-700" disabled={isBusy} aria-valuetext={`${Math.round(opacity * 100)} por cento`} />
            </div>
          </div>

          {watermarkType === "text" ? (
            <div>
              <label htmlFor="pdf-watermark-color" className="mb-1.5 block text-sm font-medium text-zinc-700">Cor do texto</label>
              <input id="pdf-watermark-color" type="color" value={color} onChange={(event) => { setColor(event.target.value); clearResult(); }} className="block h-11 w-20 cursor-pointer rounded-md border border-zinc-300 bg-white p-1" disabled={isBusy} />
            </div>
          ) : null}

          <Button type="button" className="w-full sm:w-auto" onClick={() => void handleApply()} disabled={isBusy}>
            {isProcessing ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Stamp className="size-4" aria-hidden />}
            {isProcessing ? "Aplicando marca d'água..." : "Adicionar marca d'água"}
          </Button>
        </section>
      ) : null}

      {result && selectedPdf ? (
        <section aria-live="polite" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden />
            <div><h2 className="font-semibold text-emerald-950">Marca d'água adicionada com sucesso!</h2><p className="mt-1 text-sm text-emerald-900">O novo arquivo contém somente as alterações configuradas acima.</p></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" onClick={() => downloadPdf(result, `${selectedPdf.file.name.replace(/\.pdf$/i, "") || "documento"}-marca-dagua.pdf`)}><Download className="size-4" aria-hidden />Baixar PDF</Button>
            <Button type="button" variant="secondary" onClick={reset}>Editar outro PDF</Button>
          </div>
        </section>
      ) : null}

      <p className="text-xs leading-relaxed text-zinc-500">Limitação técnica: uma marca d'água visual não equivale a assinatura digital, certificação ou proteção contra cópia do documento.</p>
    </div>
  );
}
