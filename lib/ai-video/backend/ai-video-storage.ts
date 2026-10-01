import "server-only";

/**
 * Caminhos do Vercel Blob da ferramenta de vídeo com IA:
 *   ai-video/{userId}/input/…      imagens enviadas pelo usuário
 *   ai-video/{userId}/generated/…  MP4 copiados do provedor
 * A imagem de entrada só é aceita se estiver no prefixo do PRÓPRIO
 * usuário, no Blob público do projeto — nunca uma URL qualquer.
 */

export function aiVideoInputPrefix(userId: string): string {
  return `ai-video/${userId}/input/`;
}

export function isAiVideoUploadPathnameAllowed(pathname: string, userId: string): boolean {
  if (!pathname || pathname.includes("..")) return false;
  const prefix = aiVideoInputPrefix(userId);
  return pathname.startsWith(prefix) && pathname.length > prefix.length;
}

export function isAiVideoInputPathForUser(url: string, userId: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (!parsed.hostname.endsWith(".public.blob.vercel-storage.com")) return false;
  return isAiVideoUploadPathnameAllowed(decodeURIComponent(parsed.pathname.replace(/^\//, "")), userId);
}
