"use client";

import { useEffect, useId, useMemo, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import {
  Base64ConversionError,
  base64ToBytes,
  base64ToHex,
  base64ToUtf8,
  buildDataUri,
  bytesToBase64,
  detectMimeFromBytes,
  extractBase64,
  formatBytes,
  hexToBase64,
  parseDataUri,
  sanitizeDownloadFileName,
  utf8ToBase64,
} from "@/lib/base64/converters";
import type { Base64ToolConfig } from "./base64-tools";

interface ResultState {
  text?: string;
  secondaryText?: string;
  bytes?: Uint8Array;
  mimeType?: string;
  fileName?: string;
  user?: string;
  password?: string;
}

function mimeExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/ogg": "ogv",
    "text/css": "css",
    "text/html": "html",
    "text/plain": "txt",
  };
  return map[mimeType.split(";")[0]] ?? "bin";
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error("Não foi possível ler o arquivo."));
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsArrayBuffer(file);
  });
}

function ensureFileAllowed(file: File, config: Base64ToolConfig): void {
  if (config.maxFileBytes && file.size > config.maxFileBytes) {
    throw new Base64ConversionError("O arquivo é muito grande para processamento no navegador.");
  }
  if (config.id === "pdf-para-base64" && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Base64ConversionError("Envie um arquivo PDF.");
  }
}

export function Base64Tool({ config }: { config: Base64ToolConfig }) {
  const inputId = useId();
  const mimeId = useId();
  const fileNameId = useId();
  const [input, setInput] = useState("");
  const [mimeTypeInput, setMimeTypeInput] = useState(config.defaultMimeType ?? "");
  const [fileNameInput, setFileNameInput] = useState(config.outputFileName ?? "arquivo-convertido");
  const [uppercaseHex, setUppercaseHex] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const isFileEncoder = config.mode === "encode-file";
  const isDecoderWithBlob = config.mode.startsWith("decode-") && !["decode-text", "decode-ascii", "decode-basic-auth", "decode-hex"].includes(config.mode);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const base64SizeInfo = useMemo(() => {
    if (!result?.text) return null;
    const bytes = Math.ceil((extractBase64(result.text).length * 3) / 4);
    return `Resultado aproximado: ${formatBytes(bytes)} em bytes originais.`;
  }, [result?.text]);

  function replaceObjectUrl(url: string | null) {
    setObjectUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return url;
    });
  }

  async function copyText(text: string | undefined) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setMessage("Copiado para a área de transferência.");
  }

  function downloadResult() {
    if (!result?.bytes) return;
    const mimeType = result.mimeType ?? mimeTypeInput || "application/octet-stream";
    const blob = new Blob([result.bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const baseName = sanitizeDownloadFileName(fileNameInput || result.fileName || "arquivo-convertido");
    const hasExtension = /\.[a-z0-9]{2,6}$/i.test(baseName);
    anchor.href = url;
    anchor.download = hasExtension ? baseName : `${baseName}.${mimeExtension(mimeType)}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function clearAll() {
    setInput("");
    setFile(null);
    setResult(null);
    setStatus("idle");
    setMessage(null);
    replaceObjectUrl(null);
  }

  async function convertFile(fileToConvert: File) {
    ensureFileAllowed(fileToConvert, config);
    const bytes = new Uint8Array(await readFileAsArrayBuffer(fileToConvert));
    const base64 = bytesToBase64(bytes);
    const mimeType = fileToConvert.type || "application/octet-stream";
    setResult({
      text: base64,
      secondaryText: config.showDataUri ? buildDataUri(mimeType, base64) : undefined,
      mimeType,
      fileName: fileToConvert.name,
      bytes,
    });
  }

  function convertTextInput() {
    switch (config.mode) {
      case "decode-text": {
        setResult({ text: base64ToUtf8(input) });
        return;
      }
      case "decode-ascii": {
        const bytes = base64ToBytes(input);
        const text = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
        setResult({ text, bytes });
        return;
      }
      case "decode-basic-auth": {
        const clean = input.trim().replace(/^Basic\s+/i, "");
        const decoded = base64ToUtf8(clean);
        const separator = decoded.indexOf(":");
        setResult({
          text: decoded,
          user: separator >= 0 ? decoded.slice(0, separator) : decoded,
          password: separator >= 0 ? decoded.slice(separator + 1) : "",
        });
        return;
      }
      case "decode-hex": {
        const hex = base64ToHex(input, uppercaseHex);
        setResult({ text: hex, bytes: base64ToBytes(input) });
        return;
      }
      case "encode-hex": {
        setResult({ text: hexToBase64(input) });
        return;
      }
      case "encode-text": {
        const base64 = utf8ToBase64(input);
        setResult({
          text: base64,
          secondaryText: config.showDataUri ? buildDataUri(mimeTypeInput || "text/plain;charset=utf-8", base64) : undefined,
        });
        return;
      }
      default: {
        const parsed = parseDataUri(input);
        const bytes = base64ToBytes(input);
        const mimeType = parsed?.mimeType ?? mimeTypeInput || detectMimeFromBytes(bytes);
        const blob = new Blob([bytes], { type: mimeType });
        const url = URL.createObjectURL(blob);
        replaceObjectUrl(url);
        setResult({ bytes, mimeType, fileName: fileNameInput });
      }
    }
  }

  async function handleConvert() {
    setStatus("processing");
    setMessage(null);
    try {
      if (isFileEncoder) {
        if (!file) throw new Base64ConversionError("Escolha um arquivo.");
        await convertFile(file);
      } else {
        convertTextInput();
      }
      setStatus("success");
      setMessage("Conversão concluída.");
    } catch (error) {
      setStatus("error");
      setResult(null);
      replaceObjectUrl(null);
      setMessage(error instanceof Error ? error.message : "Não foi possível converter.");
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setResult(null);
    setMessage(null);
    setStatus("idle");
  }

  return (
    <div className="space-y-5 rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
      {config.securityNotice ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{config.securityNotice}</p>
      ) : null}

      {isFileEncoder ? (
        <div className="space-y-2">
          <label htmlFor={inputId} className="text-sm font-medium text-zinc-800">
            {config.inputLabel}
          </label>
          <input
            id={inputId}
            type="file"
            accept={config.accept}
            onChange={(event) => void handleFileChange(event)}
            className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
          />
          <p className="text-xs text-zinc-500">
            {file ? `${file.name} · ${file.type || "MIME não informado"} · ${formatBytes(file.size)}` : "Base64 normalmente aumenta o tamanho dos dados em cerca de 33%."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <label htmlFor={inputId} className="text-sm font-medium text-zinc-800">
            {config.inputLabel}
          </label>
          <textarea
            id={inputId}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={8}
            placeholder={config.inputPlaceholder}
            aria-invalid={status === "error"}
            className="w-full resize-y rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          />
        </div>
      )}

      {isDecoderWithBlob ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor={fileNameId} className="text-xs font-medium text-zinc-700">
              Nome do arquivo
            </label>
            <input
              id={fileNameId}
              value={fileNameInput}
              onChange={(event) => setFileNameInput(event.target.value)}
              className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={mimeId} className="text-xs font-medium text-zinc-700">
              MIME type opcional
            </label>
            <input
              id={mimeId}
              value={mimeTypeInput}
              onChange={(event) => setMimeTypeInput(event.target.value)}
              placeholder="application/octet-stream"
              className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
            />
          </div>
        </div>
      ) : null}

      {config.mode === "encode-text" && config.showDataUri ? (
        <div className="space-y-1">
          <label htmlFor={mimeId} className="text-xs font-medium text-zinc-700">
            MIME type para Data URI
          </label>
          <input
            id={mimeId}
            value={mimeTypeInput}
            onChange={(event) => setMimeTypeInput(event.target.value)}
            className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
          />
        </div>
      ) : null}

      {config.uppercaseOption ? (
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" checked={uppercaseHex} onChange={(event) => setUppercaseHex(event.target.checked)} />
          Letras maiúsculas no hexadecimal
        </label>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void handleConvert()} disabled={status === "processing"}>
          {status === "processing" ? "Processando..." : "Converter"}
        </Button>
        <Button type="button" variant="secondary" onClick={clearAll}>
          Limpar
        </Button>
        {result?.text ? (
          <Button type="button" variant="secondary" onClick={() => void copyText(result.text)}>
            Copiar resultado
          </Button>
        ) : null}
        {result?.secondaryText ? (
          <Button type="button" variant="secondary" onClick={() => void copyText(result.secondaryText)}>
            Copiar Data URI
          </Button>
        ) : null}
        {result?.bytes && isDecoderWithBlob ? (
          <Button type="button" variant="secondary" onClick={downloadResult}>
            Baixar arquivo
          </Button>
        ) : null}
      </div>

      {message ? (
        <p role={status === "error" ? "alert" : "status"} className={status === "error" ? "rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" : "rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800"}>
          {message}
        </p>
      ) : null}

      {result ? (
        <section className="space-y-3 rounded-lg bg-zinc-50 p-3">
          {result.user !== undefined ? (
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <p><strong>Usuário:</strong> {result.user}</p>
              <p><strong>Senha:</strong> {result.password}</p>
              <p><strong>Completo:</strong> {result.text}</p>
            </div>
          ) : null}

          {result.text && result.user === undefined ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-zinc-600">Resultado</p>
              <textarea readOnly value={result.text} rows={7} className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm" />
              {result.bytes ? <p className="text-xs text-zinc-500">{result.bytes.length} bytes</p> : null}
              {base64SizeInfo && isFileEncoder ? <p className="text-xs text-zinc-500">{base64SizeInfo}</p> : null}
            </div>
          ) : null}

          {result.secondaryText ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-zinc-600">Data URI</p>
              <textarea readOnly value={result.secondaryText} rows={4} className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm" />
            </div>
          ) : null}

          {objectUrl && result.mimeType?.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview local por Blob URL gerado no navegador
            <img src={objectUrl} alt="Prévia da imagem convertida" className="max-h-96 rounded-md border border-zinc-200 bg-white object-contain" />
          ) : null}
          {objectUrl && result.mimeType?.startsWith("audio/") ? <audio src={objectUrl} controls className="w-full" /> : null}
          {objectUrl && result.mimeType?.startsWith("video/") ? <video src={objectUrl} controls className="max-h-96 w-full rounded-md bg-black" /> : null}
          {objectUrl && result.mimeType === "application/pdf" ? (
            <object data={objectUrl} type="application/pdf" className="h-[520px] w-full rounded-md border border-zinc-200">
              <a href={objectUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-teal-700 underline">
                Visualizar PDF
              </a>
            </object>
          ) : null}
          {result.bytes && isDecoderWithBlob ? (
            <p className="text-xs text-zinc-500">
              MIME: {result.mimeType ?? "não detectado"} · Tamanho: {formatBytes(result.bytes.length)}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
