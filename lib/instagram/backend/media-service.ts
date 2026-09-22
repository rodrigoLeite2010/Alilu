/**
 * Regras de validação do upload de mídia para o Instagram (Fase 3, ETAPA de
 * armazenamento persistente). Lógica pura — sem acesso a banco nem a
 * "server-only" — para ser testável sem mocks; a orquestração com o Vercel
 * Blob e o banco vive na rota app/api/instagram/media/upload/route.ts e em
 * media-repository.ts.
 *
 * Uploads vão DIRETO do navegador para o Vercel Blob ("client upload" do
 * @vercel/blob/client): o arquivo em si nunca passa pela nossa Vercel
 * Function, que tem limite de 4.5 MB de payload de requisição — bem menor
 * que o limite de 15 MB já usado no editor local (lib/instagram/image-
 * utils.ts). Nossa função só participa de duas conversas curtas em JSON:
 * autorizar o token antes do upload (onBeforeGenerateToken) e receber a
 * confirmação depois que o Blob já recebeu o arquivo (onUploadCompleted).
 */

export const ALLOWED_MEDIA_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_MEDIA_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_ORIGINAL_FILENAME_LENGTH = 200;

/** Prefixo de pasta reservado para os uploads do usuário autenticado dentro do Blob. */
export function buildMediaPathnamePrefix(userId: string): string {
  return `instagram-media/${userId}/`;
}

/**
 * O `pathname` de um client upload do Vercel Blob é escolhido pelo próprio
 * navegador — nunca confiar nele sem validar (documentação do Vercel Blob é
 * explícita sobre isso). Aqui exigimos que comece exatamente pelo prefixo
 * do usuário autenticado (comparado contra a sessão do servidor, nunca
 * contra um valor vindo do cliente) e não contenha tentativa de sair do
 * próprio diretório.
 */
export function isPathnameAllowedForUser(pathname: string, userId: string): boolean {
  if (!userId || !pathname) return false;
  const prefix = buildMediaPathnamePrefix(userId);
  if (!pathname.startsWith(prefix)) return false;
  if (pathname.includes("..")) return false;
  if (pathname.length <= prefix.length) return false;
  return true;
}

/**
 * O nome original do arquivo é só metadado informativo (nunca usado para
 * montar um caminho de arquivo real, que é sempre gerado por nós) — mesmo
 * assim, nunca guardamos um caminho, caracteres de controle, nem uma
 * string absurdamente longa.
 */
export function sanitizeOriginalFilename(name: string | null | undefined): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;

  const baseName = trimmed.split(/[/\\]/).pop() ?? trimmed;
  const cleaned = baseName.replace(/[\u0000-\u001f]/g, "");
  if (!cleaned) return null;

  return cleaned.slice(0, MAX_ORIGINAL_FILENAME_LENGTH);
}

export interface MediaTokenPayload {
  userId: string;
  originalFilename: string | null;
  fileSizeBytes: number | null;
}

/**
 * Monta o `tokenPayload` (assinado pelo Vercel Blob junto do token de
 * upload) a partir do usuário já autenticado no servidor e do
 * `clientPayload` que o navegador enviou (nome/tamanho do arquivo — só
 * para exibição/registro, nunca para autorização: quem autoriza é
 * `isPathnameAllowedForUser` + a sessão do servidor).
 */
export function buildMediaTokenPayload(userId: string, clientPayload: string | null): string {
  let originalFilename: string | null = null;
  let fileSizeBytes: number | null = null;

  if (clientPayload) {
    try {
      const parsed = JSON.parse(clientPayload) as { originalFilename?: unknown; fileSizeBytes?: unknown };
      originalFilename = sanitizeOriginalFilename(
        typeof parsed.originalFilename === "string" ? parsed.originalFilename : null,
      );
      fileSizeBytes =
        typeof parsed.fileSizeBytes === "number" && Number.isFinite(parsed.fileSizeBytes) && parsed.fileSizeBytes >= 0
          ? Math.floor(parsed.fileSizeBytes)
          : null;
    } catch {
      // clientPayload malformado (nunca deveria acontecer vindo do nosso
      // próprio cliente) — ignora e segue só com o essencial (userId).
    }
  }

  return JSON.stringify({ userId, originalFilename, fileSizeBytes });
}

/** Lê de volta o payload montado em buildMediaTokenPayload — nunca lança, só retorna null se algo não bater. */
export function parseMediaTokenPayload(raw: string | null | undefined): MediaTokenPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<MediaTokenPayload>;
    if (typeof parsed.userId !== "string" || !parsed.userId) return null;
    return {
      userId: parsed.userId,
      originalFilename: typeof parsed.originalFilename === "string" ? parsed.originalFilename : null,
      fileSizeBytes: typeof parsed.fileSizeBytes === "number" ? parsed.fileSizeBytes : null,
    };
  } catch {
    return null;
  }
}
