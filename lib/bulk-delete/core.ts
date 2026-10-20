/**
 * Núcleo puro (sem I/O, sem "server-only") da exclusão em massa — testável
 * direto e compartilhado pelos endpoints (lib/bulk-delete/server.ts).
 */
export const BULK_DELETE_MAX_IDS = 200;
/** Qualquer id canônico do projeto (uuid). Módulos com outro formato passam o próprio padrão. */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface BulkDeleteFailure {
  id: string;
  reason: string;
}

export interface BulkDeleteResult {
  deleted: string[];
  failed: BulkDeleteFailure[];
}

export function parseBulkIds(
  body: unknown,
  options: { idPattern?: RegExp; max?: number } = {},
): { ids: string[] } | { error: string } {
  const pattern = options.idPattern ?? UUID_PATTERN;
  const max = options.max ?? BULK_DELETE_MAX_IDS;
  const raw = typeof body === "object" && body !== null ? (body as { ids?: unknown }).ids : undefined;
  if (!Array.isArray(raw)) return { error: "Informe a lista de itens a excluir." };
  const ids = [...new Set(raw.filter((id): id is string => typeof id === "string" && pattern.test(id)))];
  if (ids.length === 0) return { error: "Nenhum item selecionado." };
  if (ids.length > max) return { error: `Selecione no máximo ${max} itens por vez.` };
  return { ids };
}

export async function runBulkDelete(
  ids: string[],
  deleteOne: (id: string) => Promise<void>,
  options: {
    concurrency?: number;
    isUserError?: (error: unknown) => boolean;
    isAlreadyGone?: (error: unknown) => boolean;
    onUnexpectedError?: (id: string, error: unknown) => void;
  } = {},
): Promise<BulkDeleteResult> {
  const concurrency = Math.max(1, options.concurrency ?? 5);
  const outcomes = new Map<string, BulkDeleteFailure | null>();
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      try {
        await deleteOne(id);
        outcomes.set(id, null);
      } catch (error) {
        if (options.isAlreadyGone?.(error)) {
          outcomes.set(id, null);
        } else if (options.isUserError?.(error)) {
          outcomes.set(id, { id, reason: (error as Error).message });
        } else {
          options.onUnexpectedError?.(id, error);
          outcomes.set(id, { id, reason: "Não foi possível excluir agora." });
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));

  // Mantém a ordem pedida, independente de qual worker terminou primeiro.
  const deleted: string[] = [];
  const failed: BulkDeleteFailure[] = [];
  for (const id of ids) {
    const outcome = outcomes.get(id);
    if (outcome === null) deleted.push(id);
    else if (outcome) failed.push(outcome);
  }
  return { deleted, failed };
}

/**
 * Lançado por `deleteOne` quando o item já não existe para o usuário. É
 * tratado como sucesso (idempotência): reenviar um lote que foi processado
 * mas cuja resposta se perdeu não gera falsas falhas.
 */
export class BulkNotFoundError extends Error {
  constructor(message = "Item não encontrado.") {
    super(message);
    this.name = "BulkNotFoundError";
  }
}
