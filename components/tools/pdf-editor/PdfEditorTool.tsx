"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, LoaderCircle, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { TextareaField } from "@/components/forms/TextareaField";
import { Button } from "@/components/ui/Button";
import { FileUploadDropzone } from "@/components/tools/pdf-shared/FileUploadDropzone";
import { PdfFileSummary } from "@/components/tools/pdf-shared/PdfFileSummary";
import { createPdfBlob, downloadBlob } from "@/lib/pdf/browser-download";
import { applyPdfEdits, type PdfEdit } from "@/lib/pdf/edit-pdf";
import { inspectPdfFile, PdfMergeError, type PdfFileError } from "@/lib/pdf/merge-pdfs";

type SelectedPdf = { file: File; pageCount: number };
type EditType = PdfEdit["type"];

function getValidationError(fileName: string, error: PdfFileError): string {
  switch (error) {
    case "too-large": return `O arquivo "${fileName}" excede o limite de 50 MB.`;
    case "password-protected": return `O arquivo "${fileName}" está protegido por senha. Desbloqueie-o antes de editar.`;
    case "no-pages": return `O arquivo "${fileName}" não possui páginas para editar.`;
    case "read-failed": return `Não foi possível ler o arquivo "${fileName}".`;
    case "corrupted": return `O arquivo "${fileName}" parece estar corrompido.`;
    case "not-pdf":
    default: return `O arquivo "${fileName}" não é um PDF válido.`;
  }
}

function getNumericValue(value: string, fallback: number): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function PdfEditorTool() {
  const [selectedPdf, setSelectedPdf] = useState<SelectedPdf | null>(null);
  const [editType, setEditType] = useState<EditType>("text");
  const [page, setPage] = useState(1);
  const [xPercent, setXPercent] = useState(10);
  const [yPercent, setYPercent] = useState(10);
  const [text, setText] = useState("");
  const [fontSize, setFontSize] = useState(16);
  const [widthPercent, setWidthPercent] = useState(30);
  const [heightPercent, setHeightPercent] = useState(8);
  const [color, setColor] = useState("#18181b");
  const [edits, setEdits] = useState<PdfEdit[]>([]);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const isBusy = isInspecting || isProcessing;

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function replaceResult(nextResult: Uint8Array | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextUrl = nextResult ? URL.createObjectURL(createPdfBlob(nextResult)) : null;
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
    setResult(nextResult);
  }

  function clearResult() {
    replaceResult(null);
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
      setPage(1);
      setEdits([]);
    } finally {
      setIsInspecting(false);
    }
  }

  function addEdit() {
    if (!selectedPdf || isBusy) return;
    setError(null);
    if (!Number.isInteger(page) || page < 1 || page > selectedPdf.pageCount) {
      setError(`Escolha uma página entre 1 e ${selectedPdf.pageCount}.`);
      return;
    }

    if (editType === "text") {
      if (!text.trim()) {
        setError("Digite o texto que será adicionado ao PDF.");
        return;
      }
      setEdits((current) => [...current, { type: "text", page, xPercent, yPercent, text, fontSize, color }]);
      setText("");
    } else {
      setEdits((current) => [...current, { type: "rectangle", page, xPercent, yPercent, widthPercent, heightPercent, color }]);
    }
    clearResult();
  }

  async function handleGenerate() {
    if (!selectedPdf || isBusy) return;
    setError(null);
    clearResult();
    setIsProcessing(true);
    try {
      replaceResult(await applyPdfEdits(selectedPdf.file, edits));
    } catch (editingError) {
      setError(
        editingError instanceof PdfMergeError && editingError.message !== editingError.type
          ? editingError.message
          : "Não foi possível aplicar as alterações a este PDF."
      );
    } finally {
      setIsProcessing(false);
    }
  }

  function reset() {
    if (isBusy) return;
    setSelectedPdf(null);
    setEdits([]);
    setError(null);
    clearResult();
  }

  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 rounded-lg bg-teal-50 p-3 text-sm leading-relaxed text-teal-950">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden />
        O PDF é editado localmente no navegador e não é enviado aos nossos servidores.
      </p>

      {!selectedPdf ? (
        <FileUploadDropzone inputId="pdf-editor-input" title="Arraste um PDF aqui" description="Ou selecione um documento para adicionar texto ou uma cobertura visual." limitDescription="Limite técnico: até 50 MB por PDF." accept="application/pdf,.pdf" buttonLabel="Selecionar PDF" disabled={isBusy} onFilesSelected={selectPdf} />
      ) : (
        <PdfFileSummary file={selectedPdf.file} pageCount={selectedPdf.pageCount} disabled={isBusy} onClear={reset} />
      )}

      {isInspecting ? <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-zinc-600"><LoaderCircle className="size-4 animate-spin" aria-hidden />Verificando PDF...</p> : null}
      {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm leading-relaxed text-red-800">{error}</p> : null}

      {selectedPdf ? (
        <section aria-labelledby="pdf-editor-options-heading" className="space-y-5">
          <h2 id="pdf-editor-options-heading" className="text-base font-semibold text-zinc-900">Adicionar alteração</h2>
          <SelectField id="pdf-editor-type" label="Tipo de alteração" value={editType} onChange={(event) => { setEditType(event.target.value as EditType); clearResult(); }} disabled={isBusy}>
            <option value="text">Adicionar texto</option>
            <option value="rectangle">Cobrir uma área com retângulo</option>
          </SelectField>

          <div className="grid gap-5 sm:grid-cols-3">
            <NumberField id="pdf-editor-page" label="Página" value={page} onChange={(event) => { setPage(getNumericValue(event.target.value, 1)); clearResult(); }} hint={`De 1 a ${selectedPdf.pageCount}.`} disabled={isBusy} />
            <NumberField id="pdf-editor-x" label="Posição horizontal" value={xPercent} onChange={(event) => { setXPercent(getNumericValue(event.target.value, 0)); clearResult(); }} suffix="%" hint="Distância a partir da esquerda." disabled={isBusy} />
            <NumberField id="pdf-editor-y" label="Posição vertical" value={yPercent} onChange={(event) => { setYPercent(getNumericValue(event.target.value, 0)); clearResult(); }} suffix="%" hint="Distância a partir do topo." disabled={isBusy} />
          </div>

          {editType === "text" ? (
            <div className="grid gap-5 sm:grid-cols-[1fr_12rem]">
              <TextareaField id="pdf-editor-text" label="Texto a adicionar" value={text} onChange={(event) => { setText(event.target.value); clearResult(); }} maxLength={400} rows={4} hint="Até 400 caracteres. Quebras de linha são preservadas." disabled={isBusy} />
              <NumberField id="pdf-editor-font-size" label="Tamanho do texto" value={fontSize} onChange={(event) => { setFontSize(getNumericValue(event.target.value, 16)); clearResult(); }} suffix="pt" disabled={isBusy} />
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <NumberField id="pdf-editor-width" label="Largura do retângulo" value={widthPercent} onChange={(event) => { setWidthPercent(getNumericValue(event.target.value, 30)); clearResult(); }} suffix="%" disabled={isBusy} />
              <NumberField id="pdf-editor-height" label="Altura do retângulo" value={heightPercent} onChange={(event) => { setHeightPercent(getNumericValue(event.target.value, 8)); clearResult(); }} suffix="%" disabled={isBusy} />
            </div>
          )}

          <div>
            <label htmlFor="pdf-editor-color" className="mb-1.5 block text-sm font-medium text-zinc-700">Cor</label>
            <input id="pdf-editor-color" type="color" value={color} onChange={(event) => { setColor(event.target.value); clearResult(); }} className="block h-11 w-20 cursor-pointer rounded-md border border-zinc-300 bg-white p-1" disabled={isBusy} />
          </div>

          <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={addEdit} disabled={isBusy}>
            <Plus className="size-4" aria-hidden />
            Adicionar à lista
          </Button>

          {edits.length > 0 ? (
            <section aria-labelledby="pdf-editor-list-heading" className="rounded-lg border border-zinc-200 bg-white p-4">
              <h3 id="pdf-editor-list-heading" className="text-sm font-semibold text-zinc-900">Alterações a aplicar ({edits.length})</h3>
              <ol className="mt-3 space-y-2">
                {edits.map((edit, index) => (
                  <li key={`${edit.type}-${index}`} className="flex items-start justify-between gap-3 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
                    <span>{edit.type === "text" ? `Texto na página ${edit.page}: ${edit.text}` : `Retângulo na página ${edit.page}, ${edit.widthPercent}% × ${edit.heightPercent}%`}</span>
                    <button type="button" className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700" aria-label={`Remover alteração ${index + 1}`} title="Remover alteração" onClick={() => { setEdits((current) => current.filter((_, currentIndex) => currentIndex !== index)); clearResult(); }} disabled={isBusy}>
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <Button type="button" className="w-full sm:w-auto" onClick={() => void handleGenerate()} disabled={isBusy || edits.length === 0}>
            {isProcessing ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
            {isProcessing ? "Gerando PDF editado..." : "Gerar PDF editado"}
          </Button>
        </section>
      ) : null}

      {result && selectedPdf ? (
        <section aria-live="polite" className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden /><div><h2 className="font-semibold text-emerald-950">PDF editado com sucesso!</h2><p className="mt-1 text-sm text-emerald-900">Confira a prévia antes de baixar o arquivo.</p></div></div>
          {previewUrl ? <iframe title="Prévia do PDF editado" src={previewUrl} className="h-96 w-full rounded-md border border-emerald-200 bg-white sm:h-[32rem]" /> : null}
          <div className="flex flex-wrap gap-3"><Button type="button" onClick={() => downloadBlob(createPdfBlob(result), `${selectedPdf.file.name.replace(/\.pdf$/i, "") || "documento"}-editado.pdf`)}><Download className="size-4" aria-hidden />Baixar PDF editado</Button><Button type="button" variant="secondary" onClick={reset}>Editar outro PDF</Button></div>
        </section>
      ) : null}

      <p className="text-xs leading-relaxed text-zinc-500">Limitação técnica: a cobertura com retângulo é visual e não remove o conteúdo original do arquivo. Para ocultar dados sensíveis de forma irreversível, use um processo profissional de redação de PDF.</p>
    </div>
  );
}
