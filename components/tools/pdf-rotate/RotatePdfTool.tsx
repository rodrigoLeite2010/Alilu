"use client";

import { useState } from "react";
import { CheckCircle2, Download, LoaderCircle, RotateCw, ShieldCheck } from "lucide-react";
import { SelectField } from "@/components/forms/SelectField";
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
import { rotatePdf, type RotationAngle } from "@/lib/pdf/rotate-pdf";

type SelectedPdf = { file: File; pageCount: number };
type PageMode = "all" | "selected";

function getValidationError(fileName: string, error: PdfFileError): string {
  switch (error) {
    case "too-large":
      return `O arquivo "${fileName}" excede o limite de 50 MB.`;
    case "password-protected":
      return `O arquivo "${fileName}" está protegido por senha. Desbloqueie-o antes de girar.`;
    case "no-pages":
      return `O arquivo "${fileName}" não possui páginas para girar.`;
    case "read-failed":
      return `Não foi possível ler o arquivo "${fileName}".`;
    case "corrupted":
      return `O arquivo "${fileName}" parece estar corrompido.`;
    case "not-pdf":
    default:
      return `O arquivo "${fileName}" não é um PDF válido.`;
  }
}

export function RotatePdfTool() {
  const [selectedPdf, setSelectedPdf] = useState<SelectedPdf | null>(null);
  const [pageMode, setPageMode] = useState<PageMode>("all");
  const [pagesText, setPagesText] = useState("");
  const [rotation, setRotation] = useState<RotationAngle>(90);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | undefined>();
  const [result, setResult] = useState<Uint8Array | null>(null);

  const isBusy = isInspecting || isProcessing;

  async function selectFile(files: File[]) {
    const file = files[0];
    if (!file || isBusy) return;

    setError(null);
    setPageError(undefined);
    setResult(null);
    setIsInspecting(true);
    const validation = await inspectPdfFile(file);

    if (!validation.ok) {
      setSelectedPdf(null);
      setError(getValidationError(file.name, validation.error));
      setIsInspecting(false);
      return;
    }

    setSelectedPdf({ file, pageCount: validation.pageCount });
    setPagesText(`1-${validation.pageCount}`);
    setIsInspecting(false);
  }

  async function handleRotate() {
    if (!selectedPdf || isBusy) return;

    setError(null);
    setPageError(undefined);
    setResult(null);
    const selection =
      pageMode === "all"
        ? { ok: true as const, pages: getAllPageNumbers(selectedPdf.pageCount) }
        : parsePageSelection(pagesText, selectedPdf.pageCount);

    if (!selection.ok) {
      setPageError(selection.error);
      return;
    }

    setIsProcessing(true);
    try {
      setResult(await rotatePdf(selectedPdf.file, selection.pages, rotation));
    } catch (rotateError) {
      setError(
        rotateError instanceof PdfMergeError && rotateError.message !== rotateError.type
          ? rotateError.message
          : "Não foi possível girar o PDF. Tente novamente com outro arquivo."
      );
    } finally {
      setIsProcessing(false);
    }
  }

  function reset() {
    if (isBusy) return;
    setSelectedPdf(null);
    setPagesText("");
    setError(null);
    setPageError(undefined);
    setResult(null);
  }

  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 rounded-lg bg-teal-50 p-3 text-sm leading-relaxed text-teal-950">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden />
        Seu PDF é processado somente no navegador e não é enviado aos nossos servidores.
      </p>

      {!selectedPdf ? (
        <FileUploadDropzone
          inputId="pdf-rotate-input"
          title="Arraste um PDF aqui"
          description="Ou selecione um documento para ajustar sua orientação."
          limitDescription="Limite técnico: até 50 MB por PDF, para evitar falta de memória no navegador."
          accept="application/pdf,.pdf"
          buttonLabel="Selecionar PDF"
          disabled={isBusy}
          onFilesSelected={selectFile}
        />
      ) : (
        <PdfFileSummary file={selectedPdf.file} pageCount={selectedPdf.pageCount} disabled={isBusy} onClear={reset} />
      )}

      {isInspecting ? (
        <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-zinc-600">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Verificando PDF...
        </p>
      ) : null}

      {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm leading-relaxed text-red-800">{error}</p> : null}

      {selectedPdf ? (
        <section aria-labelledby="rotate-options-heading" className="space-y-5">
          <h2 id="rotate-options-heading" className="text-base font-semibold text-zinc-900">Opções de rotação</h2>
          <SelectField
            id="pdf-rotate-angle"
            label="Girar no sentido horário"
            value={rotation}
            onChange={(event) => {
              setRotation(Number(event.target.value) as RotationAngle);
              setResult(null);
            }}
            disabled={isBusy}
          >
            <option value="90">90 graus</option>
            <option value="180">180 graus</option>
            <option value="270">270 graus</option>
          </SelectField>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-zinc-700">Aplicar em</legend>
            <label className="flex min-h-11 items-center gap-3 text-sm text-zinc-700">
              <input
                type="radio"
                name="pdf-rotate-page-mode"
                value="all"
                checked={pageMode === "all"}
                onChange={() => {
                  setPageMode("all");
                  setPageError(undefined);
                  setResult(null);
                }}
                disabled={isBusy}
              />
              Todas as páginas
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm text-zinc-700">
              <input
                type="radio"
                name="pdf-rotate-page-mode"
                value="selected"
                checked={pageMode === "selected"}
                onChange={() => {
                  setPageMode("selected");
                  setResult(null);
                }}
                disabled={isBusy}
              />
              Somente páginas selecionadas
            </label>
          </fieldset>

          {pageMode === "selected" ? (
            <PageSelectionField
              id="pdf-rotate-pages"
              value={pagesText}
              pageCount={selectedPdf.pageCount}
              disabled={isBusy}
              error={pageError}
              onChange={(value) => {
                setPagesText(value);
                setPageError(undefined);
                setResult(null);
              }}
            />
          ) : null}

          <Button type="button" className="w-full sm:w-auto" onClick={() => void handleRotate()} disabled={isBusy}>
            {isProcessing ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <RotateCw className="size-4" aria-hidden />}
            {isProcessing ? "Girando PDF..." : "Girar PDF"}
          </Button>
        </section>
      ) : null}

      {result && selectedPdf ? (
        <section aria-live="polite" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden />
            <div>
              <h2 className="font-semibold text-emerald-950">PDF girado com sucesso!</h2>
              <p className="mt-1 text-sm text-emerald-900">A rotação foi aplicada às páginas escolhidas.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" onClick={() => downloadPdf(result, `${selectedPdf.file.name.replace(/\.pdf$/i, "") || "documento"}-girado.pdf`)}>
              <Download className="size-4" aria-hidden />
              Baixar PDF girado
            </Button>
            <Button type="button" variant="secondary" onClick={reset}>Girar outro PDF</Button>
          </div>
        </section>
      ) : null}

      <p className="text-xs leading-relaxed text-zinc-500">
        Limitação técnica: a orientação é ajustada nas páginas. Assinaturas digitais e campos interativos podem deixar de ser válidos no novo arquivo.
      </p>
    </div>
  );
}
