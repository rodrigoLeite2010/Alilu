"use client";

import { useState } from "react";
import { CheckCircle2, Download, FileText, LoaderCircle, ShieldCheck, Trash2 } from "lucide-react";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { FileUploadDropzone } from "@/components/tools/pdf-shared/FileUploadDropzone";
import { createPdfBlob, downloadBlob } from "@/lib/pdf/browser-download";
import {
  convertExcelToPdf,
  convertPowerPointToPdf,
  convertWordToPdf,
  validateOfficeFile,
} from "@/lib/pdf/office-to-pdf";
import { formatPdfFileSize, PdfMergeError } from "@/lib/pdf/merge-pdfs";
import type { HtmlPdfOptions } from "@/lib/pdf/html-to-pdf";

type OfficeMode = "word" | "powerpoint" | "excel";
type SelectedOfficeFile = { file: File };

const MODE_CONTENT: Record<OfficeMode, {
  extensions: string[];
  accept: string;
  buttonLabel: string;
  description: string;
  limitation: string;
}> = {
  word: {
    extensions: ["docx"],
    accept: ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buttonLabel: "Converter Word para PDF",
    description: "O PDF foi criado com a estrutura de texto e tabelas que o navegador conseguiu renderizar.",
    limitation: "Aceita DOCX. Cabeçalhos, rodapés, comentários, fontes instaladas, caixas de texto e layout avançado podem variar no PDF final.",
  },
  powerpoint: {
    extensions: ["pptx"],
    accept: ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buttonLabel: "Converter PowerPoint para PDF",
    description: "O PDF inclui uma página para cada slide com texto e imagens compatíveis extraídos da apresentação.",
    limitation: "Aceita PPTX. Animações, transições, gráficos, vídeos, fontes e a posição exata dos elementos não são reproduzidos pelo conversor local.",
  },
  excel: {
    extensions: ["xlsx"],
    accept: ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buttonLabel: "Converter Excel para PDF",
    description: "O PDF organiza as células preenchidas de cada aba em tabelas de leitura horizontal.",
    limitation: "Aceita XLSX. Fórmulas usam o último valor salvo pela planilha; gráficos, macros, filtros, estilos e configurações de impressão não são executados.",
  },
};

function getBaseName(fileName: string): string {
  return fileName.replace(/\.[a-z0-9]+$/i, "") || "documento";
}

function OfficeFileSummary({ file, disabled, onClear }: { file: File; disabled: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-teal-700">
          <FileText className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="break-all text-sm font-medium text-zinc-900">{file.name}</p>
          <p className="mt-0.5 text-xs text-zinc-500">{formatPdfFileSize(file.size)}</p>
        </div>
      </div>
      <button
        type="button"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-red-700 transition-colors hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={`Remover ${file.name}`}
        title="Remover arquivo"
        onClick={onClear}
        disabled={disabled}
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export function OfficeToPdfTool({ mode }: { mode: OfficeMode }) {
  const content = MODE_CONTENT[mode];
  const [selectedFile, setSelectedFile] = useState<SelectedOfficeFile | null>(null);
  const [orientation, setOrientation] = useState<HtmlPdfOptions["orientation"]>("portrait");
  const [marginMm, setMarginMm] = useState(15);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Uint8Array | null>(null);

  const isBusy = isInspecting || isProcessing;

  async function selectFile(files: File[]) {
    const file = files[0];
    if (!file || isBusy) return;

    setError(null);
    setResult(null);
    setIsInspecting(true);
    try {
      await validateOfficeFile(file, content.extensions);
      setSelectedFile({ file });
    } catch (validationError) {
      setSelectedFile(null);
      setError(validationError instanceof Error ? validationError.message : "Não foi possível validar este arquivo.");
    } finally {
      setIsInspecting(false);
    }
  }

  async function handleConvert() {
    if (!selectedFile || isBusy) return;

    setError(null);
    setResult(null);
    setIsProcessing(true);
    try {
      const pdf = mode === "word"
        ? await convertWordToPdf(selectedFile.file, { orientation, marginMm })
        : mode === "powerpoint"
          ? await convertPowerPointToPdf(selectedFile.file)
          : await convertExcelToPdf(selectedFile.file);
      setResult(pdf);
    } catch (conversionError) {
      setError(
        conversionError instanceof PdfMergeError && conversionError.message !== conversionError.type
          ? conversionError.message
          : "Não foi possível converter este arquivo em PDF."
      );
    } finally {
      setIsProcessing(false);
    }
  }

  function reset() {
    if (isBusy) return;
    setSelectedFile(null);
    setError(null);
    setResult(null);
  }

  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 rounded-lg bg-teal-50 p-3 text-sm leading-relaxed text-teal-950">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden />
        O arquivo é processado somente no seu navegador e não é enviado aos nossos servidores.
      </p>

      {!selectedFile ? (
        <FileUploadDropzone
          inputId={`${mode}-to-pdf-input`}
          title={`Arraste um arquivo ${content.extensions[0].toUpperCase()} aqui`}
          description="Ou selecione um arquivo salvo no seu dispositivo."
          limitDescription="Limite técnico: até 20 MB por arquivo do Office, para evitar uso excessivo de memória."
          accept={content.accept}
          buttonLabel={`Selecionar ${content.extensions[0].toUpperCase()}`}
          disabled={isBusy}
          onFilesSelected={selectFile}
        />
      ) : (
        <OfficeFileSummary file={selectedFile.file} disabled={isBusy} onClear={reset} />
      )}

      {isInspecting ? <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-zinc-600"><LoaderCircle className="size-4 animate-spin" aria-hidden />Verificando arquivo...</p> : null}
      {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm leading-relaxed text-red-800">{error}</p> : null}

      {selectedFile ? (
        <section aria-labelledby={`${mode}-to-pdf-options-heading`} className="space-y-5">
          <h2 id={`${mode}-to-pdf-options-heading`} className="text-base font-semibold text-zinc-900">Opções de conversão</h2>

          {mode === "word" ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField id="word-to-pdf-orientation" label="Orientação" value={orientation} onChange={(event) => { setOrientation(event.target.value as HtmlPdfOptions["orientation"]); setResult(null); }} disabled={isBusy}>
                <option value="portrait">Retrato</option>
                <option value="landscape">Paisagem</option>
              </SelectField>
              <SelectField id="word-to-pdf-margin" label="Margens" value={marginMm} onChange={(event) => { setMarginMm(Number(event.target.value)); setResult(null); }} disabled={isBusy}>
                <option value="10">Estreitas (10 mm)</option>
                <option value="15">Normais (15 mm)</option>
                <option value="25">Largas (25 mm)</option>
              </SelectField>
            </div>
          ) : null}

          <Button type="button" className="w-full sm:w-auto" onClick={() => void handleConvert()} disabled={isBusy}>
            {isProcessing ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <FileText className="size-4" aria-hidden />}
            {isProcessing ? "Convertendo arquivo..." : content.buttonLabel}
          </Button>
        </section>
      ) : null}

      {result && selectedFile ? (
        <section aria-live="polite" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden />
            <div>
              <h2 className="font-semibold text-emerald-950">PDF criado com sucesso!</h2>
              <p className="mt-1 text-sm text-emerald-900">{content.description}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" onClick={() => downloadBlob(createPdfBlob(result), `${getBaseName(selectedFile.file.name)}-convertido.pdf`)}>
              <Download className="size-4" aria-hidden />
              Baixar PDF
            </Button>
            <Button type="button" variant="secondary" onClick={reset}>Converter outro arquivo</Button>
          </div>
        </section>
      ) : null}

      <p className="text-xs leading-relaxed text-zinc-500">Limitação técnica: {content.limitation}</p>
    </div>
  );
}
