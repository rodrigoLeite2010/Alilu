"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, FileCode2, LoaderCircle, ShieldCheck } from "lucide-react";
import { SelectField } from "@/components/forms/SelectField";
import { TextareaField } from "@/components/forms/TextareaField";
import { Button } from "@/components/ui/Button";
import { createPdfBlob, downloadBlob } from "@/lib/pdf/browser-download";
import { createPdfFromHtml, type HtmlPdfOptions } from "@/lib/pdf/html-to-pdf";
import { PdfMergeError } from "@/lib/pdf/merge-pdfs";

const EXAMPLE_HTML = `<h1>Relatório mensal</h1>
<p>Este documento foi convertido localmente no navegador.</p>
<h2>Resumo</h2>
<table>
  <thead><tr><th>Item</th><th>Valor</th></tr></thead>
  <tbody><tr><td>Receita</td><td>R$ 1.500,00</td></tr></tbody>
</table>`;

export function HtmlToPdfTool() {
  const [html, setHtml] = useState("");
  const [orientation, setOrientation] = useState<HtmlPdfOptions["orientation"]>("portrait");
  const [marginMm, setMarginMm] = useState(15);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

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

  async function handleConvert() {
    if (isProcessing) return;

    setError(null);
    replaceResult(null);
    setIsProcessing(true);
    try {
      replaceResult(await createPdfFromHtml(html, { orientation, marginMm }));
    } catch (conversionError) {
      setError(
        conversionError instanceof PdfMergeError && conversionError.message !== conversionError.type
          ? conversionError.message
          : "Não foi possível converter este HTML em PDF."
      );
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 rounded-lg bg-teal-50 p-3 text-sm leading-relaxed text-teal-950">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden />
        O HTML é processado somente no navegador. Esta ferramenta não acessa URLs, arquivos externos ou páginas da internet.
      </p>

      <TextareaField
        id="html-to-pdf-source"
        label="Código HTML"
        value={html}
        onChange={(event) => {
          setHtml(event.target.value);
          replaceResult(null);
        }}
        placeholder={EXAMPLE_HTML}
        rows={14}
        maxLength={250_000}
        disabled={isProcessing}
        hint={`${html.length.toLocaleString("pt-BR")} de 250.000 caracteres. Scripts, links, estilos externos e imagens remotas são removidos por segurança.`}
        className="font-mono"
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField id="html-to-pdf-orientation" label="Orientação" value={orientation} onChange={(event) => { setOrientation(event.target.value as HtmlPdfOptions["orientation"]); replaceResult(null); }} disabled={isProcessing}>
          <option value="portrait">Retrato</option>
          <option value="landscape">Paisagem</option>
        </SelectField>
        <SelectField id="html-to-pdf-margin" label="Margens" value={marginMm} onChange={(event) => { setMarginMm(Number(event.target.value)); replaceResult(null); }} disabled={isProcessing}>
          <option value="10">Estreitas (10 mm)</option>
          <option value="15">Normais (15 mm)</option>
          <option value="25">Largas (25 mm)</option>
        </SelectField>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" className="w-full sm:w-auto" onClick={() => void handleConvert()} disabled={isProcessing}>
          {isProcessing ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <FileCode2 className="size-4" aria-hidden />}
          {isProcessing ? "Gerando PDF..." : "Converter HTML para PDF"}
        </Button>
        {!html && !isProcessing ? <Button type="button" variant="secondary" onClick={() => setHtml(EXAMPLE_HTML)}>Usar exemplo</Button> : null}
      </div>

      {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm leading-relaxed text-red-800">{error}</p> : null}

      {result ? (
        <section aria-live="polite" className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden />
            <div>
              <h2 className="font-semibold text-emerald-950">PDF criado com sucesso!</h2>
              <p className="mt-1 text-sm text-emerald-900">Confira a prévia e baixe o arquivo quando estiver satisfeito.</p>
            </div>
          </div>
          {previewUrl ? <iframe title="Prévia do PDF criado" src={previewUrl} className="h-96 w-full rounded-md border border-emerald-200 bg-white sm:h-[32rem]" /> : null}
          <Button type="button" onClick={() => downloadBlob(createPdfBlob(result), "html-convertido.pdf")}>
            <Download className="size-4" aria-hidden />
            Baixar PDF
          </Button>
        </section>
      ) : null}

      <p className="text-xs leading-relaxed text-zinc-500">Limitação técnica: a conversão usa uma renderização visual local. CSS avançado, JavaScript, fontes externas, páginas externas e imagens remotas não são incluídos.</p>
    </div>
  );
}
