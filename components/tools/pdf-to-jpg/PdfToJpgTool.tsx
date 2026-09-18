"use client";

import { useState } from "react";
import { CheckCircle2, Download, Image, LoaderCircle, ShieldCheck } from "lucide-react";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { FileUploadDropzone } from "@/components/tools/pdf-shared/FileUploadDropzone";
import { PageSelectionField } from "@/components/tools/pdf-shared/PageSelectionField";
import { PdfFileSummary } from "@/components/tools/pdf-shared/PdfFileSummary";
import { downloadBlob } from "@/lib/pdf/browser-download";
import { createZip } from "@/lib/pdf/create-zip";
import {
  inspectPdfFile,
  PdfMergeError,
  type PdfFileError,
} from "@/lib/pdf/merge-pdfs";
import { parsePageSelection } from "@/lib/pdf/page-selection";
import { renderPdfToJpegs } from "@/lib/pdf/pdf-to-jpg";

type SelectedPdf = { file: File; pageCount: number };
type DownloadResult =
  | { type: "jpg"; blob: Blob; fileName: string }
  | { type: "zip"; blob: Blob; fileName: string };

function getValidationError(fileName: string, error: PdfFileError): string {
  switch (error) {
    case "too-large":
      return `O arquivo "${fileName}" excede o limite de 50 MB.`;
    case "password-protected":
      return `O arquivo "${fileName}" está protegido por senha. Desbloqueie-o antes de converter.`;
    case "no-pages":
      return `O arquivo "${fileName}" não possui páginas para converter.`;
    case "read-failed":
      return `Não foi possível ler o arquivo "${fileName}".`;
    case "corrupted":
      return `O arquivo "${fileName}" parece estar corrompido.`;
    case "not-pdf":
    default:
      return `O arquivo "${fileName}" não é um PDF válido.`;
  }
}

export function PdfToJpgTool() {
  const [selectedPdf, setSelectedPdf] = useState<SelectedPdf | null>(null);
  const [pagesText, setPagesText] = useState("");
  const [quality, setQuality] = useState(0.9);
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

  async function handleConvert() {
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
      const images = await renderPdfToJpegs(selectedPdf.file, selection.pages, quality);
      if (images.length === 1) {
        const [image] = images;
        setResult({ type: "jpg", blob: image.blob, fileName: image.fileName });
      } else {
        const baseName = selectedPdf.file.name.replace(/\.pdf$/i, "") || "documento";
        const zip = await createZip(
          images.map((image) => ({ fileName: image.fileName, bytes: image.blob }))
        );
        setResult({ type: "zip", blob: zip, fileName: `${baseName}-imagens-jpg.zip` });
      }
    } catch (conversionError) {
      setError(
        conversionError instanceof PdfMergeError && conversionError.message !== conversionError.type
          ? conversionError.message
          : "Não foi possível converter este PDF em imagens JPG. Tente novamente com um arquivo menor."
      );
    } finally {
      setIsProcessing(false);
    }
  }

  function downloadResult() {
    if (result) downloadBlob(result.blob, result.fileName);
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
        O PDF é renderizado diretamente no seu navegador e não é enviado aos nossos servidores.
      </p>

      {!selectedPdf ? (
        <FileUploadDropzone
          inputId="pdf-to-jpg-input"
          title="Arraste um PDF aqui"
          description="Ou selecione um documento para renderizar páginas como imagens JPG."
          limitDescription="Limite técnico: até 50 MB por PDF. Imagens com muitas páginas podem exigir mais memória do aparelho."
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
        <section aria-labelledby="pdf-to-jpg-options-heading" className="space-y-5">
          <h2 id="pdf-to-jpg-options-heading" className="text-base font-semibold text-zinc-900">Opções de conversão</h2>
          <PageSelectionField
            id="pdf-to-jpg-pages"
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
            id="pdf-to-jpg-quality"
            label="Qualidade JPG"
            value={quality}
            onChange={(event) => {
              setQuality(Number(event.target.value));
              setResult(null);
            }}
            hint="A qualidade maior preserva mais detalhes e pode gerar arquivos maiores."
            disabled={isBusy}
          >
            <option value="0.75">Equilibrada</option>
            <option value="0.9">Alta</option>
            <option value="0.95">Máxima</option>
          </SelectField>
          <Button type="button" className="w-full sm:w-auto" onClick={() => void handleConvert()} disabled={isBusy}>
            {isProcessing ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Image className="size-4" aria-hidden />}
            {isProcessing ? "Convertendo PDF..." : "Converter para JPG"}
          </Button>
        </section>
      ) : null}

      {result ? (
        <section aria-live="polite" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden />
            <div>
              <h2 className="font-semibold text-emerald-950">Imagens JPG criadas com sucesso!</h2>
              <p className="mt-1 text-sm text-emerald-900">
                {result.type === "zip" ? "As imagens foram reunidas em um ZIP para um único download." : "A página escolhida foi convertida em JPG."}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" onClick={downloadResult}><Download className="size-4" aria-hidden />{result.type === "zip" ? "Baixar imagens ZIP" : "Baixar imagem JPG"}</Button>
            <Button type="button" variant="secondary" onClick={reset}>Converter outro PDF</Button>
          </div>
        </section>
      ) : null}

      <p className="text-xs leading-relaxed text-zinc-500">Limitação técnica: a ferramenta renderiza a aparência das páginas. Ela não extrai imagens internas nem preserva camadas editáveis do PDF.</p>
    </div>
  );
}
