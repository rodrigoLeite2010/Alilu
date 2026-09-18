"use client";

import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Download,
  Image as ImageIcon,
  LoaderCircle,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { FileUploadDropzone } from "@/components/tools/pdf-shared/FileUploadDropzone";
import { downloadPdf } from "@/lib/pdf/browser-download";
import {
  formatPdfFileSize,
  MAX_PDF_FILE_SIZE_BYTES,
  MAX_TOTAL_PDF_SIZE_BYTES,
  PdfMergeError,
} from "@/lib/pdf/merge-pdfs";
import {
  createPdfFromJpegs,
  isJpegFile,
  type JpgPageOrientation,
  type JpgPageSize,
} from "@/lib/pdf/jpg-to-pdf";

type SelectedImage = { id: string; file: File };

function parseMargin(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function JpgToPdfTool() {
  const sequence = useRef(0);
  const [files, setFiles] = useState<SelectedImage[]>([]);
  const [pageSize, setPageSize] = useState<JpgPageSize>("a4");
  const [orientation, setOrientation] = useState<JpgPageOrientation>("portrait");
  const [marginText, setMarginText] = useState("10");
  const [isInspecting, setIsInspecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marginError, setMarginError] = useState<string | undefined>();
  const [result, setResult] = useState<Uint8Array | null>(null);

  const isBusy = isInspecting || isProcessing;

  function clearResult() {
    setResult(null);
  }

  async function addFiles(newFiles: File[]) {
    if (isBusy || newFiles.length === 0) return;

    setError(null);
    clearResult();
    setIsInspecting(true);
    const accepted: SelectedImage[] = [];
    const errors: string[] = [];
    let totalSize = files.reduce((total, item) => total + item.file.size, 0);

    for (const file of newFiles) {
      if (file.size > MAX_PDF_FILE_SIZE_BYTES) {
        errors.push(`A imagem "${file.name}" excede o limite de 50 MB por arquivo.`);
        continue;
      }
      if (totalSize + file.size > MAX_TOTAL_PDF_SIZE_BYTES) {
        errors.push(`A imagem "${file.name}" não foi adicionada porque a lista excederia 150 MB.`);
        continue;
      }
      if (!(await isJpegFile(file))) {
        errors.push(`A imagem "${file.name}" não é um JPG/JPEG válido.`);
        continue;
      }

      accepted.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${sequence.current++}`,
        file,
      });
      totalSize += file.size;
    }

    if (accepted.length > 0) {
      setFiles((current) => [...current, ...accepted]);
    }
    if (errors.length > 0) {
      setError(errors.join(" "));
    }
    setIsInspecting(false);
  }

  function moveFile(id: string, direction: "up" | "down") {
    if (isBusy) return;

    setFiles((current) => {
      const source = current.findIndex((item) => item.id === id);
      const destination = direction === "up" ? source - 1 : source + 1;
      if (source < 0 || destination < 0 || destination >= current.length) return current;
      const next = [...current];
      [next[source], next[destination]] = [next[destination], next[source]];
      return next;
    });
    setError(null);
    clearResult();
  }

  function removeFile(id: string) {
    if (isBusy) return;
    setFiles((current) => current.filter((item) => item.id !== id));
    setError(null);
    clearResult();
  }

  async function handleGenerate() {
    if (files.length === 0 || isBusy) {
      setError("Selecione ao menos uma imagem JPG/JPEG.");
      return;
    }

    const marginMm = parseMargin(marginText);
    if (!Number.isFinite(marginMm) || marginMm < 0 || marginMm > 50) {
      setMarginError("Informe uma margem entre 0 e 50 mm.");
      return;
    }

    setError(null);
    setMarginError(undefined);
    clearResult();
    setIsProcessing(true);
    try {
      setResult(
        await createPdfFromJpegs(
          files.map((item) => item.file),
          { pageSize, orientation, marginMm }
        )
      );
    } catch (conversionError) {
      setError(
        conversionError instanceof PdfMergeError && conversionError.message !== conversionError.type
          ? conversionError.message
          : "Não foi possível gerar o PDF. Tente novamente com imagens menores."
      );
    } finally {
      setIsProcessing(false);
    }
  }

  function reset() {
    if (isBusy) return;
    setFiles([]);
    setError(null);
    setMarginError(undefined);
    clearResult();
  }

  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 rounded-lg bg-teal-50 p-3 text-sm leading-relaxed text-teal-950">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden />
        Suas imagens são processadas somente no navegador e não são enviadas aos nossos servidores.
      </p>

      <FileUploadDropzone
        inputId="jpg-to-pdf-input"
        title="Arraste imagens JPG aqui"
        description="Selecione uma ou mais imagens JPG/JPEG para criar um documento."
        limitDescription="Limite técnico: até 50 MB por imagem e 150 MB no total. PNG e outros formatos não são convertidos nesta etapa."
        accept="image/jpeg,.jpg,.jpeg"
        multiple
        buttonLabel="Selecionar imagens JPG"
        disabled={isBusy}
        onFilesSelected={addFiles}
      />

      {isInspecting ? (
        <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-zinc-600">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Verificando imagens...
        </p>
      ) : null}

      {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm leading-relaxed text-red-800">{error}</p> : null}

      {files.length > 0 ? (
        <section aria-labelledby="jpg-list-heading" className="space-y-5">
          <div>
            <h2 id="jpg-list-heading" className="text-base font-semibold text-zinc-900">Imagens selecionadas</h2>
            <p className="mt-1 text-sm text-zinc-600">A ordem desta lista define a sequência das páginas no PDF.</p>
          </div>
          <ol className="space-y-2" aria-label="Ordem das imagens selecionadas">
            {files.map((item, index) => (
              <li key={item.id} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-3 rounded-lg border border-zinc-200 bg-white p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                <span className="inline-flex size-8 items-center justify-center rounded-md bg-zinc-100 text-sm font-semibold text-zinc-700">{index + 1}</span>
                <div className="min-w-0">
                  <p className="break-all text-sm font-medium text-zinc-900">{item.file.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{formatPdfFileSize(item.file.size)}</p>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1 sm:col-span-1">
                  <button type="button" className="inline-flex size-11 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-40" title="Mover para cima" aria-label={`Mover ${item.file.name} para cima`} onClick={() => moveFile(item.id, "up")} disabled={isBusy || index === 0}>
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                  <button type="button" className="inline-flex size-11 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-40" title="Mover para baixo" aria-label={`Mover ${item.file.name} para baixo`} onClick={() => moveFile(item.id, "down")} disabled={isBusy || index === files.length - 1}>
                    <ArrowDown className="size-4" aria-hidden />
                  </button>
                  <button type="button" className="inline-flex size-11 items-center justify-center rounded-md text-red-700 transition-colors hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-40" title="Remover imagem" aria-label={`Remover ${item.file.name}`} onClick={() => removeFile(item.id)} disabled={isBusy}>
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ol>

          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField id="jpg-to-pdf-page-size" label="Tamanho da página" value={pageSize} onChange={(event) => { setPageSize(event.target.value as JpgPageSize); clearResult(); }} disabled={isBusy}>
              <option value="a4">A4</option>
              <option value="original">Tamanho original da imagem</option>
            </SelectField>
            <SelectField id="jpg-to-pdf-orientation" label="Orientação A4" value={orientation} onChange={(event) => { setOrientation(event.target.value as JpgPageOrientation); clearResult(); }} disabled={isBusy || pageSize === "original"} hint={pageSize === "original" ? "No tamanho original, cada página segue as dimensões da imagem." : undefined}>
              <option value="portrait">Retrato</option>
              <option value="landscape">Paisagem</option>
            </SelectField>
          </div>
          <NumberField id="jpg-to-pdf-margin" label="Margem" suffix="mm" value={marginText} onChange={(event) => { setMarginText(event.target.value); setMarginError(undefined); clearResult(); }} error={marginError} hint="De 0 a 50 mm. A imagem é ajustada sem recorte." disabled={isBusy} />

          <div className="flex flex-wrap gap-3">
            <Button type="button" className="w-full sm:w-auto" onClick={() => void handleGenerate()} disabled={isBusy}>
              {isProcessing ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <ImageIcon className="size-4" aria-hidden />}
              {isProcessing ? "Gerando PDF..." : "Criar PDF"}
            </Button>
            <Button type="button" variant="secondary" onClick={reset} disabled={isBusy}>Limpar lista</Button>
          </div>
        </section>
      ) : null}

      {result ? (
        <section aria-live="polite" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden />
            <div>
              <h2 className="font-semibold text-emerald-950">PDF criado com sucesso!</h2>
              <p className="mt-1 text-sm text-emerald-900">As imagens foram inseridas na ordem exibida, mantendo a proporção original.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" onClick={() => downloadPdf(result, "alilu-imagens.pdf")}><Download className="size-4" aria-hidden />Baixar PDF</Button>
            <Button type="button" variant="secondary" onClick={reset}>Criar outro PDF</Button>
          </div>
        </section>
      ) : null}

      <p className="text-xs leading-relaxed text-zinc-500">Limitação técnica: esta versão aceita somente JPG/JPEG e não edita nem melhora as imagens originais.</p>
    </div>
  );
}
