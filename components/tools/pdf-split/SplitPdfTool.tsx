"use client";

import { useState } from "react";
import { CheckCircle2, Download, LoaderCircle, Scissors, ShieldCheck } from "lucide-react";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { FileUploadDropzone } from "@/components/tools/pdf-shared/FileUploadDropzone";
import { PageSelectionField } from "@/components/tools/pdf-shared/PageSelectionField";
import { PdfFileSummary } from "@/components/tools/pdf-shared/PdfFileSummary";
import { downloadBlob, downloadPdf } from "@/lib/pdf/browser-download";
import { createZip } from "@/lib/pdf/create-zip";
import {
  inspectPdfFile,
  PdfMergeError,
  type PdfFileError,
} from "@/lib/pdf/merge-pdfs";
import { parsePageSelection } from "@/lib/pdf/page-selection";
import { splitPdf, type SplitPdfMode } from "@/lib/pdf/split-pdf";

type SelectedPdf = { file: File; pageCount: number };
type DownloadResult =
  | { type: "pdf"; bytes: Uint8Array; fileName: string }
  | { type: "zip"; blob: Blob; fileName: string };

function getValidationError(fileName: string, error: PdfFileError): string {
  switch (error) {
    case "too-large":
      return `O arquivo "${fileName}" excede o limite de 50 MB.`;
    case "password-protected":
      return `O arquivo "${fileName}" está protegido por senha. Desbloqueie-o antes de dividir.`;
    case "no-pages":
      return `O arquivo "${fileName}" não possui páginas para dividir.`;
    case "read-failed":
      return `Não foi possível ler o arquivo "${fileName}".`;
    case "corrupted":
      return `O arquivo "${fileName}" parece estar corrompido.`;
    case "not-pdf":
    default:
      return `O arquivo "${fileName}" não é um PDF válido.`;
  }
}

function getOperationError(error: unknown): string {
  if (error instanceof PdfMergeError && error.message !== error.type) {
    return error.message;
  }

  return "Não foi possível dividir o PDF. Tente novamente com outro arquivo.";
}

export function SplitPdfTool() {
  const [selectedPdf, setSelectedPdf] = useState<SelectedPdf | null>(null);
  const [pagesText, setPagesText] = useState("");
  const [mode, setMode] = useState<SplitPdfMode>("single-document");
  const [isInspecting, setIsInspecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | undefined>();
  const [result, setResult] = useState<DownloadResult | null>(null);

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
      setPagesText("");
      setError(getValidationError(file.name, validation.error));
      setIsInspecting(false);
      return;
    }

    setSelectedPdf({ file, pageCount: validation.pageCount });
    setPagesText(`1-${validation.pageCount}`);
    setIsInspecting(false);
  }

  async function handleSplit() {
    if (!selectedPdf || isBusy) return;

    setError(null);
    setPageError(undefined);
    setResult(null);
    const selection = parsePageSelection(pagesText, selectedPdf.pageCount);
    if (!selection.ok) {
      setPageError(selection.error);
      return;
    }

    setIsProcessing(true);
    try {
      const splitResult = await splitPdf(selectedPdf.file, selection.pages, mode);
      const baseName = selectedPdf.file.name.replace(/\.pdf$/i, "") || "documento";

      if (splitResult.mode === "single-document") {
        setResult({
          type: "pdf",
          bytes: splitResult.bytes,
          fileName: `${baseName}-paginas-selecionadas.pdf`,
        });
      } else if (splitResult.files.length === 1) {
        const [singleFile] = splitResult.files;
        setResult({ type: "pdf", bytes: singleFile.bytes, fileName: singleFile.fileName });
      } else {
        const blob = await createZip(splitResult.files);
        setResult({ type: "zip", blob, fileName: `${baseName}-paginas-separadas.zip` });
      }
    } catch (splitError) {
      setError(getOperationError(splitError));
    } finally {
      setIsProcessing(false);
    }
  }

  function downloadResult() {
    if (!result) return;

    if (result.type === "pdf") {
      downloadPdf(result.bytes, result.fileName);
      return;
    }

    downloadBlob(result.blob, result.fileName);
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
          inputId="pdf-split-input"
          title="Arraste um PDF aqui"
          description="Ou selecione um documento para escolher as páginas."
          limitDescription="Limite técnico: até 50 MB por PDF, para evitar falta de memória no navegador."
          accept="application/pdf,.pdf"
          buttonLabel="Selecionar PDF"
          disabled={isBusy}
          onFilesSelected={selectFile}
        />
      ) : (
        <PdfFileSummary
          file={selectedPdf.file}
          pageCount={selectedPdf.pageCount}
          disabled={isBusy}
          onClear={reset}
        />
      )}

      {isInspecting ? (
        <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-zinc-600">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Verificando PDF...
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm leading-relaxed text-red-800">
          {error}
        </p>
      ) : null}

      {selectedPdf ? (
        <section aria-labelledby="split-options-heading" className="space-y-5">
          <h2 id="split-options-heading" className="text-base font-semibold text-zinc-900">
            Como dividir
          </h2>
          <PageSelectionField
            id="pdf-split-pages"
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
          <SelectField
            id="pdf-split-mode"
            label="Resultado"
            value={mode}
            onChange={(event) => {
              setMode(event.target.value as SplitPdfMode);
              setResult(null);
            }}
            disabled={isBusy}
          >
            <option value="single-document">Reunir páginas selecionadas em um PDF</option>
            <option value="separate-files">Criar um PDF separado por página</option>
          </SelectField>
          <Button type="button" className="w-full sm:w-auto" onClick={() => void handleSplit()} disabled={isBusy}>
            {isProcessing ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Scissors className="size-4" aria-hidden />
            )}
            {isProcessing ? "Dividindo PDF..." : "Dividir PDF"}
          </Button>
        </section>
      ) : null}

      {result ? (
        <section aria-live="polite" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden />
            <div>
              <h2 className="font-semibold text-emerald-950">PDF dividido com sucesso!</h2>
              <p className="mt-1 text-sm text-emerald-900">
                {result.type === "zip"
                  ? "As páginas separadas foram reunidas em um arquivo ZIP para facilitar o download."
                  : "O arquivo contém exatamente as páginas selecionadas."}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" onClick={downloadResult}>
              <Download className="size-4" aria-hidden />
              {result.type === "zip" ? "Baixar arquivos ZIP" : "Baixar PDF"}
            </Button>
            <Button type="button" variant="secondary" onClick={reset}>
              Dividir outro PDF
            </Button>
          </div>
        </section>
      ) : null}

      <p className="text-xs leading-relaxed text-zinc-500">
        Limitação técnica: gerar um novo PDF pode invalidar assinaturas digitais, campos de formulário ou a estrutura de acessibilidade do arquivo original.
      </p>
    </div>
  );
}
