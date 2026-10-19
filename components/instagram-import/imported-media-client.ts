/**
 * Pré-carregar um arquivo importado do Instagram em outra ferramenta
 * (split-screen, Reels) sem o usuário baixar e subir de novo: busca a
 * importação do próprio usuário e transforma o arquivo do Blob do Alilu
 * num `File`, igual ao que viria do seletor de arquivos.
 */
export async function loadImportedVideoFile(importId: string): Promise<File | null> {
  if (!/^[0-9a-f-]{36}$/i.test(importId)) return null;
  const response = await fetch(`/api/videos/instagram-import/${importId}`, { cache: "no-store" });
  if (!response.ok) return null;
  const { import: record } = (await response.json()) as {
    import: { status: string; mediaType: string | null; fileUrl: string | null; contentType: string | null; kind: string };
  };
  if (record.status !== "COMPLETED" || record.mediaType !== "VIDEO" || !record.fileUrl) return null;
  const file = await fetch(record.fileUrl);
  if (!file.ok) return null;
  const blob = await file.blob();
  const type = record.contentType ?? blob.type ?? "video/mp4";
  return new File([blob], `instagram-${importId.slice(0, 8)}.${type === "video/quicktime" ? "mov" : "mp4"}`, { type });
}

/** Lê ?importacao=<id> da URL atual (só no navegador). */
export function importIdFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("importacao");
}

/** Lê ?youtube=<id> (importação do YouTube com arquivo enviado pelo usuário). */
export function youtubeImportIdFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("youtube");
}

/**
 * Pré-carrega o arquivo de uma importação do YouTube. Importante: o arquivo é
 * o ORIGINAL enviado pelo próprio usuário (Blob da Alilu) — nunca baixado do
 * YouTube. Só devolve algo quando a importação está COMPLETED.
 */
export async function loadYoutubeImportedVideoFile(importId: string): Promise<File | null> {
  if (!/^[0-9a-f-]{36}$/i.test(importId)) return null;
  const response = await fetch(`/api/videos/youtube-import/${importId}`, { cache: "no-store" });
  if (!response.ok) return null;
  const { import: record } = (await response.json()) as {
    import: { status: string; fileUrl: string | null; contentType: string | null; videoId: string };
  };
  if (record.status !== "COMPLETED" || !record.fileUrl) return null;
  const file = await fetch(record.fileUrl);
  if (!file.ok) return null;
  const blob = await file.blob();
  const type = record.contentType ?? blob.type ?? "video/mp4";
  const extension = type === "video/quicktime" ? "mov" : type === "video/webm" ? "webm" : "mp4";
  return new File([blob], `youtube-${record.videoId}.${extension}`, { type });
}

/** Origem do vídeo pré-carregado pela URL: ?importacao= (Instagram) ou ?youtube= (YouTube). */
export async function loadImportedVideoFromLocation(): Promise<{ file: File; source: "instagram" | "youtube" } | null> {
  const youtubeId = youtubeImportIdFromLocation();
  if (youtubeId) {
    const file = await loadYoutubeImportedVideoFile(youtubeId);
    return file ? { file, source: "youtube" } : null;
  }
  const importId = importIdFromLocation();
  if (!importId) return null;
  const file = await loadImportedVideoFile(importId);
  return file ? { file, source: "instagram" } : null;
}
