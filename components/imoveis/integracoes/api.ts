export async function integrationRequest<T = Record<string, unknown>>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch(`/api/imoveis/integracoes${path}`, {
    method,
    headers: data === undefined ? {} : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((result as { error?: string }).error ?? "Não foi possível concluir.");
  return result as T;
}

/** Divide registros em partes de até ~3 MB e no máximo 500 registros. */
export function chunkRecords<T>(records: T[], maxBytes = 3_000_000, maxItems = 500) {
  const chunks: T[][] = [];
  let current: T[] = [],
    size = 2;
  for (const r of records) {
    const s = JSON.stringify(r).length + 1;
    if (current.length && (size + s > maxBytes || current.length >= maxItems)) {
      chunks.push(current);
      current = [];
      size = 2;
    }
    current.push(r);
    size += s;
  }
  if (current.length) chunks.push(current);
  return chunks;
}
