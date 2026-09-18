"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { CheckCircle2, Download, Eraser, LoaderCircle, ShieldCheck, Stamp } from "lucide-react";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { TextField } from "@/components/forms/TextField";
import { Button } from "@/components/ui/Button";
import { FileUploadDropzone } from "@/components/tools/pdf-shared/FileUploadDropzone";
import { PdfFileSummary } from "@/components/tools/pdf-shared/PdfFileSummary";
import { createPdfBlob, downloadBlob } from "@/lib/pdf/browser-download";
import { inspectPdfFile, PdfMergeError, type PdfFileError } from "@/lib/pdf/merge-pdfs";
import { addVisualSignature, type VisualSignature } from "@/lib/pdf/sign-pdf";

type SelectedPdf = { file: File; pageCount: number };
type SignatureMode = "typed" | "drawn" | "image";

function getValidationError(fileName: string, error: PdfFileError): string {
  switch (error) {
    case "too-large": return `O arquivo "${fileName}" excede o limite de 50 MB.`;
    case "password-protected": return `O arquivo "${fileName}" está protegido por senha. Desbloqueie-o antes de assinar.`;
    case "no-pages": return `O arquivo "${fileName}" não possui páginas para assinar.`;
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

function SignaturePad({ disabled, onChange }: { disabled: boolean; onChange: (value: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  function getPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  }

  function beginDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const canvas = canvasRef.current;
    const point = getPoint(event);
    const context = canvas?.getContext("2d");
    if (!canvas || !point || !context) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    isDrawingRef.current = true;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 7;
    context.strokeStyle = "#18181b";
    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  function continueDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current || disabled) return;
    const point = getPoint(event);
    const context = canvasRef.current?.getContext("2d");
    if (!point || !context) return;
    event.preventDefault();
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function finishDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    isDrawingRef.current = false;
    if (!canvas) return;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-zinc-300 bg-white">
        <canvas
          ref={canvasRef}
          width={900}
          height={240}
          className="block h-36 w-full touch-none cursor-crosshair bg-white disabled:cursor-not-allowed"
          aria-label="Área para desenhar sua assinatura visual"
          aria-describedby="pdf-sign-draw-hint"
          tabIndex={0}
          onPointerDown={beginDrawing}
          onPointerMove={continueDrawing}
          onPointerUp={finishDrawing}
          onPointerCancel={finishDrawing}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id="pdf-sign-draw-hint" className="text-xs leading-relaxed text-zinc-500">Desenhe com o dedo, mouse ou caneta. Para usar somente teclado, escolha a opção de assinatura digitada.</p>
        <Button type="button" variant="secondary" onClick={clear} disabled={disabled}><Eraser className="size-4" aria-hidden />Limpar desenho</Button>
      </div>
    </div>
  );
}

async function readSignatureImage(file: File): Promise<string> {
  if (file.size === 0 || file.size > 5 * 1024 * 1024) {
    throw new PdfMergeError("generation-failed", "A imagem da assinatura deve ter até 5 MB.");
  }

  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!isPng && !isJpeg) {
    throw new PdfMergeError("generation-failed", "A imagem da assinatura deve ser um PNG ou JPG válido.");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Não foi possível ler a imagem."));
    reader.onerror = () => reject(reader.error ?? new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}

export function PdfSignTool() {
  const [selectedPdf, setSelectedPdf] = useState<SelectedPdf | null>(null);
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("typed");
  const [typedSignature, setTypedSignature] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [xPercent, setXPercent] = useState(55);
  const [yPercent, setYPercent] = useState(80);
  const [widthPercent, setWidthPercent] = useState(28);
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
    } finally {
      setIsInspecting(false);
    }
  }

  async function selectSignatureImage(files: File[]) {
    const file = files[0];
    if (!file || isBusy) return;
    setError(null);
    try {
      setImageDataUrl(await readSignatureImage(file));
      clearResult();
    } catch (imageError) {
      setImageDataUrl(null);
      setError(imageError instanceof Error ? imageError.message : "Não foi possível usar esta imagem.");
    }
  }

  async function handleSign() {
    if (!selectedPdf || isBusy) return;
    setError(null);
    clearResult();
    if (!Number.isInteger(page) || page < 1 || page > selectedPdf.pageCount) {
      setError(`Escolha uma página entre 1 e ${selectedPdf.pageCount}.`);
      return;
    }

    if (signatureMode !== "typed" && !imageDataUrl) {
      setError("Desenhe ou selecione uma imagem para usar como assinatura.");
      return;
    }

    const common = { page, xPercent, yPercent, widthPercent };
    const signature: VisualSignature = signatureMode === "typed"
      ? { ...common, type: "typed", text: typedSignature }
      : { ...common, type: "image", dataUrl: imageDataUrl! };

    setIsProcessing(true);
    try {
      replaceResult(await addVisualSignature(selectedPdf.file, signature));
    } catch (signatureError) {
      setError(
        signatureError instanceof PdfMergeError && signatureError.message !== signatureError.type
          ? signatureError.message
          : "Não foi possível adicionar a assinatura ao PDF."
      );
    } finally {
      setIsProcessing(false);
    }
  }

  function reset() {
    if (isBusy) return;
    setSelectedPdf(null);
    setImageDataUrl(null);
    setError(null);
    clearResult();
  }

  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 rounded-lg bg-teal-50 p-3 text-sm leading-relaxed text-teal-950"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden />O PDF e a assinatura são processados somente no navegador, sem envio a servidores.</p>
      {!selectedPdf ? <FileUploadDropzone inputId="pdf-sign-input" title="Arraste um PDF aqui" description="Ou selecione um documento para inserir uma assinatura visual." limitDescription="Limite técnico: até 50 MB por PDF." accept="application/pdf,.pdf" buttonLabel="Selecionar PDF" disabled={isBusy} onFilesSelected={selectPdf} /> : <PdfFileSummary file={selectedPdf.file} pageCount={selectedPdf.pageCount} disabled={isBusy} onClear={reset} />}
      {isInspecting ? <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-zinc-600"><LoaderCircle className="size-4 animate-spin" aria-hidden />Verificando PDF...</p> : null}
      {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm leading-relaxed text-red-800">{error}</p> : null}

      {selectedPdf ? (
        <section aria-labelledby="pdf-sign-options-heading" className="space-y-5">
          <h2 id="pdf-sign-options-heading" className="text-base font-semibold text-zinc-900">Configurar assinatura visual</h2>
          <SelectField id="pdf-sign-mode" label="Forma da assinatura" value={signatureMode} onChange={(event) => { setSignatureMode(event.target.value as SignatureMode); setError(null); clearResult(); }} disabled={isBusy}>
            <option value="typed">Nome digitado</option>
            <option value="drawn">Desenho à mão</option>
            <option value="image">Imagem PNG ou JPG</option>
          </SelectField>
          {signatureMode === "typed" ? <TextField id="pdf-sign-typed" label="Nome para assinatura" value={typedSignature} onChange={(event) => { setTypedSignature(event.target.value); clearResult(); }} maxLength={120} hint="O nome aparecerá em estilo manuscrito no PDF." disabled={isBusy} /> : null}
          {signatureMode === "drawn" ? <SignaturePad disabled={isBusy} onChange={(value) => { setImageDataUrl(value); clearResult(); }} /> : null}
          {signatureMode === "image" ? <FileUploadDropzone inputId="pdf-sign-image-input" title="Arraste a imagem da assinatura aqui" description="Use uma imagem PNG ou JPG com fundo transparente ou branco." limitDescription="Limite técnico: até 5 MB por imagem." accept="image/png,.png,image/jpeg,.jpg,.jpeg" buttonLabel="Selecionar imagem" disabled={isBusy} onFilesSelected={selectSignatureImage} /> : null}

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField id="pdf-sign-page" label="Página" value={page} onChange={(event) => { setPage(getNumericValue(event.target.value, 1)); clearResult(); }} hint={`De 1 a ${selectedPdf.pageCount}.`} disabled={isBusy} />
            <NumberField id="pdf-sign-x" label="Posição horizontal" value={xPercent} onChange={(event) => { setXPercent(getNumericValue(event.target.value, 55)); clearResult(); }} suffix="%" disabled={isBusy} />
            <NumberField id="pdf-sign-y" label="Posição vertical" value={yPercent} onChange={(event) => { setYPercent(getNumericValue(event.target.value, 80)); clearResult(); }} suffix="%" disabled={isBusy} />
            <NumberField id="pdf-sign-width" label="Largura" value={widthPercent} onChange={(event) => { setWidthPercent(getNumericValue(event.target.value, 28)); clearResult(); }} suffix="%" disabled={isBusy} />
          </div>

          <Button type="button" className="w-full sm:w-auto" onClick={() => void handleSign()} disabled={isBusy}><Stamp className="size-4" aria-hidden />{isProcessing ? "Adicionando assinatura..." : "Adicionar assinatura"}</Button>
        </section>
      ) : null}

      {result && selectedPdf ? <section aria-live="polite" className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden /><div><h2 className="font-semibold text-emerald-950">Assinatura adicionada com sucesso!</h2><p className="mt-1 text-sm text-emerald-900">Confira a prévia antes de baixar o arquivo.</p></div></div>{previewUrl ? <iframe title="Prévia do PDF assinado" src={previewUrl} className="h-96 w-full rounded-md border border-emerald-200 bg-white sm:h-[32rem]" /> : null}<div className="flex flex-wrap gap-3"><Button type="button" onClick={() => downloadBlob(createPdfBlob(result), `${selectedPdf.file.name.replace(/\.pdf$/i, "") || "documento"}-assinado.pdf`)}><Download className="size-4" aria-hidden />Baixar PDF</Button><Button type="button" variant="secondary" onClick={reset}>Assinar outro PDF</Button></div></section> : null}

      <p className="text-xs leading-relaxed text-zinc-500">Importante: esta é uma assinatura visual. Ela não substitui assinatura digital com certificado, validação jurídica ou assinatura eletrônica com trilha de auditoria.</p>
    </div>
  );
}
