import type { BulkDeleteFailure, BulkDeleteResult } from "./core";

export const BULK_DELETE_CHUNK_SIZE = 25;

export interface BulkDeleteProgress {
  processed: number;
  total: number;
}

interface ServerPayload {
  deleted?: unknown;
  failed?: unknown;
  /** Compatibilidade com /api/content-automation/media/bulk-delete (usa "kept"). */
  kept?: unknown;
  error?: unknown;
}

function asFailures(value: unknown): BulkDeleteFailure[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is BulkDeleteFailure =>
      typeof item === "object" && item !== null && typeof (item as BulkDeleteFailure).id === "string",
  ).map((item) => ({ id: item.id, reason: typeof item.reason === "string" ? item.reason : "Não foi possível excluir." }));
}

async function postChunk(url: string, ids: string[], signal?: AbortSignal): Promise<BulkDeleteResult | { fatal: string } | { retry: string }> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
      signal,
    });
  } catch {
    return { retry: "Falha de conexão. Verifique a internet e tente de novo." };
  }
  const payload = (await response.json().catch(() => ({}))) as ServerPayload;
  if (response.status === 401) return { fatal: "Sua sessão expirou. Entre de novo para continuar." };
  if (response.status >= 500) return { retry: "O servidor não respondeu agora." };
  if (!response.ok) return { fatal: typeof payload.error === "string" ? payload.error : "Não foi possível excluir." };
  const deleted = Array.isArray(payload.deleted) ? payload.deleted.filter((id): id is string => typeof id === "string") : [];
  return { deleted, failed: asFailures(payload.failed ?? payload.kept) };
}

/**
 * Envia os ids em lotes sequenciais (menos requisições que uma por item, e
 * com progresso real). Rede/5xx: uma nova tentativa do lote — seguro porque
 * os endpoints tratam "já excluído" como sucesso (idempotentes). Se ainda
 * assim falhar, os ids daquele lote entram como falha e o processo segue.
 */
export async function bulkDeleteInChunks(options: {
  url: string;
  ids: string[];
  chunkSize?: number;
  onProgress?: (progress: BulkDeleteProgress) => void;
  signal?: AbortSignal;
}): Promise<BulkDeleteResult> {
  const { url, ids, signal, onProgress } = options;
  const size = Math.max(1, options.chunkSize ?? BULK_DELETE_CHUNK_SIZE);
  const result: BulkDeleteResult = { deleted: [], failed: [] };
  let processed = 0;
  onProgress?.({ processed, total: ids.length });

  for (let start = 0; start < ids.length; start += size) {
    const chunk = ids.slice(start, start + size);
    if (signal?.aborted) {
      result.failed.push(...ids.slice(start).map((id) => ({ id, reason: "Cancelado antes de ser processado." })));
      break;
    }
    let outcome = await postChunk(url, chunk, signal);
    if ("retry" in outcome) outcome = await postChunk(url, chunk, signal);

    if ("fatal" in outcome || "retry" in outcome) {
      const reason = "fatal" in outcome ? outcome.fatal : outcome.retry;
      const fatal = "fatal" in outcome;
      const rest = fatal ? ids.slice(start) : chunk;
      result.failed.push(...rest.map((id) => ({ id, reason })));
      if (fatal) {
        processed = ids.length;
        onProgress?.({ processed, total: ids.length });
        break;
      }
    } else {
      result.deleted.push(...outcome.deleted);
      const reported = new Set([...outcome.deleted, ...outcome.failed.map((item) => item.id)]);
      result.failed.push(...outcome.failed);
      // Ids que o servidor ignorou (formato inválido) não podem sumir em silêncio.
      for (const id of chunk) if (!reported.has(id)) result.failed.push({ id, reason: "Item não reconhecido." });
    }
    processed += chunk.length;
    onProgress?.({ processed: Math.min(processed, ids.length), total: ids.length });
  }
  return result;
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Mensagem final: "3 itens excluídos com sucesso." ou "2 itens excluídos. 1 falhou." */
export function summarizeBulkDelete(result: BulkDeleteResult, noun: { singular: string; plural: string; deletedSingular?: string; deletedPlural?: string }): string {
  const ok = result.deleted.length;
  const bad = result.failed.length;
  const deletedWord = ok === 1 ? (noun.deletedSingular ?? "excluído") : (noun.deletedPlural ?? "excluídos");
  const word = ok === 1 ? noun.singular : noun.plural;
  if (bad === 0) return `${ok} ${word} ${deletedWord} com sucesso.`;
  if (ok === 0) return `Nenhum item foi excluído. ${pluralize(bad, "falha", "falhas")}.`;
  return `${ok} ${word} ${deletedWord}. ${pluralize(bad, "item não pôde ser excluído", "itens não puderam ser excluídos")}.`;
}
