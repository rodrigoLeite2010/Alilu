/**
 * Classificação de erros de publicação no Instagram (lógica pura, sem
 * "server-only", para poder ser testada diretamente).
 *
 * Decide se uma falha é TEMPORÁRIA (vale tentar de novo mais tarde, com
 * backoff) ou PERMANENTE (repetir não resolve: token inválido, permissão
 * ausente, mídia recusada) e produz uma mensagem em português segura para
 * gravar no banco e mostrar na tela — nunca o erro cru, nunca stack,
 * nunca token.
 *
 * Códigos de erro da Graph API usados aqui seguem a documentação pública
 * de "Error Codes" da Meta (Graph API / Instagram Platform):
 *   1, 2          -> erro/serviço temporário da API
 *   4, 17, 32, 613, 341 -> limites de taxa (aplicação, usuário, página)
 *   190, 102      -> token de acesso inválido/expirado
 *   10, 200–299   -> permissão ausente
 *   9004, 36003, 2207xxx (subcódigos) -> mídia não pôde ser usada
 * Além disso, a própria resposta traz `is_transient: true` quando a Meta
 * considera o erro temporário — esse sinal tem prioridade.
 */

export type PublishErrorKind = "transient" | "permanent";

export interface ClassifiedPublishError {
  kind: PublishErrorKind;
  /** Mensagem sanitizada, em português, pronta para o banco e para a tela. */
  message: string;
  /** Código numérico da Meta, quando houver (útil em log — nunca contém segredo). */
  metaCode: number | null;
}

/** Erro de processamento do container relatado pela própria Meta (status ERROR/EXPIRED). */
export class ContainerProcessingError extends Error {
  constructor(readonly containerStatus: "ERROR" | "EXPIRED") {
    super(`Processamento da mídia falhou no Instagram (status: ${containerStatus}).`);
    this.name = "ContainerProcessingError";
  }
}

/** Erro de validação local (dados do post incompatíveis) — sempre permanente. */
export class PublishValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishValidationError";
  }
}

const TRANSIENT_CODES = new Set([1, 2, 4, 17, 32, 341, 368, 613]);
const TOKEN_CODES = new Set([102, 190, 463, 467]);
const MEDIA_CODES = new Set([9004, 36000, 36001, 36003, 36004]);

interface MetaErrorBody {
  code: number | null;
  subcode: number | null;
  isTransient: boolean;
}

function readMetaError(details: unknown): MetaErrorBody | null {
  if (typeof details !== "object" || details === null) return null;
  const error = (details as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return null;
  const record = error as Record<string, unknown>;
  const code = typeof record.code === "number" ? record.code : null;
  const subcode = typeof record.error_subcode === "number" ? record.error_subcode : null;
  return { code, subcode, isTransient: record.is_transient === true };
}

function isGraphApiError(error: unknown): error is Error & { details: unknown } {
  return error instanceof Error && error.name === "InstagramGraphApiError" && "details" in error;
}

export const RENEW_CONNECTION_MESSAGE = "Sua conexão com o Instagram precisa ser renovada.";

export function classifyPublishError(error: unknown): ClassifiedPublishError {
  if (error instanceof PublishValidationError) {
    return { kind: "permanent", message: error.message, metaCode: null };
  }

  if (error instanceof ContainerProcessingError) {
    return {
      kind: "permanent",
      message:
        error.containerStatus === "EXPIRED"
          ? "A Meta expirou o processamento da mídia antes da publicação. Tente novamente."
          : "A Meta não conseguiu processar esta mídia. Verifique formato, tamanho e proporção.",
      metaCode: null,
    };
  }

  if (isGraphApiError(error)) {
    const meta = readMetaError(error.details);
    if (!meta) {
      // Corpo sem o formato de erro da Meta (ex.: HTML de um 502/503 no
      // meio do caminho) — tipicamente uma instabilidade passageira.
      return {
        kind: "transient",
        message: "O Instagram não respondeu como esperado. Uma nova tentativa será feita.",
        metaCode: null,
      };
    }
    const code = meta.code;
    const suffix = code !== null ? ` (código ${code})` : "";

    if (code !== null && TOKEN_CODES.has(code)) {
      return { kind: "permanent", message: RENEW_CONNECTION_MESSAGE, metaCode: code };
    }
    if (code !== null && (code === 10 || (code >= 200 && code <= 299))) {
      return {
        kind: "permanent",
        message: `A conta do Instagram não deu permissão para publicar pelo Alilu${suffix}. Reconecte a conta.`,
        metaCode: code,
      };
    }
    if (meta.isTransient || (code !== null && TRANSIENT_CODES.has(code))) {
      return {
        kind: "transient",
        message: `O Instagram está temporariamente indisponível ou limitou as requisições${suffix}. Uma nova tentativa será feita.`,
        metaCode: code,
      };
    }
    if ((code !== null && MEDIA_CODES.has(code)) || (meta.subcode !== null && meta.subcode >= 2207000 && meta.subcode < 2208000)) {
      return {
        kind: "permanent",
        message: `O Instagram recusou a mídia desta publicação${suffix}. Verifique formato, tamanho e proporção.`,
        metaCode: code,
      };
    }
    return { kind: "permanent", message: `Não foi possível publicar no Instagram${suffix}.`, metaCode: code };
  }

  // Falha de rede (fetch rejeitado), timeout, instabilidade de banco etc.
  // — não sabemos se a Meta recebeu o pedido; tentar de novo é seguro
  // porque o container salvo é retomado em vez de recriado.
  return {
    kind: "transient",
    message: "Falha de comunicação ao publicar. Uma nova tentativa será feita.",
    metaCode: null,
  };
}

/** Atrasos entre tentativas (após a 1ª, 2ª e 3ª falha temporária). */
export const RETRY_DELAYS_MINUTES = [5, 15, 60] as const;
export const MAX_RETRIES = RETRY_DELAYS_MINUTES.length;

/**
 * Próxima tentativa depois de uma falha temporária. `previousFailures` é
 * quantas falhas já tinham acontecido ANTES desta. Retorna `null` quando o
 * limite de retentativas acabou (a publicação deve virar FAILED).
 */
export function computeNextRetryAt(previousFailures: number, now: Date = new Date()): Date | null {
  if (previousFailures < 0 || previousFailures >= MAX_RETRIES) return null;
  return new Date(now.getTime() + RETRY_DELAYS_MINUTES[previousFailures] * 60_000);
}
