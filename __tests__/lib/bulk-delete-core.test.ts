import { describe, expect, it, vi } from "vitest";
import { BulkNotFoundError, parseBulkIds, runBulkDelete } from "@/lib/bulk-delete/core";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const C = "33333333-3333-3333-3333-333333333333";

describe("parseBulkIds", () => {
  it("deduplica, descarta ids inválidos e preserva a ordem", () => {
    expect(parseBulkIds({ ids: [B, A, B, "lixo", 7, null] })).toEqual({ ids: [B, A] });
  });
  it("rejeita corpo sem lista, lista vazia e lista acima do limite", () => {
    expect(parseBulkIds(null)).toHaveProperty("error");
    expect(parseBulkIds({ ids: "x" })).toHaveProperty("error");
    expect(parseBulkIds({ ids: ["lixo"] })).toHaveProperty("error");
    expect(parseBulkIds({ ids: [A, B, C] }, { max: 2 })).toHaveProperty("error");
  });
  it("aceita padrão de id próprio do módulo", () => {
    expect(parseBulkIds({ ids: ["abc123"] }, { idPattern: /^[a-z0-9]+$/ })).toEqual({ ids: ["abc123"] });
  });
});

describe("runBulkDelete", () => {
  it("separa excluídos e falhas, mantendo a ordem pedida mesmo com tempos diferentes", async () => {
    const result = await runBulkDelete(
      [A, B, C],
      async (id) => {
        await new Promise((resolve) => setTimeout(resolve, id === A ? 15 : 1));
        if (id === B) throw new Error("regra de negócio");
      },
      { isUserError: (error) => (error as Error).message === "regra de negócio" },
    );
    expect(result.deleted).toEqual([A, C]);
    expect(result.failed).toEqual([{ id: B, reason: "regra de negócio" }]);
  });

  it("erro inesperado vira mensagem genérica (sem vazar detalhes) e não derruba os outros", async () => {
    const onUnexpectedError = vi.fn();
    const result = await runBulkDelete(
      [A, B],
      async (id) => {
        if (id === A) throw new Error("connection string postgres://segredo");
      },
      { onUnexpectedError },
    );
    expect(result.deleted).toEqual([B]);
    expect(result.failed).toEqual([{ id: A, reason: "Não foi possível excluir agora." }]);
    expect(onUnexpectedError).toHaveBeenCalledOnce();
  });

  it("item que já não existe conta como excluído (idempotente em reenvio)", async () => {
    const result = await runBulkDelete([A, B], async (id) => {
      if (id === A) throw new BulkNotFoundError();
    }, { isAlreadyGone: (error) => error instanceof BulkNotFoundError });
    expect(result).toEqual({ deleted: [A, B], failed: [] });
  });

  it("respeita o limite de concorrência", async () => {
    let running = 0;
    let peak = 0;
    await runBulkDelete(Array.from({ length: 12 }, (_, i) => `id-${i}`), async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 2));
      running -= 1;
    }, { concurrency: 3 });
    expect(peak).toBeLessThanOrEqual(3);
  });
});
