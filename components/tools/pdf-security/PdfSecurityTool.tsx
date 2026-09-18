"use client";

import { useState } from "react";
import { CheckCircle2, Download, FileLock2, FileText, LoaderCircle, ShieldCheck, Trash2 } from "lucide-react";
import { TextField } from "@/components/forms/TextField";
import { Button } from "@/components/ui/Button";
import { FileUploadDropzone } from "@/components/tools/pdf-shared/FileUploadDropzone";
import { createPdfBlob, downloadBlob } from "@/lib/pdf/browser-download";
import { formatPdfFileSize, inspectPdfFile, PdfMergeError, readPdfFileBytes, type PdfFileError } from "@/lib/pdf/merge-pdfs";
import { protectPdf, unlockPdf } from "@/lib/pdf/security-pdf";

type SecurityMode = "protect" | "unlock";

function getValidationError(fileName: string, error: PdfFileError): string {
  switch (error) {
    case "too-large": return `O arquivo "${fileName}" excede o limite de 50 MB.`;
    case "password-protected": return `O arquivo "${fileName}" já está protegido por senha. Use Desbloquear PDF para remover uma senha autorizada.`;
    case "no-pages": return `O arquivo "${fileName}" não possui páginas para processar.`;
    case "read-failed": return `Não foi possível ler o arquivo "${fileName}".`;
    case "corrupted": return `O arquivo "${fileName}" parece estar corrompido.`;
    case "not-pdf":
    default: return `O arquivo "${fileName}" não é um PDF válido.`;
  }
}

function FileSummary({ file, disabled, onClear }: { file: File; disabled: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-3">
      <div className="flex min-w-0 items-center gap-3"><span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-teal-700"><FileText className="size-5" aria-hidden /></span><div className="min-w-0"><p className="break-all text-sm font-medium text-zinc-900">{file.name}</p><p className="mt-0.5 text-xs text-zinc-500">{formatPdfFileSize(file.size)}</p></div></div>
      <button type="button" className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-red-700 transition-colors hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Remover ${file.name}`} title="Remover arquivo" onClick={onClear} disabled={disabled}><Trash2 className="size-4" aria-hidden /></button>
    </div>
  );
}

export function PdfSecurityTool({ mode }: { mode: SecurityMode }) {
  const isProtectMode = mode === "protect";
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [allowCopying, setAllowCopying] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Uint8Array | null>(null);

  const isBusy = isInspecting || isProcessing;

  async function selectFile(files: File[]) {
    const selected = files[0];
    if (!selected || isBusy) return;
    setError(null);
    setResult(null);
    setIsInspecting(true);
    try {
      if (isProtectMode) {
        const validation = await inspectPdfFile(selected);
        if (!validation.ok) {
          setFile(null);
          setError(getValidationError(selected.name, validation.error));
          return;
        }
      } else {
        await readPdfFileBytes(selected);
      }
      setFile(selected);
    } catch (validationError) {
      setFile(null);
      setError(validationError instanceof Error ? validationError.message : "Não foi possível ler este PDF.");
    } finally {
      setIsInspecting(false);
    }
  }

  async function handleProcess() {
    if (!file || isBusy) return;
    setError(null);
    setResult(null);

    if (isProtectMode && password !== confirmation) {
      setError("A confirmação da senha não corresponde à senha informada.");
      return;
    }

    setIsProcessing(true);
    try {
      const bytes = isProtectMode
        ? await protectPdf(file, password, { ownerPassword, allowPrinting, allowCopying })
        : await unlockPdf(file, password);
      setResult(bytes);
    } catch (securityError) {
      setError(
        securityError instanceof PdfMergeError && securityError.message !== securityError.type
          ? securityError.message
          : `Não foi possível ${isProtectMode ? "proteger" : "desbloquear"} este PDF.`
      );
    } finally {
      setIsProcessing(false);
    }
  }

  function reset() {
    if (isBusy) return;
    setFile(null);
    setPassword("");
    setConfirmation("");
    setOwnerPassword("");
    setError(null);
    setResult(null);
  }

  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 rounded-lg bg-teal-50 p-3 text-sm leading-relaxed text-teal-950"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden />O PDF e as senhas são processados somente no navegador. Nenhuma senha é enviada, salva ou registrada pelo site.</p>
      {!file ? <FileUploadDropzone inputId={`pdf-${mode}-input`} title="Arraste um PDF aqui" description={isProtectMode ? "Selecione um PDF sem senha para criar uma proteção." : "Selecione um PDF protegido cuja senha você está autorizado a usar."} limitDescription="Limite técnico: até 50 MB por PDF." accept="application/pdf,.pdf" buttonLabel="Selecionar PDF" disabled={isBusy} onFilesSelected={selectFile} /> : <FileSummary file={file} disabled={isBusy} onClear={reset} />}
      {isInspecting ? <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-zinc-600"><LoaderCircle className="size-4 animate-spin" aria-hidden />Verificando PDF...</p> : null}
      {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm leading-relaxed text-red-800">{error}</p> : null}

      {file ? (
        <section aria-labelledby={`pdf-${mode}-options-heading`} className="space-y-5">
          <h2 id={`pdf-${mode}-options-heading`} className="text-base font-semibold text-zinc-900">{isProtectMode ? "Configurar proteção" : "Informar senha autorizada"}</h2>
          <TextField id={`pdf-${mode}-password`} label={isProtectMode ? "Senha para abrir o PDF" : "Senha atual do PDF"} type="password" autoComplete={isProtectMode ? "new-password" : "current-password"} value={password} onChange={(event) => { setPassword(event.target.value); setResult(null); }} hint={isProtectMode ? "Use pelo menos 4 caracteres." : "Esta ferramenta não tenta adivinhar senhas."} disabled={isBusy} />
          {isProtectMode ? <TextField id="pdf-protect-confirmation" label="Confirmar senha" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setResult(null); }} disabled={isBusy} /> : null}
          {isProtectMode ? <>
            <TextField id="pdf-protect-owner" label="Senha do proprietário" type="password" autoComplete="new-password" value={ownerPassword} onChange={(event) => { setOwnerPassword(event.target.value); setResult(null); }} hint="Opcional. Informe uma senha diferente para aplicar restrições de impressão e cópia." disabled={isBusy} />
            <fieldset className="space-y-3" disabled={isBusy || !ownerPassword.trim()}><legend className="text-sm font-medium text-zinc-700">Permissões para quem abre com a senha comum</legend><label className="flex min-h-11 items-center gap-3 text-sm text-zinc-700"><input type="checkbox" checked={allowPrinting} onChange={(event) => { setAllowPrinting(event.target.checked); setResult(null); }} />Permitir impressão</label><label className="flex min-h-11 items-center gap-3 text-sm text-zinc-700"><input type="checkbox" checked={allowCopying} onChange={(event) => { setAllowCopying(event.target.checked); setResult(null); }} />Permitir copiar conteúdo</label></fieldset>
            {!ownerPassword.trim() ? <p className="text-xs leading-relaxed text-zinc-500">Sem senha do proprietário, o PDF pede senha para abrir, mas as permissões avançadas não são restringidas.</p> : null}
          </> : null}
          <Button type="button" className="w-full sm:w-auto" onClick={() => void handleProcess()} disabled={isBusy}><FileLock2 className="size-4" aria-hidden />{isProcessing ? (isProtectMode ? "Protegendo PDF..." : "Desbloqueando PDF...") : (isProtectMode ? "Proteger PDF" : "Desbloquear PDF")}</Button>
        </section>
      ) : null}

      {result && file ? <section aria-live="polite" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden /><div><h2 className="font-semibold text-emerald-950">{isProtectMode ? "PDF protegido com sucesso!" : "PDF desbloqueado com sucesso!"}</h2><p className="mt-1 text-sm text-emerald-900">{isProtectMode ? "O novo arquivo solicita a senha definida quando for aberto." : "O novo arquivo não possui a proteção de senha compatível removida."}</p></div></div><div className="mt-4 flex flex-wrap gap-3"><Button type="button" onClick={() => downloadBlob(createPdfBlob(result), `${file.name.replace(/\.pdf$/i, "") || "documento"}-${isProtectMode ? "protegido" : "desbloqueado"}.pdf`)}><Download className="size-4" aria-hidden />Baixar PDF</Button><Button type="button" variant="secondary" onClick={reset}>Processar outro PDF</Button></div></section> : null}

      <p className="text-xs leading-relaxed text-zinc-500">{isProtectMode ? "A proteção usa AES-256 compatível com leitores modernos de PDF. Restrições de cópia e impressão dependem de o leitor respeitar as permissões do arquivo." : "Desbloqueie somente documentos para os quais você possui autorização e a senha. AES-128 e outros formatos de criptografia não suportados permanecem protegidos."}</p>
    </div>
  );
}
