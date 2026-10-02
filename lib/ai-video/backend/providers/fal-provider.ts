import "server-only";
import {
  ImageToVideoProviderError,
  type CreateVideoResult,
  type ImageToVideoProvider,
  type ImageToVideoRequest,
  type VideoGenerationStatus,
} from "./provider";
import type { AiVideoAspectRatio } from "../../types";

/**
 * fal.ai — fila assíncrona (REST), confirmado na documentação oficial
 * (fal.ai/docs/model-apis/model-endpoints/queue e a página do modelo,
 * consultadas em 01/10/2026):
 *   - POST https://queue.fal.run/{model-id} com "Authorization: Key <FAL_KEY>"
 *     → { request_id, status_url, response_url, cancel_url };
 *   - GET  …/{model-id}/requests/{id}/status → IN_QUEUE | IN_PROGRESS | COMPLETED
 *     (COMPLETED pode vir com `error`/`error_type` quando falhou);
 *   - GET  …/{model-id}/requests/{id} → resultado ({ video: { url } });
 *   - PUT  …/{model-id}/requests/{id}/cancel.
 * ATENÇÃO (confirmado em 02/10/2026): o envio usa o id COMPLETO do modelo
 * (fal-ai/wan/v2.2-5b/image-to-video), mas status, resultado e cancelamento
 * usam só "dono/app" (fal-ai/wan) — igual ao cliente oficial @fal-ai/client
 * (queue.status/result/cancel montam a URL com owner/alias, sem o subcaminho).
 * Com o caminho completo, a fila responde 405 para sempre: o vídeo era gerado
 * (e cobrado) no fal.ai, mas nunca chegava ao Alilu.
 * Modelo do Econômico: fal-ai/wan/v2.2-5b/image-to-video — US$ 0,15 por
 * vídeo (até 5 s, 720p, 24 fps), uso comercial permitido. Parâmetros:
 * image_url, prompt, num_frames (17–161), frames_per_second, resolution
 * ("580p" | "720p"), aspect_ratio ("auto" | "16:9" | "9:16" | "1:1"),
 * enable_safety_checker.
 * A chave nunca é logada nem incluída em mensagem de erro.
 */

export const FAL_QUEUE_BASE_URL = "https://queue.fal.run";

interface FalModelSpec {
  /** Duração (s) → parâmetros do modelo. */
  durations: Record<number, Record<string, unknown>>;
  resolution: string;
}

const FAL_MODELS: Record<string, FalModelSpec> = {
  "fal-ai/wan/v2.2-5b/image-to-video": {
    // 121 quadros a 24 fps ≈ 5 s — dentro do preço "por vídeo de até 5 s".
    durations: { 5: { num_frames: 121, frames_per_second: 24 } },
    resolution: "720p",
  },
};

const FAL_ASPECT: Record<AiVideoAspectRatio, string> = { "9:16": "9:16", "1:1": "1:1", "16:9": "16:9" };

function getApiKey(): string {
  const key = process.env.FAL_KEY;
  if (!key) {
    throw new ImageToVideoProviderError("A geração de vídeo está temporariamente indisponível.", "TECHNICAL", false, null, "NOT_CONFIGURED");
  }
  return key;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** O id externo guarda modelo + request_id (as URLs da fila dependem dos dois). */
export function encodeFalTaskId(model: string, requestId: string): string {
  return `${model}::${requestId}`;
}

export function decodeFalTaskId(externalTaskId: string): { model: string; requestId: string } {
  const index = externalTaskId.lastIndexOf("::");
  if (index <= 0) throw new ImageToVideoProviderError("Tarefa inválida.", "TECHNICAL", false, null, "BAD_TASK_ID");
  const model = externalTaskId.slice(0, index);
  const requestId = externalTaskId.slice(index + 2);
  if (!(model in FAL_MODELS) || !/^[A-Za-z0-9-]+$/.test(requestId)) {
    throw new ImageToVideoProviderError("Tarefa inválida.", "TECHNICAL", false, null, "BAD_TASK_ID");
  }
  return { model, requestId };
}

/** Prefixos de namespace aceitos pelo fal (ex.: "workflows/dono/app"). */
const FAL_NAMESPACES = new Set(["workflows", "comfy"]);

/** "fal-ai/wan/v2.2-5b/image-to-video" → "fal-ai/wan" (base da fila para status/resultado/cancelamento). */
export function falQueueAppId(model: string): string {
  const parts = model.split("/").filter(Boolean);
  const take = FAL_NAMESPACES.has(parts[0]) ? 3 : 2;
  return parts.slice(0, take).join("/");
}

/** URL base de uma requisição na fila: https://queue.fal.run/{dono}/{app}/requests/{id} */
export function falRequestBaseUrl(model: string, requestId: string): string {
  return `${FAL_QUEUE_BASE_URL}/${falQueueAppId(model)}/requests/${requestId}`;
}

function errorText(payload: unknown): string {
  if (!isRecord(payload)) return "";
  if (typeof payload.error === "string") return payload.error;
  if (typeof payload.detail === "string") return payload.detail;
  if (Array.isArray(payload.detail)) {
    return payload.detail
      .map((item) => (isRecord(item) && typeof item.msg === "string" ? item.msg : ""))
      .filter(Boolean)
      .join("; ");
  }
  return "";
}

function firstString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function extractVideoUrl(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const direct = firstString(payload.video_url) ?? firstString(payload.url);
  if (direct) return direct;

  const video = isRecord(payload.video) ? payload.video : null;
  const videoUrl = video ? (firstString(video.url) ?? firstString(video.file_url)) : null;
  if (videoUrl) return videoUrl;

  const output = isRecord(payload.output) ? payload.output : null;
  if (output) {
    const outputDirect = firstString(output.video_url) ?? firstString(output.url);
    if (outputDirect) return outputDirect;
    const outputVideo = isRecord(output.video) ? output.video : null;
    const outputVideoUrl = outputVideo ? (firstString(outputVideo.url) ?? firstString(outputVideo.file_url)) : null;
    if (outputVideoUrl) return outputVideoUrl;
    if (Array.isArray(output.videos)) {
      const first = output.videos.find(isRecord);
      const url = first ? (firstString(first.url) ?? firstString(first.file_url)) : null;
      if (url) return url;
    }
  }

  if (Array.isArray(payload.videos)) {
    const first = payload.videos.find(isRecord);
    return first ? (firstString(first.url) ?? firstString(first.file_url)) : null;
  }
  return null;
}

/** Moderação (safety checker / conteúdo) × imagem inválida × técnica. */
export function classifyFalFailure(message: string, errorType: string | null, httpStatus: number | null): VideoGenerationStatus["failureKind"] {
  const text = `${message} ${errorType ?? ""}`.toLowerCase();
  if (/(nsfw|safety|content[_ ]policy|moderat|inappropriate)/.test(text)) return "MODERATION";
  if (httpStatus === 422 || /(image|validation|invalid|unsupported)/.test(text)) return "USER_ERROR";
  return "TECHNICAL";
}

async function falRequest(url: string, method: "GET" | "POST" | "PUT", body?: unknown): Promise<{ status: number; payload: unknown }> {
  const apiKey = getApiKey();
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ImageToVideoProviderError("Falha de comunicação com o serviço de vídeo.", "TECHNICAL", true, null, "NETWORK");
  }
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  return { status: response.status, payload };
}

function throwForHttp(status: number, payload: unknown): never {
  if (status === 429 || status >= 500) {
    throw new ImageToVideoProviderError("O serviço de vídeo está ocupado. Vamos tentar de novo.", "TECHNICAL", true, status, `HTTP_${status}`);
  }
  if (status === 401 || status === 403) {
    throw new ImageToVideoProviderError("A geração de vídeo está temporariamente indisponível.", "TECHNICAL", false, status, `HTTP_${status}`);
  }
  const detail = errorText(payload);
  const kind = classifyFalFailure(detail, null, status) ?? "USER_ERROR";
  throw new ImageToVideoProviderError(
    kind === "MODERATION"
      ? "A imagem ou o texto foi recusado pela moderação de conteúdo."
      : `O serviço de vídeo recusou o pedido${detail ? `: ${detail.slice(0, 200)}` : "."}`,
    kind === "TECHNICAL" ? "USER_ERROR" : kind,
    false,
    status,
    `HTTP_${status}`,
  );
}

async function getFalResult(base: string): Promise<VideoGenerationStatus | null> {
  // Só GET: a fila nunca recebe POST aqui (POST na fila = nova geração paga).
  const result = await falRequest(base, "GET");
  if (result.status >= 200 && result.status < 300) {
    const url = extractVideoUrl(result.payload);
    if (url) return { state: "SUCCEEDED", outputUrls: [url], failureCode: null, failureMessage: null, failureKind: null };
    return null;
  }
  if (result.status === 429 || result.status >= 500) throwForHttp(result.status, result.payload);
  // 404/405 = resultado ainda não disponível nesta URL (não é falha do vídeo).
  if (result.status === 404 || result.status === 405) return null;
  const detail = errorText(result.payload);
  if (!detail && result.status === 400) return null;
  return {
    state: "FAILED",
    outputUrls: [],
    failureCode: `HTTP_${result.status}`,
    failureMessage: detail || null,
    failureKind: classifyFalFailure(detail, null, result.status),
  };
}

export const falImageToVideoProvider: ImageToVideoProvider = {
  providerId: "fal",

  supports(request) {
    const spec = FAL_MODELS[request.model];
    return Boolean(spec && spec.durations[request.durationSeconds] && request.aspectRatio in FAL_ASPECT);
  },

  async create(request: ImageToVideoRequest): Promise<CreateVideoResult> {
    const spec = FAL_MODELS[request.model];
    const durationParams = spec?.durations[request.durationSeconds];
    if (!spec || !durationParams) {
      throw new ImageToVideoProviderError("Combinação não suportada.", "USER_ERROR", false, null, "UNSUPPORTED");
    }
    const { status, payload } = await falRequest(`${FAL_QUEUE_BASE_URL}/${request.model}`, "POST", {
      image_url: request.imageUrl,
      prompt: request.prompt,
      resolution: spec.resolution,
      aspect_ratio: FAL_ASPECT[request.aspectRatio],
      enable_safety_checker: true,
      ...durationParams,
    });
    if (status < 200 || status >= 300) throwForHttp(status, payload);
    if (!isRecord(payload) || typeof payload.request_id !== "string") {
      throw new ImageToVideoProviderError("Resposta inesperada do serviço de vídeo.", "TECHNICAL", false, null, "BAD_RESPONSE");
    }
    return { externalTaskId: encodeFalTaskId(request.model, payload.request_id) };
  },

  async getStatus(externalTaskId: string): Promise<VideoGenerationStatus> {
    const { model, requestId } = decodeFalTaskId(externalTaskId);
    const base = falRequestBaseUrl(model, requestId);
    const statusResponse = await falRequest(`${base}/status`, "GET");
    if (statusResponse.status < 200 || statusResponse.status >= 300) {
      const recovered = await getFalResult(base);
      if (recovered) return recovered;
      // 404/405 aqui é problema de consulta, não prova que o vídeo falhou:
      // erro "tentar de novo" — o serviço reagenda e, no limite, o prazo decide.
      if (statusResponse.status === 404 || statusResponse.status === 405) {
        throw new ImageToVideoProviderError("Não foi possível consultar o vídeo agora.", "TECHNICAL", true, statusResponse.status, `HTTP_${statusResponse.status}`);
      }
      throwForHttp(statusResponse.status, statusResponse.payload);
    }
    const payload = statusResponse.payload;
    const state = isRecord(payload) && typeof payload.status === "string" ? payload.status.toUpperCase() : "";
    const statusVideoUrl = extractVideoUrl(payload);
    if (!state && statusVideoUrl) return { state: "SUCCEEDED", outputUrls: [statusVideoUrl], failureCode: null, failureMessage: null, failureKind: null };
    if (state === "IN_QUEUE") return { state: "QUEUED", outputUrls: [], failureCode: null, failureMessage: null, failureKind: null };
    if (state === "IN_PROGRESS") return { state: "PROCESSING", outputUrls: [], failureCode: null, failureMessage: null, failureKind: null };
    if (state !== "COMPLETED") {
      const recovered = await getFalResult(base);
      if (recovered) return recovered;
      throw new ImageToVideoProviderError("Resposta inesperada do serviço de vídeo.", "TECHNICAL", true, null, "BAD_RESPONSE");
    }

    const statusError = isRecord(payload) && typeof payload.error === "string" ? payload.error : null;
    const errorType = isRecord(payload) && typeof payload.error_type === "string" ? payload.error_type : null;
    if (statusError) {
      return { state: "FAILED", outputUrls: [], failureCode: errorType ?? "FAILED", failureMessage: statusError, failureKind: classifyFalFailure(statusError, errorType, null) };
    }

    const result = await getFalResult(base);
    if (result) return result;
    // Concluído, mas o resultado ainda não veio: tenta de novo no próximo ciclo.
    throw new ImageToVideoProviderError("O vídeo ficou pronto, mas ainda não foi possível buscá-lo.", "TECHNICAL", true, null, "RESULT_PENDING");
  },

  async cancel(externalTaskId: string): Promise<void> {
    try {
      const { model, requestId } = decodeFalTaskId(externalTaskId);
      await falRequest(`${falRequestBaseUrl(model, requestId)}/cancel`, "PUT");
    } catch {
      // melhor esforço
    }
  },
};
