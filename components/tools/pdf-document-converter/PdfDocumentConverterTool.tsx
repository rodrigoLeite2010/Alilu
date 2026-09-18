"use client";

import { useState } from "react";
import { CheckCircle2, Download, FileDown, LoaderCircle, ShieldCheck } from "lucide-react";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { FileUploadDropzone } from "@/components/tools/pdf-shared/FileUploadDropzone";
import { PdfFileSummary } from "@/components/tools/pdf-shared/PdfFileSummary";
import { createPdfBlob, downloadBlob } from "@/lib/pdf/browser-download";
import { compressPdf, type PdfCompressionLevel } from "@/lib/pdf/compress-pdf";
import {
  formatPdfFileSize,
  inspectPdfFile,
  PdfMergeError,
  type PdfFileError,
} from "@/lib/pdf/merge-pdfs";
import {
  convertPdfToExcel,
  convertPdfToPowerPoint,
  convertPdfToWord,
} from "@/lib/pdf/pdf-to-office";

type ConverterMode = "compress" | "word" | "powerpoint" | "excel";
type SelectedPdf = { file: File; pageCount: number };
type DownloadResult = { blob: Blob; fileName: string; title: string; description: string };

const MODE_CONTENT: Record<ConverterMode, {
  buttonLabel: string;
  fileSuffix: string;
  title: string;
  description: string;
  limitation: string;
}> = {
  compress: {
    buttonLabel: "Comprimir PDF",
    fileSuffix: "compactado.pdf",
    title: "PDF comprimido com sucesso!",
    description: "Compare o tamanho antes de baixar o novo arquivo.",
    limitation: "A compactação recria cada página como imagem. Texto pesquisável, campos preenchíveis e assinaturas digitais não são preservados.",
  },
  word: {
    buttonLabel: "Converter para Word",
    fileSuffix: "convertido.docx",
    title: "Documento Word criado com sucesso!",
    description: "O arquivo DOCX contém o texto que foi extraído do PDF.",
    limitation: "Funciona com PDFs que possuem texto selecionável. Layout complexo, fontes e imagens podem precisar de revisão no Word; PDFs digitalizados não recebem OCR.",
  },
  powerpoint: {
    buttonLabel: "Converter para PowerPoint",
    fileSuffix: "convertido.pptx",
    title: "Apresentação criada com sucesso!",
    description: "Cada página do PDF foi incluída como uma imagem em um slide.",
    limitation: "A apresentação é visual: o texto e os elementos de cada página não ficam editáveis individualmente no PowerPoint.",
  },
  excel: {
    buttonLabel: "Converter para Excel",
    fileSuffix: "convertido.xlsx",
    title: "Planilha criada com sucesso!",
    description: "Cada página do PDF virou uma aba com linhas e colunas inferidas do texto.",
    limitation: "A detecção de colunas usa a posição do texto no PDF. Revise tabelas sem bordas, documentos em várias colunas e PDFs digitalizados.",
  },
};

function getBaseName(fileName: string): string {
  return fileName.replace(/\.pdf$/i, "") || "documento";
}

function getValidationError(fileName: string, error: PdfFileError): string {
  switch (error) {
    case "too-large":
      return `O arquivo "${fileName}" excede o limite de 50 MB.`;
    case "password-protected":
      return `O arquivo "${fileName}" está protegido por senha. Desbloqueie-o antes de usar este conversor.`;
    case "no-pages":
      return `O arquivo "${fileName}" não possui páginas para processar.`;
    case "read-failed":
      return `Não foi possível ler o arquivo "${fileName}".`;
    case "corrupted":
      return `O arquivo "${fileName}" parece estar corrompido.`;
    case "not-pdf":
    default:
      return `O arquivo "${fileName}" não é um PDF válido.`;
  }
}

export function PdfDocumentConverterTool({ mode }: { mode: ConverterMode }) {
  const content = MODE_CONTENT[mode];
  const [selectedPdf, setSelectedPdf] = useState<SelectedPdf | null>(null);
  const [compressionLevel, setCompressionLevel] = useState<PdfCompressionLevel>("balanced");
  const [isInspecting, setIsInspecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DownloadResult | null>(null);

  const isBusy = isInspecting || isProcessing;

  function clearResult() {
    setResult(null);
  }

  async function selectPdf(files: File[]) {
    const file = files[0];
    if (!file || isBusy) return;

    setError(null);
    clearResult();
    setIsInspecting(true);
    try {
      const validation = await inspectPdfFile(file);
      if (!validation.ok) {
        setSelectedPdf(null);
        setError(getValidationError(file.name, validation.error));
        return;
      }

      setSelectedPdf({ file, pageCount: validation.pageCount });
    } finally {
      setIsInspecting(false);
    }
  }

  async function handleConvert() {
    if (!selectedPdf || isBusy) return;

    setError(null);
    clearResult();
    setIsProcessing(true);
    try {
      const baseName = getBaseName(selectedPdf.file.name);
      if (mode === "compress") {
        const bytes = await compressPdf(selectedPdf.file, compressionLevel);
        setResult({
          blob: createPdfBlob(bytes),
          fileName: `${baseName}-${content.fileSuffix}`,
          title: content.title,
          description: content.description,
        });
        return;
      }

      const blob =
        mode === "word"
          ? await convertPdfToWord(selectedPdf.file)
          : mode === "powerpoint"
            ? await convertPdfToPowerPoint(selectedPdf.file)
            : await convertPdfToExcel(selectedPdf.file);
      setResult({
        blob,
        fileName: `${baseName}-${content.fileSuffix}`,
        title: content.title,
        description: content.description,
      });
    } catch (conversionError) {
      setError(
        conversionError instanceof PdfMergeError && conversionError.message !== conversionError.type
          ? conversionError.message
          : "Não foi possível processar este PDF. Tente novamente com outro arquivo."
      );
    } finally {
      setIsProcessing(false);
    }
  }

  function reset() {
    if (isBusy) return;
    setSelectedPdf(null);
    setError(null);
    clearResult();
  }

  const compressionDifference = result && selectedPdf && mode === "compress"
    ? result.blob.size - selectedPdf.file.size
    : null;

  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 rounded-lg bg-teal-50 p-3 text-sm leading-relaxed text-teal-950">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden />
        Seu PDF é processado somente no navegador e não é enviado aos nossos servidores.
      </p>

      {!selectedPdf ? (
        <FileUploadDropzone
          inputId={`pdf-${mode}-input`}
          title="Arraste um PDF aqui"
          description="Ou selecione um documento salvo no seu dispositivo."
          limitDescription="Limite técnico: até 50 MB por PDF e 50 páginas por processamento local."
          accept="application/pdf,.pdf"
          buttonLabel="Selecionar PDF"
          disabled={isBusy}
          onFilesSelected={selectPdf}
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
        <section aria-labelledby={`pdf-${mode}-options-heading`} className="space-y-5">
          <h2 id={`pdf-${mode}-options-heading`} className="text-base font-semibold text-zinc-900">Opções de conversão</h2>

          {mode === "compress" ? (
            <SelectField
              id="pdf-compress-level"
              label="Nível de compactação"
              value={compressionLevel}
              onChange={(event) => {
                setCompressionLevel(event.target.value as PdfCompressionLevel);
                clearResult();
              }}
              hint="A compactação forte reduz mais o arquivo e pode deixar textos e imagens menos nítidos."
              disabled={isBusy}
            >
              <option value="balanced">Equilibrado</option>
              <option value="strong">Forte</option>
            </SelectField>
          ) : null}

          <Button type="button" className="w-full sm:w-auto" onClick={() => void handleConvert()} disabled={isBusy}>
            {isProcessing ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <FileDown className="size-4" aria-hidden />}
            {isProcessing ? "Processando arquivo..." : content.buttonLabel}
          </Button>
        </section>
      ) : null}

      {result && selectedPdf ? (
        <section aria-live="polite" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden />
            <div>
              <h2 className="font-semibold text-emerald-950">{result.title}</h2>
              <p className="mt-1 text-sm text-emerald-900">{result.description}</p>
              {compressionDifference !== null ? (
                <p className="mt-2 text-sm text-emerald-900">
                  Original: {formatPdfFileSize(selectedPdf.file.size)}. Resultado: {formatPdfFileSize(result.blob.size)}. {compressionDifference < 0
                    ? `Economia de ${formatPdfFileSize(Math.abs(compressionDifference))}.`
                    : "Este arquivo foi refeito, mas não ficou menor; tente o nível forte ou mantenha o original."}
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" onClick={() => downloadBlob(result.blob, result.fileName)}>
              <Download className="size-4" aria-hidden />
              Baixar arquivo
            </Button>
            <Button type="button" variant="secondary" onClick={reset}>Processar outro PDF</Button>
          </div>
        </section>
      ) : null}

      <p className="text-xs leading-relaxed text-zinc-500">Limitação técnica: {content.limitation}</p>
    </div>
  );
}
