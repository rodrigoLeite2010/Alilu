/**
 * Helpers centrais do Conversor Base64.
 *
 * Tudo aqui roda no navegador (e também no Node, para os testes): nenhum
 * conteúdo é enviado a servidor. As funções trabalham com Uint8Array para
 * suportar qualquer tipo de arquivo e usam TextEncoder/TextDecoder para que
 * textos UTF-8 (acentos, emojis) sejam convertidos corretamente — `btoa` e
 * `atob` sozinhos só lidam com Latin-1.
 */

export interface ParsedDataUri {
  mimeType: string | null;
  base64: string;
}

export class Base64ConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Base64ConversionError";
  }
}

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * Tamanho de bloco usado nas conversões byte <-> string. É múltiplo de 3
 * (para que cada bloco vire Base64 sem padding intermediário) e pequeno o
 * bastante para `String.fromCharCode.apply` não estourar a pilha.
 */
const CHUNK_BYTES = 3 * 8192;

export function parseDataUri(input: string): ParsedDataUri | null {
  const trimmed = input.trim();
  const match = /^data:([^;,]*)((?:;[^;,=]+=[^;,]*)*);base64,([\s\S]*)$/i.exec(trimmed);
  if (!match) return null;
  return {
    mimeType: match[1]?.trim().toLowerCase() || null,
    base64: match[3].trim(),
  };
}

/**
 * Normaliza a entrada: remove prefixo Data URI, espaços e quebras de linha,
 * converte a variante URL-safe (-, _) para o alfabeto padrão e completa o
 * padding "=" quando ele foi omitido.
 */
export function extractBase64(input: string): string {
  const parsed = parseDataUri(input);
  let normalized = (parsed?.base64 ?? input).replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const remainder = normalized.length % 4;
  if (!normalized.includes("=") && (remainder === 2 || remainder === 3)) {
    normalized += "=".repeat(4 - remainder);
  }
  return normalized;
}

export function assertValidBase64(input: string): string {
  const normalized = extractBase64(input);
  if (!normalized) {
    throw new Base64ConversionError("Informe um conteúdo em Base64.");
  }
  if (normalized.length % 4 !== 0 || !BASE64_RE.test(normalized)) {
    throw new Base64ConversionError("Base64 inválido.");
  }
  return normalized;
}

export function isValidBase64(input: string): boolean {
  try {
    assertValidBase64(input);
    return true;
  } catch {
    return false;
  }
}

export function base64ToBytes(input: string): Uint8Array {
  const normalized = assertValidBase64(input);
  let binary: string;
  try {
    binary = atob(normalized);
  } catch {
    throw new Base64ConversionError("Base64 inválido.");
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function chunkToBase64(chunk: Uint8Array): string {
  return btoa(String.fromCharCode.apply(null, chunk as unknown as number[]));
}

/** Converte bytes em Base64 por blocos (sem `String.fromCharCode(...arrayGigante)`). */
export function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let index = 0; index < bytes.length; index += CHUNK_BYTES) {
    parts.push(chunkToBase64(bytes.subarray(index, index + CHUNK_BYTES)));
  }
  return parts.join("");
}

/**
 * Versão assíncrona de `bytesToBase64` para arquivos grandes: devolve o
 * controle ao navegador periodicamente (a interface não congela) e informa
 * o progresso de 0 a 1.
 */
export async function bytesToBase64Async(
  bytes: Uint8Array,
  onProgress?: (progress: number) => void
): Promise<string> {
  const parts: string[] = [];
  const blocksPerTick = 64;
  let block = 0;
  for (let index = 0; index < bytes.length; index += CHUNK_BYTES) {
    parts.push(chunkToBase64(bytes.subarray(index, index + CHUNK_BYTES)));
    block += 1;
    if (block % blocksPerTick === 0) {
      onProgress?.(Math.min(1, (index + CHUNK_BYTES) / bytes.length));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
  onProgress?.(1);
  return parts.join("");
}

export function utf8ToBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text));
}

export function base64ToUtf8(input: string): string {
  const bytes = base64ToBytes(input);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Base64ConversionError("O Base64 foi decodificado, mas não contém texto UTF-8 válido.");
  }
}

export interface AsciiDecodeResult {
  text: string;
  /** Quantidade de bytes fora da faixa ASCII (0–127) */
  nonAsciiBytes: number;
}

/** Decodifica Base64 byte a byte como ASCII, contando bytes fora da tabela. */
export function base64ToAscii(input: string): AsciiDecodeResult {
  const bytes = base64ToBytes(input);
  const parts: string[] = [];
  let nonAsciiBytes = 0;
  for (let index = 0; index < bytes.length; index += CHUNK_BYTES) {
    const chunk = bytes.subarray(index, index + CHUNK_BYTES);
    for (const byte of chunk) if (byte > 0x7f) nonAsciiBytes += 1;
    parts.push(String.fromCharCode.apply(null, chunk as unknown as number[]));
  }
  return { text: parts.join(""), nonAsciiBytes };
}

export interface BasicAuthCredentials {
  user: string;
  password: string;
  full: string;
}

/** Aceita "Basic xxx", "Authorization: Basic xxx" ou apenas o Base64. */
export function decodeBasicAuth(input: string): BasicAuthCredentials {
  const clean = input.trim().replace(/^authorization\s*:\s*/i, "").replace(/^basic\s+/i, "");
  const full = base64ToUtf8(clean);
  const separator = full.indexOf(":");
  if (separator < 0) {
    throw new Base64ConversionError("O conteúdo decodificado não segue o formato usuário:senha.");
  }
  return { user: full.slice(0, separator), password: full.slice(separator + 1), full };
}

export function bytesToHex(bytes: Uint8Array, uppercase = false): string {
  const table = uppercase ? "0123456789ABCDEF" : "0123456789abcdef";
  const parts: string[] = [];
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index];
    parts.push(table[byte >> 4] + table[byte & 0x0f]);
  }
  return parts.join("");
}

export function cleanHex(input: string): string {
  return input.replace(/0x/gi, "").replace(/[\s:,_-]+/g, "");
}

export function hexToBytes(input: string): Uint8Array {
  const normalized = cleanHex(input);
  if (!normalized) {
    throw new Base64ConversionError("Informe uma string hexadecimal.");
  }
  if (/[^0-9a-f]/i.test(normalized)) {
    throw new Base64ConversionError("Hexadecimal inválido: use apenas 0-9 e A-F.");
  }
  if (normalized.length % 2 !== 0) {
    throw new Base64ConversionError("Hexadecimal inválido: a quantidade de dígitos deve ser par.");
  }
  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
  }
  return bytes;
}

export function base64ToHex(input: string, uppercase = false): string {
  return bytesToHex(base64ToBytes(input), uppercase);
}

export function hexToBase64(input: string): string {
  return bytesToBase64(hexToBytes(input));
}

export function buildDataUri(mimeType: string, base64: string): string {
  return `data:${mimeType || "application/octet-stream"};base64,${base64}`;
}

/** Tamanho, em caracteres, do Base64 gerado para `byteLength` bytes. */
export function estimateBase64Length(byteLength: number): number {
  return Math.ceil(byteLength / 3) * 4;
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

export type MediaPreference = "audio" | "video";

/**
 * Detecta o MIME pelos "magic bytes" do conteúdo. Para containers usados
 * tanto por áudio quanto por vídeo (MP4, WebM, Ogg) o parâmetro `prefer`
 * decide qual família devolver.
 */
export function detectMimeFromBytes(
  bytes: Uint8Array,
  fallback = "application/octet-stream",
  prefer?: MediaPreference
): string {
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === "%PDF") return "application/pdf";
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 4) === "PNG") return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 6 && /^GIF8[79]a$/.test(ascii(bytes, 0, 6))) return "image/gif";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF") {
    const format = ascii(bytes, 8, 12);
    if (format === "WEBP") return "image/webp";
    if (format === "WAVE") return "audio/wav";
    if (format === "AVI ") return "video/x-msvideo";
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp") {
    const brand = ascii(bytes, 8, 12);
    if (brand.startsWith("M4A") || prefer === "audio") return "audio/mp4";
    if (brand === "qt  ") return "video/quicktime";
    return "video/mp4";
  }
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return prefer === "audio" ? "audio/webm" : "video/webm";
  }
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === "OggS") {
    return prefer === "video" ? "video/ogg" : "audio/ogg";
  }
  if (bytes.length >= 3 && ascii(bytes, 0, 3) === "ID3") return "audio/mpeg";
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "audio/mpeg";
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === "fLaC") return "audio/flac";
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return "application/zip";
  }
  const head = ascii(bytes, 0, Math.min(bytes.length, 256)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "image/svg+xml";
  return fallback;
}

export function isPdfBytes(bytes: Uint8Array): boolean {
  return detectMimeFromBytes(bytes) === "application/pdf";
}

const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "application/zip": "zip",
  "application/json": "json",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "weba",
  "audio/flac": "flac",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogv",
  "video/quicktime": "mov",
  "video/x-msvideo": "avi",
  "text/css": "css",
  "text/html": "html",
  "text/plain": "txt",
};

export function mimeExtension(mimeType: string): string {
  return EXTENSIONS[mimeType.split(";")[0].trim().toLowerCase()] ?? "bin";
}

export function sanitizeDownloadFileName(name: string, fallback = "arquivo"): string {
  const cleaned = name
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .slice(0, 120)
    .trim();
  return cleaned || fallback;
}

/** Garante uma extensão no nome de download a partir do MIME, quando faltar. */
export function buildDownloadFileName(name: string, mimeType: string, fallback = "arquivo-convertido"): string {
  const base = sanitizeDownloadFileName(name, fallback);
  return /\.[a-z0-9]{2,5}$/i.test(base) ? base : `${base}.${mimeExtension(mimeType)}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: value >= 10 || unitIndex === 0 ? 0 : 1 })} ${units[unitIndex]}`;
}
