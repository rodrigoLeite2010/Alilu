"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Download,
  FileText,
  GripVertical,
  LoaderCircle,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { downloadPdf } from "@/lib/pdf/browser-download";
import {
  formatPdfFileSize,
  inspectPdfFile,
  MAX_TOTAL_PDF_SIZE_BYTES,
  mergePdfFiles,
  PdfMergeError,
  type PdfFileError,
} from "@/lib/pdf/merge-pdfs";

type SelectedPdf = {
  id: string;
  file: File;
  pageCount: number;
};

function getFileErrorMessage(fileName: string, error: PdfFileError): string {
  switch (error) {
    case "too-large":
      return `O arquivo "${fileName}" excede o limite de 50 MB por arquivo.`;
    case "password-protected":
      return `O arquivo "${fileName}" está protegido por senha. Desbloqueie-o antes de adicionar.`;
    case "no-pages":
      return `O arquivo "${fileName}" não possui páginas para unir.`;
    case "read-failed":
      return `Não foi possível ler o arquivo "${fileName}". Tente selecioná-lo novamente.`;
    case "corrupted":
      return `O arquivo "${fileName}" parece estar corrompido ou não é um PDF compatível.`;
    case "not-pdf":
    default:
      return `O arquivo "${fileName}" não é um PDF válido.`;
  }
}

function getMergeErrorMessage(error: unknown): string {
  if (error instanceof PdfMergeError) {
    switch (error.type) {
      case "not-enough-files":
        return "Selecione pelo menos dois arquivos PDF para unir.";
      case "too-large":
        return "Os arquivos selecionados excedem o limite total de 150 MB para processamento no navegador.";
      case "password-protected":
        return "Um dos arquivos está protegido por senha. Desbloqueie-o antes de unir os PDFs.";
      case "not-pdf":
      case "corrupted":
      case "read-failed":
      case "no-pages":
        return "Um dos arquivos não pôde ser lido. Revise a lista e tente novamente.";
      case "generation-failed":
        return "Não foi possível gerar o PDF unido. Tente novamente com arquivos menores ou em outro navegador.";
    }
  }

  return "Não foi possível unir os PDFs. Tente novamente.";
}

export function MergePdfsTool() {
  const inputRef = useRef<HTMLInputElement>(null);
  const itemSequence = useRef(0);
  const [files, setFiles] = useState<SelectedPdf[]>([]);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isDropTargetActive, setIsDropTargetActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [mergedPdf, setMergedPdf] = useState<Uint8Array | null>(null);

  const isBusy = isInspecting || isMerging;

  function clearResult() {
    setMergedPdf(null);
    setStatus(null);
  }

  async function addFiles(newFiles: File[]) {
    if (isBusy || newFiles.length === 0) {
      return;
    }

    setError(null);
    clearResult();
    setIsInspecting(true);

    const acceptedFiles: SelectedPdf[] = [];
    const errors: string[] = [];
    let totalSize = files.reduce((total, item) => total + item.file.size, 0);

    for (const file of newFiles) {
      if (totalSize + file.size > MAX_TOTAL_PDF_SIZE_BYTES) {
        errors.push(
          `O arquivo "${file.name}" não foi adicionado porque a lista excederia o limite total de 150 MB.`
        );
        continue;
      }

      const validation = await inspectPdfFile(file);
      if (!validation.ok) {
        errors.push(getFileErrorMessage(file.name, validation.error));
        continue;
      }

      acceptedFiles.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${itemSequence.current++}`,
        file,
        pageCount: validation.pageCount,
      });
      totalSize += file.size;
    }

    if (acceptedFiles.length > 0) {
      setFiles((current) => [...current, ...acceptedFiles]);
    }
    if (errors.length > 0) {
      setError(errors.join(" "));
    }

    setIsInspecting(false);
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    void addFiles(selectedFiles);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDropTargetActive(false);

    if (isBusy) {
      return;
    }

    void addFiles(Array.from(event.dataTransfer.files));
  }

  function removeFile(id: string) {
    if (isBusy) {
      return;
    }

    setFiles((current) => current.filter((item) => item.id !== id));
    setError(null);
    clearResult();
  }

  function moveFile(id: string, direction: "up" | "down") {
    if (isBusy) {
      return;
    }

    setFiles((current) => {
      const index = current.findIndex((item) => item.id === id);
      const targetIndex = direction === "up" ? index - 1 : index + 1;

      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
    setError(null);
    clearResult();
  }

  function moveFileToPosition(sourceId: string, targetId: string) {
    if (isBusy || sourceId === targetId) {
      return;
    }

    setFiles((current) => {
      const sourceIndex = current.findIndex((item) => item.id === sourceId);
      const targetIndex = current.findIndex((item) => item.id === targetId);

      if (sourceIndex < 0 || targetIndex < 0) {
        return current;
      }

      const next = [...current];
      const [source] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, source);
      return next;
    });
    setError(null);
    clearResult();
  }

  async function handleMerge() {
    if (files.length < 2 || isBusy) {
      setError("Selecione pelo menos dois arquivos PDF para unir.");
      return;
    }

    setError(null);
    clearResult();
    setIsMerging(true);

    try {
      const result = await mergePdfFiles(files.map((item) => item.file));
      setMergedPdf(result);
      setStatus("Seus PDFs foram unidos com sucesso!");
    } catch (mergeError) {
      setError(getMergeErrorMessage(mergeError));
    } finally {
      setIsMerging(false);
    }
  }

  function handleDownload() {
    if (!mergedPdf) {
      return;
    }

    downloadPdf(mergedPdf, "alilu-pdf-unido.pdf");
  }

  function handleClearList() {
    if (isBusy) {
      return;
    }

    setFiles([]);
    setError(null);
    clearResult();
  }

  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 rounded-lg bg-teal-50 p-3 text-sm leading-relaxed text-teal-950">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden />
        Seus arquivos são processados diretamente no navegador e não são enviados aos
        nossos servidores.
      </p>

      <div
        className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors sm:p-8 ${
          isDropTargetActive
            ? "border-teal-600 bg-teal-50"
            : "border-zinc-300 bg-zinc-50/70"
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!isBusy) setIsDropTargetActive(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) {
            setIsDropTargetActive(false);
          }
        }}
        onDrop={handleDrop}
      >
        <FileText className="mx-auto size-10 text-teal-700" aria-hidden />
        <p className="mt-3 text-base font-semibold text-zinc-900">
          Arraste seus arquivos PDF aqui
        </p>
        <p id="pdf-upload-hint" className="mt-1 text-sm text-zinc-600">
          Selecione dois ou mais arquivos PDF para começar.
        </p>
        <input
          ref={inputRef}
          id="pdf-merge-input"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={handleFileInput}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          data-testid="pdf-merge-input"
          disabled={isBusy}
        />
        <Button
          type="button"
          variant="secondary"
          className="mt-4"
          onClick={() => inputRef.current?.click()}
          aria-describedby="pdf-upload-hint pdf-upload-limit"
          disabled={isBusy}
        >
          <Upload className="size-4" aria-hidden />
          Selecionar arquivos PDF
        </Button>
        <p id="pdf-upload-limit" className="mt-3 text-xs leading-relaxed text-zinc-500">
          Limite técnico: até 50 MB por arquivo e 150 MB no total, para evitar falta de
          memória no navegador.
        </p>
      </div>

      {isInspecting ? (
        <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-zinc-600">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Verificando arquivos PDF...
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm leading-relaxed text-red-800">
          {error}
        </p>
      ) : null}

      {files.length > 0 ? (
        <section aria-labelledby="pdf-list-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="pdf-list-heading" className="text-base font-semibold text-zinc-900">
                Arquivos selecionados
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                A ordem desta lista será usada no PDF final.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                className="px-3"
                onClick={() => inputRef.current?.click()}
                disabled={isBusy}
              >
                <Upload className="size-4" aria-hidden />
                Adicionar mais PDFs
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="px-3"
                onClick={handleClearList}
                disabled={isBusy}
              >
                <Trash2 className="size-4" aria-hidden />
                Limpar lista
              </Button>
            </div>
          </div>

          <ol className="space-y-2" aria-label="Ordem dos arquivos PDF">
            {files.map((item, index) => (
              <li
                key={item.id}
                draggable={!isBusy}
                onDragStart={(event) => {
                  setDraggedId(item.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => setDraggedId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedId) {
                    moveFileToPosition(draggedId, item.id);
                  }
                  setDraggedId(null);
                }}
                className={`grid grid-cols-[auto_1fr] gap-x-3 gap-y-3 rounded-lg border p-3 sm:grid-cols-[auto_auto_1fr_auto] sm:items-center ${
                  draggedId === item.id
                    ? "border-teal-500 bg-teal-50"
                    : "border-zinc-200 bg-white"
                }`}
              >
                <span
                  className="hidden cursor-grab text-zinc-400 sm:inline-flex"
                  title="Arraste para alterar a ordem"
                  aria-hidden
                >
                  <GripVertical className="size-5" />
                </span>
                <span className="inline-flex size-8 items-center justify-center rounded-md bg-zinc-100 text-sm font-semibold text-zinc-700">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="break-all text-sm font-medium text-zinc-900">{item.file.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {formatPdfFileSize(item.file.size)} - {item.pageCount} {item.pageCount === 1 ? "página" : "páginas"}
                  </p>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1 sm:col-span-1">
                  <button
                    type="button"
                    className="inline-flex size-11 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Mover para cima"
                    aria-label={`Mover ${item.file.name} para cima`}
                    onClick={() => moveFile(item.id, "up")}
                    disabled={isBusy || index === 0}
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="inline-flex size-11 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Mover para baixo"
                    aria-label={`Mover ${item.file.name} para baixo`}
                    onClick={() => moveFile(item.id, "down")}
                    disabled={isBusy || index === files.length - 1}
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="inline-flex size-11 items-center justify-center rounded-md text-red-700 transition-colors hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Remover arquivo"
                    aria-label={`Remover ${item.file.name}`}
                    onClick={() => removeFile(item.id)}
                    disabled={isBusy}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ol>

          {files.length < 2 ? (
            <p className="text-sm text-zinc-600" role="status" aria-live="polite">
              Adicione mais {2 - files.length} arquivo{files.length === 0 ? "s" : ""} para unir os PDFs.
            </p>
          ) : null}

          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => void handleMerge()}
            disabled={files.length < 2 || isBusy}
          >
            {isMerging ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <FileText className="size-4" aria-hidden />
            )}
            {isMerging ? "Unindo PDFs..." : "Unir PDFs"}
          </Button>
        </section>
      ) : null}

      {mergedPdf && status ? (
        <section
          aria-live="polite"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden />
            <div>
              <h2 className="font-semibold text-emerald-950">{status}</h2>
              <p className="mt-1 text-sm text-emerald-900">
                O arquivo respeita a ordem definida na lista acima.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" onClick={handleDownload}>
              <Download className="size-4" aria-hidden />
              Baixar PDF unido
            </Button>
            <Button type="button" variant="secondary" onClick={handleClearList}>
              Iniciar nova união
            </Button>
          </div>
        </section>
      ) : null}

      <p className="text-xs leading-relaxed text-zinc-500">
        Limitação técnica: a união não preserva assinaturas digitais válidas, campos de
        formulário interativos ou a estrutura de acessibilidade dos documentos.
      </p>
    </div>
  );
}
