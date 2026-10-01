import "server-only";

/**
 * Abstração do fornecedor que RESOLVE um link público do Instagram em
 * URLs de mídia (temporárias). Trocar de fornecedor = implementar esta
 * interface e registrar em provider-registry.ts; o resto da aplicação
 * (validação, download seguro, storage, telas) não muda.
 *
 * Regra: nenhum provedor pode usar login/cookie/token do usuário, nem
 * acessar conteúdo privado. Só conteúdo público.
 */

export type InstagramMediaType = "VIDEO" | "IMAGE";

export interface InstagramMediaItem {
  mediaType: InstagramMediaType;
  /** URL temporária do arquivo (CDN do Instagram/provedor) — nunca usada como arquivo definitivo. */
  mediaUrl: string;
  thumbnailUrl: string | null;
  contentType: string | null;
}

export interface InstagramMediaResult {
  provider: string;
  requestId: string | null;
  /** Carrossel pode ter vários itens; Reel/vídeo normalmente 1. */
  items: InstagramMediaItem[];
  title: string | null;
  /** Nem todo provedor informa — o Alilu mede com ffprobe na importação. */
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
}

export type InstagramImportErrorCode =
  | "INVALID_URL"
  | "PRIVATE_CONTENT"
  | "NOT_FOUND"
  | "UNSUPPORTED"
  | "PROVIDER_FAILED"
  | "NOT_CONFIGURED";

export class InstagramImportProviderError extends Error {
  constructor(
    message: string,
    readonly code: InstagramImportErrorCode,
    readonly retryable: boolean,
    readonly httpStatus: number | null = null,
  ) {
    super(message);
    this.name = "InstagramImportProviderError";
  }
}

export interface InstagramMediaImportProvider {
  readonly id: string;
  /** Recebe a URL JÁ validada e normalizada (lib/instagram-import/url.ts). */
  resolve(normalizedUrl: string): Promise<InstagramMediaResult>;
}
