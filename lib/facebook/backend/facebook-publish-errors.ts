/**
 * Classificação de erros de publicação em Páginas do Facebook (lógica
 * pura, sem "server-only", testável diretamente).
 *
 * Produz: tipo (temporário x permanente), motivo (para a tela decidir se
 * oferece "Reconectar Página", "Tentar novamente" etc.) e uma mensagem em
 * português sanitizada — nunca o erro cru da Meta, nunca token.
 *
 * Códigos (Graph API "Error Codes" + Reels Publishing API):
 *   1, 2                      → instabilidade temporária
 *   4, 17, 32, 341, 368, 613  → limite de requisições
 *   102, 190, 463, 467        → token inválido/expirado
 *   10, 200–299               → permissão ausente/revogada
 *   100 com subcódigo 33      → objeto/Página inexistente ou sem acesso
 *   324, 1366046, 2069019     → foto/mídia inválida
 *   1363040, 1363127, 1363128, 1363129, 6000 → especificação de Reel recusada
 */

export type FacebookErrorKind = "transient" | "permanent";
export type FacebookErrorReason =
  | "token"
  | "permission"
  | "media"
  | "copyright"
  | "rate_limit"
  | "transient"
  | "unknown_result"
  | "validation"
  | "page_disconnected"
  | "other";

export interface ClassifiedFacebookError {
  kind: FacebookErrorKind;
  reason: FacebookErrorReason;
  message: string;
  metaCode: number | null;
}

export class FacebookPublishValidationError extends Error {
  constructor(message: string, readonly reason: FacebookErrorReason = "validation") {
    super(message);
    this.name = "FacebookPublishValidationError";
  }
}

/** A Meta informou falha no processamento do Reel (status "error"). */
export class FacebookReelProcessingError extends Error {
  constructor(readonly copyrightBlocked = false) {
    super("O Facebook não conseguiu processar o Reel.");
    this.name = "FacebookReelProcessingError";
  }
}

export const RECONNECT_PAGE_MESSAGE = "A conexão com a Página do Facebook precisa ser renovada. Reconecte a Página.";

const TRANSIENT_CODES = new Set([1, 2]);
const RATE_CODES = new Set([4, 17, 32, 341, 368, 613]);
const TOKEN_CODES = new Set([102, 190, 463, 467]);
const REEL_SPEC_CODES: Record<number, string> = {
  1363040: "proporção (use 9:16)",
  1363127: "resolução (mínimo 540 × 960)",
  1363128: "duração (entre 3 e 90 segundos)",
  1363129: "taxa de quadros (entre 24 e 60 fps)",
  6000: "envio do arquivo",
};
const MEDIA_SUBCODES = new Set([1366046, 2069019, 1363040, 1363127, 1363128, 1363129]);

function readMetaError(details: unknown): { code: number | null; subcode: number | null; isTransient: boolean } | null {
  if (typeof details !== "object" || details === null) return null;
  const error = (details as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return null;
  const record = error as Record<string, unknown>;
  return {
    code: typeof record.code === "number" ? record.code : null,
    subcode: typeof record.error_subcode === "number" ? record.error_subcode : null,
    isTransient: record.is_transient === true,
  };
}

function isGraphError(error: unknown): error is Error & { details: unknown; unknownOutcome?: boolean } {
  return error instanceof Error && error.name === "FacebookGraphApiError" && "details" in error;
}

export function classifyFacebookError(error: unknown): ClassifiedFacebookError {
  if (error instanceof FacebookPublishValidationError) {
    return { kind: "permanent", reason: error.reason, message: error.message, metaCode: null };
  }
  if (error instanceof FacebookReelProcessingError) {
    return error.copyrightBlocked
      ? {
          kind: "permanent",
          reason: "copyright",
          message:
            "O Facebook bloqueou este Reel por direitos autorais (geralmente a música/áudio). Troque o áudio por um autorizado e tente novamente.",
          metaCode: null,
        }
      : {
          kind: "permanent",
          reason: "media",
          message: "O Facebook não conseguiu processar este vídeo. Verifique formato (MP4/H.264), proporção 9:16 e duração de 3 a 90 segundos.",
          metaCode: null,
        };
  }
  if (isGraphError(error)) {
    if (error.unknownOutcome) {
      return {
        kind: "transient",
        reason: "unknown_result",
        message: "O Facebook não confirmou o resultado do envio. Vamos verificar a Página antes de qualquer nova tentativa.",
        metaCode: null,
      };
    }
    const meta = readMetaError(error.details);
    if (!meta) {
      return { kind: "transient", reason: "transient", message: "O Facebook não respondeu como esperado. Uma nova tentativa será feita.", metaCode: null };
    }
    const { code, subcode } = meta;
    const suffix = code !== null ? ` (código ${code})` : "";
    if (code !== null && TOKEN_CODES.has(code)) {
      return { kind: "permanent", reason: "token", message: RECONNECT_PAGE_MESSAGE, metaCode: code };
    }
    if (code !== null && (code === 10 || (code >= 200 && code <= 299))) {
      return {
        kind: "permanent",
        reason: "permission",
        message: `A Página do Facebook não deu permissão para publicar pelo Alilu${suffix}. Reconecte a Página e aprove "Criar conteúdo".`,
        metaCode: code,
      };
    }
    if (code !== null && RATE_CODES.has(code)) {
      return { kind: "transient", reason: "rate_limit", message: `O Facebook limitou as publicações por enquanto${suffix}. Uma nova tentativa será feita.`, metaCode: code };
    }
    if (meta.isTransient || (code !== null && TRANSIENT_CODES.has(code))) {
      return { kind: "transient", reason: "transient", message: `O Facebook está temporariamente indisponível${suffix}. Uma nova tentativa será feita.`, metaCode: code };
    }
    const reelSpec = (subcode !== null && REEL_SPEC_CODES[subcode]) || (code !== null && REEL_SPEC_CODES[code]);
    if (reelSpec) {
      return { kind: "permanent", reason: "media", message: `O Facebook recusou o vídeo: ${reelSpec}.`, metaCode: code };
    }
    if (code === 324 || (subcode !== null && MEDIA_SUBCODES.has(subcode))) {
      return { kind: "permanent", reason: "media", message: `O Facebook recusou a mídia desta publicação${suffix}. Verifique formato e tamanho.`, metaCode: code };
    }
    if (code === 100 && subcode === 33) {
      return { kind: "permanent", reason: "page_disconnected", message: "A Página não foi encontrada ou o Alilu perdeu o acesso a ela. Reconecte a Página.", metaCode: code };
    }
    return { kind: "permanent", reason: "other", message: `Não foi possível publicar no Facebook${suffix}.`, metaCode: code };
  }
  return { kind: "transient", reason: "transient", message: "Falha de comunicação ao publicar no Facebook. Uma nova tentativa será feita.", metaCode: null };
}

/** Motivos em que a ação certa para o usuário é reconectar a Página. */
export function needsPageReconnect(reason: string | null | undefined): boolean {
  return reason === "token" || reason === "permission" || reason === "page_disconnected";
}
