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
