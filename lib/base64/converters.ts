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

export function parseDataUri(input: string): ParsedDataUri | null {
  const trimmed = input.trim();
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.*)$/is.exec(trimmed);
  if (!match) return null;
  return {
    mimeType: match[1]?.trim() || null,
    base64: match[2].trim(),
  };
}

export function extractBase64(input: string): string {
  const parsed = parseDataUri(input);
  return (parsed?.base64 ?? input).replace(/\s+/g, "");
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

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    let chunkString = "";
    for (let chunkIndex = 0; chunkIndex < chunk.length; chunkIndex += 1) {
      chunkString += String.fromCharCode(chunk[chunkIndex]);
    }
    binary += chunkString;
  }
  return btoa(binary);
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

export function bytesToHex(bytes: Uint8Array, uppercase = false): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return uppercase ? hex.toUpperCase() : hex;
}

export function cleanHex(input: string): string {
  return input.replace(/(?:0x)/gi, "").replace(/[\s:_-]+/g, "");
}

export function hexToBytes(input: string): Uint8Array {
  const normalized = cleanHex(input);
  if (!normalized) {
    throw new Base64ConversionError("Informe uma string hexadecimal.");
  }
  if (normalized.length % 2 !== 0 || /[^0-9a-f]/i.test(normalized)) {
    throw new Base64ConversionError("Hexadecimal inválido.");
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
  return `data:${mimeType};base64,${base64}`;
}

export function detectMimeFromBytes(bytes: Uint8Array, fallback = "application/octet-stream"): string {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "application/pdf";
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 6) {
    const signature = String.fromCharCode(...bytes.subarray(0, 6));
    if (signature === "GIF87a" || signature === "GIF89a") return "image/gif";
  }
  if (bytes.length >= 12) {
    const riff = String.fromCharCode(...bytes.subarray(0, 4));
    const webp = String.fromCharCode(...bytes.subarray(8, 12));
    if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  }
  if (bytes.length >= 12) {
    const ftyp = String.fromCharCode(...bytes.subarray(4, 8));
    if (ftyp === "ftyp") return "video/mp4";
  }
  if (bytes.length >= 3) {
    const id3 = String.fromCharCode(...bytes.subarray(0, 3));
    if (id3 === "ID3") return "audio/mpeg";
  }
  if (bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return "application/ogg";
  }
  return fallback;
}

export function sanitizeDownloadFileName(name: string, fallback = "arquivo"): string {
  const cleaned = name
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/[\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 120);
  return cleaned || fallback;
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
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: value >= 10 ? 0 : 1 })} ${units[unitIndex]}`;
}
