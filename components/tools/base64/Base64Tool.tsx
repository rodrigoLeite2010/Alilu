"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FileUploadDropzone } from "@/components/tools/pdf-shared/FileUploadDropzone";
import {
  Base64ConversionError,
  base64ToAscii,
  base64ToBytes,
  base64ToUtf8,
  buildDataUri,
  buildDownloadFileName,
  bytesToBase64Async,
  bytesToHex,
  decodeBasicAuth,
  detectMimeFromBytes,
  estimateBase64Length,
  formatBytes,
  hexToBase64,
  parseDataUri,
  utf8ToBase64,
} from "@/lib/base64/converters";
import { Base64Output } from "./Base64Output";
import {
  LARGE_FILE_WARNING_BYTES,
  MB,
  type Base64Media,
  type Base64ToolConfig,
} from "./base64-tools";

type Status = "idle" | "processing" | "success" | "error";
type UrlMode = "text" | "remote";

interface ResultState {
  /** Resultado textual principal (Base64, texto decodificado etc.) */
  text?: string;
  dataUri?: string;
  bytes?: Uint8Array;
  mimeType?: string;
  /** Tamanho dos dados originais (antes do Base64), em bytes */
  originalBytes?: number;
  user?: string;
  password?: string;
  nonAsciiBytes?: number;
}

const MEDIA_ERROR: Record<Exclude<Base64Media, "file">, string> = {
  image: "O Base64 informado não parece ser uma imagem PNG, JPG, GIF, WEBP ou SVG.",
  audio: "O Base64 informado não parece ser um arquivo de áudio.",
  video: "O Base64 informado não parece ser um arquivo de vídeo.",
  pdf: "O Base64 informado não parece ser um PDF válido (o arquivo não começa com %PDF).",
};

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Base64ConversionError("Não foi possível ler o arquivo."));
    };
    reader.onerror = () => reject(new Base64ConversionError("Não foi possível ler o arquivo."));
    reader.readAsArrayBuffer(file);
  });
}

function fileMatchesMedia(file: File, media: Base64Media | undefined): boolean {
  const name = file.name.toLowerCase();
  switch (media) {
    case "pdf":
      return file.type === "application/pdf" || name.endsWith(".pdf");
    case "image":
      return /^image\/(png|jpeg|gif|webp|svg\+xml)$/.test(file.type) || /\.(png|jpe?g|gif|webp|svg)$/.test(name);
    case "audio":
      return file.type.startsWith("audio/") || /\.(mp3|wav|ogg|oga|m4a|aac|flac|weba|opus)$/.test(name);
    case "video":
      return file.type.startsWith("video/") || /\.(mp4|webm|ogv|mov|m4v)$/.test(name);
    default:
      return true;
  }
}

function guessMimeFromName(name: string): string | undefined {
  const extension = name.toLowerCase().split(".").pop();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    mp4: "video/mp4",
    webm: "video/webm",
    ogv: "video/ogg",
    mov: "video/quicktime",
    css: "text/css",
    html: "text/html",
    txt: "text/plain",
  };
  return extension ? map[extension] : undefined;
}

function resolveDecodedMime(
  config: Base64ToolConfig,
  bytes: Uint8Array,
  dataUriMime: string | null,
  customMime: string
): string {
  const media = config.media ?? "file";
  const prefer = media === "audio" || media === "video" ? media : undefined;
  const detected = detectMimeFromBytes(bytes, "", prefer);
  const fallback = config.defaultMimeType ?? "application/octet-stream";

  if (media === "file") {
    return dataUriMime || customMime.trim() || detected || fallback;
  }

  const candidate = dataUriMime || detected;
  const family = media === "pdf" ? "application/pdf" : `${media}/`;
  if (media === "pdf") {
    if (detected !== "application/pdf") throw new Base64ConversionError(MEDIA_ERROR.pdf);
    return "application/pdf";
  }
  if (candidate && candidate.startsWith(family)) return candidate;
  if (media === "image") throw new Base64ConversionError(MEDIA_ERROR.image);
  // Áudio e vídeo: alguns formatos não têm assinatura simples; se nada
  // contradiz o tipo esperado, usamos o MIME padrão e deixamos o player
  // do navegador decidir se consegue reproduzir.
  if (!candidate || candidate === "application/octet-stream") return fallback;
  throw new Base64ConversionError(MEDIA_ERROR[media]);
}

async function fetchRemoteBytes(rawUrl: string, maxBytes: number, signal: AbortSignal) {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Base64ConversionError("Informe uma URL completa, começando com https://.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Base64ConversionError("Somente URLs http:// ou https:// são aceitas.");
  }

  let response: Response;
  try {
    // A requisição sai do navegador do próprio usuário (sem proxy no
    // servidor do Alilu, portanto sem risco de SSRF), sem cookies e sem
    // referrer. O navegador aplica CORS normalmente.
    response = await fetch(url.toString(), {
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Base64ConversionError(
      "Não foi possível baixar o conteúdo. O site pode bloquear o acesso a partir de outros domínios (CORS) ou estar fora do ar."
    );
  }
  if (!response.ok) {
    throw new Base64ConversionError(`O servidor respondeu com erro ${response.status}.`);
  }

  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes) {
    throw new Base64ConversionError(`O arquivo remoto passa do limite de ${formatBytes(maxBytes)}.`);
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0].trim() || "application/octet-stream";
  if (!response.body) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.length > maxBytes) {
      throw new Base64ConversionError(`O arquivo remoto passa do limite de ${formatBytes(maxBytes)}.`);
    }
    return { bytes: buffer, mimeType };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Base64ConversionError(`O arquivo remoto passa do limite de ${formatBytes(maxBytes)}.`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return { bytes, mimeType };
}

export function Base64Tool({ config }: { config: Base64ToolConfig }) {
  const inputId = useId();
  const mimeId = useId();
  const fileNameId = useId();
  const messageId = useId();
  const cssFileId = useId();
  const [input, setInput] = useState("");
  const [customMime, setCustomMime] = useState("");
  const [dataUriMime, setDataUriMime] = useState(config.defaultMimeType ?? "text/plain;charset=utf-8");
  const [fileName, setFileName] = useState(config.outputFileName ?? "arquivo-convertido");
  const [uppercaseHex, setUppercaseHex] = useState(false);
  const [urlMode, setUrlMode] = useState<UrlMode>("text");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isFileEncoder = config.mode === "encode-file";
  const isBlobDecoder = config.mode === "decode-blob";
  const isRemoteUrl = config.mode === "encode-url" && urlMode === "remote";
  const hasError = status === "error";

  // Libera o Blob URL anterior sempre que ele é trocado e ao desmontar.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function showPreview(blob: Blob | null) {
    setDimensions(null);
    setPreviewUrl(blob ? URL.createObjectURL(blob) : null);
  }

  function fail(error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    setStatus("error");
    setResult(null);
    if (isBlobDecoder) showPreview(null);
    setMessage(
      error instanceof Base64ConversionError
        ? error.message
        : "Não foi possível converter. Verifique o conteúdo e tente novamente."
    );
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Copiado para a área de transferência.");
      setStatus("success");
    } catch {
      setMessage("Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.");
      setStatus("error");
    }
  }

  function triggerDownload(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Dá tempo ao navegador de iniciar o download antes de liberar a URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadText(value: string, name: string) {
    triggerDownload(new Blob([value], { type: "text/plain;charset=utf-8" }), name);
  }

  function downloadDecoded() {
    if (!result?.bytes) return;
    const mimeType = result.mimeType ?? "application/octet-stream";
    const bytes = result.bytes;
    const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], {
      type: mimeType,
    });
    triggerDownload(blob, buildDownloadFileName(fileName, mimeType, config.outputFileName));
  }

  function clearAll() {
    abortRef.current?.abort();
    setInput("");
    setFile(null);
    setResult(null);
    setStatus("idle");
    setMessage(null);
    setProgress(null);
    showPreview(null);
  }

  function selectFile(nextFile: File | null) {
    setResult(null);
    setMessage(null);
    setStatus("idle");
    setFile(nextFile);
    if (!nextFile) return;
    if (!fileMatchesMedia(nextFile, config.media)) {
      setFile(null);
      setStatus("error");
      setMessage("Arquivo não suportado.");
      return;
    }
    if (config.maxFileBytes && nextFile.size > config.maxFileBytes) {
      setFile(null);
      setStatus("error");
      setMessage(
        `O arquivo é muito grande para processamento no navegador. Limite: ${formatBytes(config.maxFileBytes)}.`
      );
      return;
    }
    if (config.media === "image" || config.media === "audio" || config.media === "video") {
      showPreview(nextFile);
    } else {
      showPreview(null);
    }
  }

  async function handleCssFile(event: ChangeEvent<HTMLInputElement>) {
    const cssFile = event.target.files?.[0];
    event.target.value = "";
    if (!cssFile) return;
    if (config.maxFileBytes && cssFile.size > config.maxFileBytes) {
      setStatus("error");
      setMessage(`O arquivo é muito grande. Limite: ${formatBytes(config.maxFileBytes)}.`);
      return;
    }
    setInput(await cssFile.text());
    setResult(null);
    setStatus("idle");
    setMessage(`Arquivo ${cssFile.name} carregado. Clique em Converter.`);
  }

  async function encodeBytes(bytes: Uint8Array, mimeType: string) {
    const base64 = await bytesToBase64Async(bytes, bytes.length > 2 * MB ? setProgress : undefined);
    setResult({
      text: base64,
      dataUri: config.showDataUri ? buildDataUri(mimeType, base64) : undefined,
      mimeType,
      originalBytes: bytes.length,
    });
  }

  function decodeBlob() {
    const parsed = parseDataUri(input);
    const bytes = base64ToBytes(input);
    if (bytes.length === 0) throw new Base64ConversionError("Base64 inválido.");
    const mimeType = resolveDecodedMime(config, bytes, parsed?.mimeType ?? null, customMime);
    showPreview(new Blob([bytes as BlobPart], { type: mimeType }));
    setResult({ bytes, mimeType, originalBytes: bytes.length });
  }

  function convertText() {
    switch (config.mode) {
      case "decode-text":
        setResult({ text: base64ToUtf8(input) });
        return;
      case "decode-ascii": {
        const decoded = base64ToAscii(input);
        setResult({ text: decoded.text, nonAsciiBytes: decoded.nonAsciiBytes, originalBytes: decoded.text.length });
        return;
      }
      case "decode-basic-auth": {
        const credentials = decodeBasicAuth(input);
        setResult({ text: credentials.full, user: credentials.user, password: credentials.password });
        return;
      }
      case "decode-hex": {
        const bytes = base64ToBytes(input);
        setResult({ bytes, originalBytes: bytes.length });
        return;
      }
      case "encode-hex": {
        const base64 = hexToBase64(input);
        setResult({ text: base64, originalBytes: Math.ceil((base64.length / 4) * 3) - (base64.match(/=+$/)?.[0].length ?? 0) });
        return;
      }
      case "encode-text":
      case "encode-url": {
        if (!input.trim()) throw new Base64ConversionError(config.mode === "encode-url" ? "Informe uma URL." : "Informe um conteúdo para converter.");
        const value = config.mode === "encode-url" ? input.trim() : input;
        const base64 = utf8ToBase64(value);
        setResult({
          text: base64,
          dataUri: config.showDataUri && config.mode === "encode-text" ? buildDataUri(dataUriMime, base64) : undefined,
          originalBytes: new TextEncoder().encode(value).length,
        });
        return;
      }
      default:
        decodeBlob();
    }
  }

  async function handleConvert() {
    setStatus("processing");
    setMessage(null);
    setProgress(null);
    setResult(null);
    try {
      if (isFileEncoder) {
        if (!file) throw new Base64ConversionError("Escolha um arquivo.");
        const bytes = new Uint8Array(await readFileAsArrayBuffer(file));
        if (config.media === "pdf" && detectMimeFromBytes(bytes) !== "application/pdf") {
          throw new Base64ConversionError("O arquivo não parece ser um PDF válido.");
        }
        await encodeBytes(bytes, file.type || guessMimeFromName(file.name) || "application/octet-stream");
      } else if (isRemoteUrl) {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        const remote = await fetchRemoteBytes(input, config.maxFileBytes ?? 20 * MB, controller.signal);
        await encodeBytes(remote.bytes, remote.mimeType);
      } else {
        // Deixa o React pintar o estado "processando" antes de conversões grandes.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        convertText();
      }
      setStatus("success");
      setMessage("Conversão concluída.");
    } catch (error) {
      fail(error);
    } finally {
      setProgress(null);
    }
  }

  const hexText = result?.bytes && config.mode === "decode-hex" ? bytesToHex(result.bytes, uppercaseHex) : null;
  const showSizeInfo = Boolean(result?.text && result.originalBytes !== undefined && config.group === "encode");

  return (
    <div className="min-w-0 space-y-5 rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
      {config.securityNotice ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{config.securityNotice}</p>
      ) : null}

      {config.mode === "encode-url" ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-zinc-800">O que você quer converter?</legend>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
            <label className="flex items-start gap-2 text-sm text-zinc-700">
              <input
                type="radio"
                name={`${inputId}-url-mode`}
                value="text"
                checked={urlMode === "text"}
                onChange={() => {
                  setUrlMode("text");
                  setResult(null);
                  setMessage(null);
                }}
                className="mt-1"
              />
              <span>
                <strong className="font-semibold text-zinc-900">Texto da URL</strong> — codifica o endereço em si
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-zinc-700">
              <input
                type="radio"
                name={`${inputId}-url-mode`}
                value="remote"
                checked={urlMode === "remote"}
                onChange={() => {
                  setUrlMode("remote");
                  setResult(null);
                  setMessage(null);
                }}
                className="mt-1"
              />
              <span>
                <strong className="font-semibold text-zinc-900">Conteúdo da URL</strong> — baixa o arquivo pelo seu navegador
              </span>
            </label>
          </div>
          {urlMode === "remote" ? (
            <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-600">
              O download é feito direto pelo seu navegador, sem passar pelo servidor do Alilu e sem enviar cookies.
              Só funciona com sites que permitem acesso de outros domínios (CORS). Limite: {formatBytes(config.maxFileBytes ?? 20 * MB)}.
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {isFileEncoder ? (
        <div className="space-y-3">
          <FileUploadDropzone
            inputId={inputId}
            title={file ? file.name : `Selecione ou arraste: ${config.inputLabel.toLowerCase()}`}
            description={
              file
                ? `${file.type || "MIME não informado"} · ${formatBytes(file.size)}`
                : `${config.acceptDescription ?? "Arquivo"} — processado localmente, nada é enviado.`
            }
            limitDescription={`Limite: ${formatBytes(config.maxFileBytes ?? 100 * MB)}. Base64 normalmente aumenta o tamanho dos dados em cerca de 33%.`}
            accept={config.accept ?? ""}
            buttonLabel={file ? "Trocar arquivo" : "Escolher arquivo"}
            disabled={status === "processing"}
            onFilesSelected={(files) => selectFile(files[0] ?? null)}
          />
          {file && file.size > LARGE_FILE_WARNING_BYTES ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Arquivo grande: a conversão pode levar alguns segundos e o resultado terá cerca de{" "}
              {formatBytes(estimateBase64Length(file.size))}.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          <label htmlFor={inputId} className="text-sm font-medium text-zinc-800">
            {config.mode === "encode-url" && urlMode === "remote" ? "URL do arquivo" : config.inputLabel}
          </label>
          {config.mode === "encode-url" ? (
            <input
              id={inputId}
              type="url"
              inputMode="url"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={config.inputPlaceholder}
              aria-invalid={hasError}
              aria-describedby={message ? messageId : undefined}
              className="h-11 w-full min-w-0 rounded-md border border-zinc-300 px-3 font-mono text-sm text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            />
          ) : (
            <textarea
              id={inputId}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={8}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              placeholder={config.inputPlaceholder}
              aria-invalid={hasError}
              aria-describedby={message ? messageId : undefined}
              className="block w-full min-w-0 resize-y break-all rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            />
          )}
          {config.id === "css-para-base64" ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
              <label htmlFor={cssFileId} className="font-medium text-zinc-800">
                Ou envie um arquivo .css:
              </label>
              <input
                id={cssFileId}
                type="file"
                accept={config.accept}
                onChange={(event) => void handleCssFile(event)}
                className="max-w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
            </div>
          ) : null}
        </div>
      )}

      {isBlobDecoder ? (
        <div className={`grid gap-3 ${config.allowCustomMime ? "sm:grid-cols-2" : ""}`}>
          <div className="min-w-0 space-y-1">
            <label htmlFor={fileNameId} className="text-xs font-medium text-zinc-700">
              Nome do arquivo para download
            </label>
            <input
              id={fileNameId}
              value={fileName}
              onChange={(event) => setFileName(event.target.value)}
              className="h-11 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            />
            <p className="text-xs text-zinc-500">A extensão é adicionada automaticamente se você não informar.</p>
          </div>
          {config.allowCustomMime ? (
            <div className="min-w-0 space-y-1">
              <label htmlFor={mimeId} className="text-xs font-medium text-zinc-700">
                MIME type (opcional)
              </label>
              <input
                id={mimeId}
                value={customMime}
                onChange={(event) => setCustomMime(event.target.value)}
                placeholder="Detectado automaticamente"
                className="h-11 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {config.mode === "encode-text" && config.showDataUri ? (
        <div className="min-w-0 space-y-1">
          <label htmlFor={mimeId} className="text-xs font-medium text-zinc-700">
            MIME type do Data URI
          </label>
          <input
            id={mimeId}
            value={dataUriMime}
            onChange={(event) => setDataUriMime(event.target.value)}
            className="h-11 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          />
        </div>
      ) : null}

      {config.uppercaseOption ? (
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" checked={uppercaseHex} onChange={(event) => setUppercaseHex(event.target.checked)} />
          Letras maiúsculas (A-F)
        </label>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void handleConvert()} disabled={status === "processing"}>
          {status === "processing" ? "Processando..." : "Converter"}
        </Button>
        <Button type="button" variant="secondary" onClick={clearAll}>
          Limpar
        </Button>
        {result?.bytes && isBlobDecoder ? (
          <Button type="button" variant="secondary" onClick={downloadDecoded}>
            {config.media === "pdf" ? "Baixar PDF" : "Baixar arquivo"}
          </Button>
        ) : null}
        {previewUrl && result && config.media === "pdf" ? (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold text-teal-800 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            Visualizar PDF
          </a>
        ) : null}
      </div>

      {progress !== null ? (
        <div className="space-y-1">
          <div
            role="progressbar"
            aria-label="Progresso da conversão"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            className="h-2 w-full overflow-hidden rounded-full bg-zinc-100"
          >
            <div className="h-full bg-teal-600 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="text-xs text-zinc-500">Convertendo… {Math.round(progress * 100)}%</p>
        </div>
      ) : null}

      <div aria-live="polite">
        {message ? (
          <p
            id={messageId}
            role={hasError ? "alert" : "status"}
            className={
              hasError
                ? "rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
                : "rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800"
            }
          >
            {message}
          </p>
        ) : null}
      </div>

      {isFileEncoder && previewUrl && file && !result ? (
        <FilePreview url={previewUrl} media={config.media} onDimensions={setDimensions} dimensions={dimensions} />
      ) : null}

      {result ? (
        <section aria-label="Resultado" className="min-w-0 space-y-4 rounded-lg bg-zinc-50 p-3 sm:p-4">
          {result.user !== undefined ? (
            <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
              <CredentialField label="Usuário" value={result.user} onCopy={copyText} />
              <CredentialField label="Senha" value={result.password ?? ""} onCopy={copyText} />
              <div className="sm:col-span-2">
                <CredentialField label="Conteúdo completo (usuário:senha)" value={result.text ?? ""} onCopy={copyText} />
              </div>
            </dl>
          ) : null}

          {hexText !== null ? (
            <>
              <Base64Output label="Hexadecimal" value={hexText} copyLabel="Copiar hexadecimal" onCopy={copyText} />
              <p className="text-xs text-zinc-500">{result.bytes?.length.toLocaleString("pt-BR")} bytes</p>
            </>
          ) : null}

          {result.text && result.user === undefined ? (
            <Base64Output
              label={config.group === "encode" ? "Base64" : "Resultado"}
              value={result.text}
              rows={config.group === "encode" ? 6 : 8}
              copyLabel={config.group === "encode" ? "Copiar Base64" : "Copiar resultado"}
              onCopy={copyText}
              downloadName={config.group === "encode" ? `${config.id}.txt` : undefined}
              onDownloadText={downloadText}
            />
          ) : null}

          {result.nonAsciiBytes ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {result.nonAsciiBytes.toLocaleString("pt-BR")} byte(s) estão fora da tabela ASCII (0–127) e foram
              exibidos como caracteres Latin-1. Para textos com acentos em UTF-8, use Base64 para Texto.
            </p>
          ) : null}

          {result.dataUri ? (
            <Base64Output label="Data URI" value={result.dataUri} rows={4} copyLabel="Copiar Data URI" onCopy={copyText} />
          ) : null}

          {showSizeInfo ? (
            <p className="text-xs text-zinc-500">
              Original: {formatBytes(result.originalBytes ?? 0)} · Base64: {formatBytes(result.text?.length ?? 0)}.
              Base64 normalmente aumenta o tamanho dos dados em cerca de 33%.
            </p>
          ) : null}

          {isFileEncoder && previewUrl ? (
            <FilePreview url={previewUrl} media={config.media} onDimensions={setDimensions} dimensions={dimensions} />
          ) : null}

          {isBlobDecoder && previewUrl ? (
            <FilePreview url={previewUrl} media={config.media === "file" ? mediaFromMime(result.mimeType) : config.media} onDimensions={setDimensions} dimensions={null} />
          ) : null}

          {result.bytes && isBlobDecoder ? (
            <p className="text-xs text-zinc-500">
              MIME: {result.mimeType ?? "não detectado"} · Tamanho: {formatBytes(result.bytes.length)}
              {dimensions ? ` · Dimensões: ${dimensions.width} × ${dimensions.height} px` : ""}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function mediaFromMime(mimeType: string | undefined): Base64Media {
  if (!mimeType) return "file";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";
  return "file";
}

function FilePreview({
  url,
  media,
  dimensions,
  onDimensions,
}: {
  url: string;
  media: Base64Media | undefined;
  dimensions: { width: number; height: number } | null;
  onDimensions: (value: { width: number; height: number }) => void;
}) {
  if (media === "image") {
    return (
      <figure className="space-y-1">
        {/* eslint-disable-next-line @next/next/no-img-element -- prévia local via Blob URL gerado no navegador */}
        <img
          src={url}
          alt="Prévia da imagem"
          onLoad={(event) =>
            onDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })
          }
          className="max-h-96 max-w-full rounded-md border border-zinc-200 bg-white object-contain"
        />
        {dimensions ? (
          <figcaption className="text-xs text-zinc-500">
            {dimensions.width} × {dimensions.height} px
          </figcaption>
        ) : null}
      </figure>
    );
  }
  if (media === "audio") {
    return <audio src={url} controls className="w-full" aria-label="Prévia do áudio" />;
  }
  if (media === "video") {
    return <video src={url} controls className="max-h-96 w-full rounded-md bg-black" aria-label="Prévia do vídeo" />;
  }
  if (media === "pdf") {
    return (
      <object data={url} type="application/pdf" aria-label="Prévia do PDF" className="h-[420px] w-full rounded-md border border-zinc-200 bg-white sm:h-[560px]">
        <p className="p-3 text-sm text-zinc-600">
          Seu navegador não exibe PDFs incorporados. Use o botão &quot;Visualizar PDF&quot; ou baixe o arquivo.
        </p>
      </object>
    );
  }
  return null;
}

function CredentialField({ label, value, onCopy }: { label: string; value: string; onCopy: (value: string) => void }) {
  return (
    <div className="min-w-0 rounded-md border border-zinc-200 bg-white p-3">
      <dt className="text-xs font-medium text-zinc-600">{label}</dt>
      <dd className="mt-1 flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 break-all font-mono text-sm text-zinc-900">{value || "(vazio)"}</span>
        <button
          type="button"
          onClick={() => onCopy(value)}
          aria-label={`Copiar ${label.toLowerCase()}`}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-teal-800 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          Copiar
        </button>
      </dd>
    </div>
  );
}
