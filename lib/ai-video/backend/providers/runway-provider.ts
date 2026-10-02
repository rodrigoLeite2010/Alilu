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
 * Runway (API de desenvolvedor) — confirmado na documentação oficial
 * (docs.dev.runwayml.com, consultada em 01/10/2026):
 *   - base https://api.dev.runwayml.com/v1, cabeçalhos
 *     "Authorization: Bearer <RUNWAYML_API_SECRET>" e
 *     "X-Runway-Version: 2024-11-06";
 *   - POST /v1/image_to_video { model, promptImage, promptText, ratio, duration } → { id };
 *   - GET /v1/tasks/{id} → { status, output[], failure, failureCode };
 *   - DELETE /v1/tasks/{id} cancela/apaga a tarefa;
 *   - as URLs de output expiram em 24–48 h: SEMPRE copiar para o Blob.
 * Proporções (ratio) aceitas pelos modelos gen4_turbo/gen4.5 incluem
 * 1280:720, 720:1280 e 960:960; duração de 2 a 10 s (o Alilu oferece 5 e 10).
 * A chave nunca é logada nem incluída em mensagem de erro.
 */

export const RUNWAY_API_BASE_URL = "https://api.dev.runwayml.com/v1";
export const RUNWAY_API_VERSION = "2024-11-06";

const RUNWAY_RATIO: Record<AiVideoAspectRatio, string> = {
  "9:16": "720:1280",
  "1:1": "960:960",
  "16:9": "1280:720",
};

const SUPPORTED_MODELS = new Set(["gen4_turbo", "gen4.5"]);
const MIN_DURATION = 2;
const MAX_DURATION = 10;

function getApiKey(): string {
  const key = process.env.RUNWAYML_API_SECRET;
  if (!key) {
    throw new ImageToVideoProviderError("A geração de vídeo está temporariamente indisponível.", "TECHNICAL", false, null, "NOT_CONFIGURED");
  }
  return key;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Classifica o failureCode da tarefa: SAFETY.* = moderação (conta para o
 * bloqueio temporário do usuário — a Runway suspende contas com muitas
 * requisições moderadas); INPUT_PREPROCESSING.* / ASSET.* = imagem
 * inválida (erro do usuário); o resto = falha técnica.
 */
export function classifyRunwayFailure(code: string | null): VideoGenerationStatus["failureKind"] {
  const value = (code ?? "").toUpperCase();
  if (value.startsWith("SAFETY")) return "MODERATION";
  if (value.startsWith("INPUT_PREPROCESSING") || value.startsWith("ASSET")) return "USER_ERROR";
  // INTERNAL.BAD_OUTPUT.*: a Runway descartou o resultado. Causas comuns
  // (docs.dev.runwayml.com/errors/task-failures): logotipo, marca d'água ou
  // texto na imagem, ou prompt pedindo texto. Corrigível pelo usuário.
  if (value.startsWith("INTERNAL.BAD_OUTPUT")) return "USER_ERROR";
  return "TECHNICAL";
}

async function runwayRequest(path: string, init: { method: "GET" | "POST" | "DELETE"; body?: unknown }): Promise<unknown> {
  const apiKey = getApiKey();
  let response: Response;
  try {
    response = await fetch(`${RUNWAY_API_BASE_URL}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Runway-Version": RUNWAY_API_VERSION,
        "Content-Type": "application/json",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
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

  if (!response.ok) {
    const detail = isRecord(payload) && typeof payload.error === "string" ? payload.error : null;
    if (response.status === 429 || response.status >= 500) {
      throw new ImageToVideoProviderError("O serviço de vídeo está ocupado. Vamos tentar de novo.", "TECHNICAL", true, response.status, `HTTP_${response.status}`);
    }
    if (response.status === 401 || response.status === 403) {
      throw new ImageToVideoProviderError("A geração de vídeo está temporariamente indisponível.", "TECHNICAL", false, response.status, `HTTP_${response.status}`);
    }
    const moderated = (detail ?? "").toLowerCase().includes("moderat") || (detail ?? "").toLowerCase().includes("safety");
    throw new ImageToVideoProviderError(
      moderated
        ? "A imagem ou o texto foi recusado pela moderação de conteúdo."
        : `O serviço de vídeo recusou o pedido${detail ? `: ${detail.slice(0, 200)}` : "."}`,
      moderated ? "MODERATION" : "USER_ERROR",
      false,
      response.status,
      `HTTP_${response.status}`,
    );
  }
  return payload;
}

export const runwayImageToVideoProvider: ImageToVideoProvider = {
  providerId: "runway",

  supports(request) {
    return (
      SUPPORTED_MODELS.has(request.model) &&
      Number.isInteger(request.durationSeconds) &&
      request.durationSeconds >= MIN_DURATION &&
      request.durationSeconds <= MAX_DURATION &&
      request.aspectRatio in RUNWAY_RATIO
    );
  },

  async create(request: ImageToVideoRequest): Promise<CreateVideoResult> {
    const payload = await runwayRequest("/image_to_video", {
      method: "POST",
      body: {
        model: request.model,
        promptImage: request.imageUrl,
        promptText: request.prompt,
        ratio: RUNWAY_RATIO[request.aspectRatio],
        duration: request.durationSeconds,
      },
    });
    if (!isRecord(payload) || typeof payload.id !== "string") {
      throw new ImageToVideoProviderError("Resposta inesperada do serviço de vídeo.", "TECHNICAL", false, null, "BAD_RESPONSE");
    }
    return { externalTaskId: payload.id };
  },

  async getStatus(externalTaskId: string): Promise<VideoGenerationStatus> {
    const payload = await runwayRequest(`/tasks/${encodeURIComponent(externalTaskId)}`, { method: "GET" });
    if (!isRecord(payload) || typeof payload.status !== "string") {
      throw new ImageToVideoProviderError("Resposta inesperada do serviço de vídeo.", "TECHNICAL", true, null, "BAD_RESPONSE");
    }
    const status = payload.status.toUpperCase();
    const outputUrls = Array.isArray(payload.output) ? payload.output.filter((url): url is string => typeof url === "string") : [];
    const failureCode = typeof payload.failureCode === "string" ? payload.failureCode : null;
    const failureMessage = typeof payload.failure === "string" ? payload.failure : null;

    if (status === "SUCCEEDED") {
      return { state: "SUCCEEDED", outputUrls, failureCode: null, failureMessage: null, failureKind: null };
    }
    if (status === "FAILED") {
      return { state: "FAILED", outputUrls: [], failureCode, failureMessage, failureKind: classifyRunwayFailure(failureCode) };
    }
    if (status === "CANCELLED") {
      return { state: "CANCELLED", outputUrls: [], failureCode, failureMessage, failureKind: "TECHNICAL" };
    }
    if (status === "RUNNING") {
      return { state: "PROCESSING", outputUrls: [], failureCode: null, failureMessage: null, failureKind: null };
    }
    // PENDING, THROTTLED ou qualquer estado novo de espera.
    return { state: "QUEUED", outputUrls: [], failureCode: null, failureMessage: null, failureKind: null };
  },

  async cancel(externalTaskId: string): Promise<void> {
    try {
      await runwayRequest(`/tasks/${encodeURIComponent(externalTaskId)}`, { method: "DELETE" });
    } catch {
      // melhor esforço
    }
  },
};
