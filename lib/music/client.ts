export class MusicApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function musicApi<T>(body?: object, query = "", signal?: AbortSignal): Promise<T> {
  const response = await fetch("/api/musicas" + query, {
    cache: "no-store", signal,
    ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new MusicApiError(result?.error || "Falha ao acessar o módulo.", response.status);
  return result as T;
}

export function downloadChart(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name.replace(/[^\p{L}\p{N} ._-]/gu, "_") + ".cho";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
