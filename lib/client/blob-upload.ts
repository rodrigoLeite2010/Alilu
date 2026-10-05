"use client";

import { uploadPresigned } from "@vercel/blob/client";

/**
 * Envio direto navegador → Vercel Blob (o arquivo nunca passa por uma
 * Vercel Function) com fallback e erro de verdade.
 *
 * Bug real (telemetria, Chrome 153/Windows): com `onUploadProgress` a
 * biblioteca envia o arquivo como STREAM (`fetch` + `duplex: "half"`) e o
 * navegador recusa na hora com "The provided ReadableStream is disturbed"
 * (algo intercepta o fetch e lê o stream antes). Nesse caso repetimos o
 * envio SEM stream (corpo = o próprio arquivo), sem barra de progresso
 * fina — o upload em si funciona.
 */

type UploadOptions = Parameters<typeof uploadPresigned>[2];
type UploadResult = Awaited<ReturnType<typeof uploadPresigned>>;

export type UploadErrorCode =
  | "UPLOAD_TOO_LARGE"
  | "UPLOAD_TYPE_NOT_ALLOWED"
  | "UPLOAD_AUTH_ERROR"
  | "UPLOAD_TOKEN_ERROR"
  | "UPLOAD_STORAGE_ERROR"
  | "UPLOAD_RATE_LIMITED"
  | "UPLOAD_ABORTED"
  | "UPLOAD_STREAM_REJECTED"
  | "UPLOAD_NETWORK_ERROR"
  | "UPLOAD_UNKNOWN";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "");
}

/** Erros do envio por stream que valem uma nova tentativa sem stream. */
export function isStreamUploadError(error: unknown): boolean {
  const message = messageOf(error);
  return /ReadableStream is (disturbed|locked)|duplex|ERR_H2_OR_QUIC_REQUIRED|streaming upload/i.test(message);
}

export function classifyUploadError(error: unknown): UploadErrorCode {
  const message = messageOf(error);
  if (/file is too large|exceeds the maximum allowed size|maximumSizeInBytes/i.test(message)) return "UPLOAD_TOO_LARGE";
  if (/content type mismatch|content type .* not allowed/i.test(message)) return "UPLOAD_TYPE_NOT_ALLOWED";
  if (/não autenticado|access denied|token has expired|401|403/i.test(message)) return "UPLOAD_AUTH_ERROR";
  if (/presigned url|presignedUrlPayload/i.test(message)) return "UPLOAD_TOKEN_ERROR";
  if (/too many requests|rate limit|429/i.test(message)) return "UPLOAD_RATE_LIMITED";
  if (/store (does not exist|has been suspended)|service is currently not available|unknown error/i.test(message)) return "UPLOAD_STORAGE_ERROR";
  if (/aborted|AbortError/i.test(message) || (error instanceof DOMException && error.name === "AbortError")) return "UPLOAD_ABORTED";
  if (isStreamUploadError(error)) return "UPLOAD_STREAM_REJECTED";
  if (/failed to fetch|network|load failed|fetch failed|networkerror/i.test(message)) return "UPLOAD_NETWORK_ERROR";
  return "UPLOAD_UNKNOWN";
}

/** Mensagem para a pessoa, pela causa real. `label` ex.: "vídeo complementar". */
export function describeUploadError(code: UploadErrorCode, label: string, maxMegabytes?: number): string {
  switch (code) {
    case "UPLOAD_TOO_LARGE":
      return `O ${label} excede o limite permitido${maxMegabytes ? ` (${maxMegabytes} MB)` : ""}.`;
    case "UPLOAD_TYPE_NOT_ALLOWED":
      return `O formato do ${label} não é aceito. Use MP4, MOV ou WEBM.`;
    case "UPLOAD_AUTH_ERROR":
      return "Sua sessão expirou. Entre novamente e tente de novo.";
    case "UPLOAD_TOKEN_ERROR":
      return `O servidor não autorizou o envio do ${label}. Tente de novo em instantes.`;
    case "UPLOAD_RATE_LIMITED":
      return "Muitos envios em sequência. Aguarde alguns segundos e tente de novo.";
    case "UPLOAD_STORAGE_ERROR":
      return `O servidor não conseguiu armazenar o ${label}. Tente de novo em instantes.`;
    case "UPLOAD_ABORTED":
      return `O envio do ${label} foi interrompido.`;
    case "UPLOAD_STREAM_REJECTED":
      return `O navegador bloqueou o envio do ${label}. Desative extensões que alteram páginas (bloqueadores, tradutores) ou use outro navegador.`;
    case "UPLOAD_NETWORK_ERROR":
      return `Não foi possível concluir o envio do ${label}. Verifique sua conexão (Wi-Fi/4G) e tente de novo.`;
    default:
      return `Não foi possível enviar o ${label}. Tente de novo.`;
  }
}

export interface ResilientUploadResult {
  result: UploadResult;
  /** true quando precisou repetir sem stream (sem progresso fino). */
  usedFallback: boolean;
  /** Erro da 1ª tentativa (para a telemetria), se houve fallback. */
  firstError: string | null;
}

export async function uploadPresignedResilient(
  pathname: string,
  body: Blob,
  options: UploadOptions,
  hooks: { onFallback?: (firstError: string) => void } = {},
): Promise<ResilientUploadResult> {
  try {
    return { result: await uploadPresigned(pathname, body, options), usedFallback: false, firstError: null };
  } catch (error) {
    if (!options.onUploadProgress || !isStreamUploadError(error) || options.abortSignal?.aborted) throw error;
    const firstError = messageOf(error).slice(0, 200);
    hooks.onFallback?.(firstError);
    const { onUploadProgress: _ignored, ...withoutProgress } = options;
    void _ignored;
    return { result: await uploadPresigned(pathname, body, withoutProgress), usedFallback: true, firstError };
  }
}
