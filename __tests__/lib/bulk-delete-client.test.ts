import { afterEach, describe, expect, it, vi } from "vitest";
import { bulkDeleteInChunks, summarizeBulkDelete } from "@/lib/bulk-delete/client";

const ids = Array.from({ length: 5 }, (_, i) => `id-${i}`);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => vi.unstubAllGlobals());

describe("bulkDeleteInChunks", () => {
  it("envia em lotes (menos requisições que uma por item) e informa o progresso", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const { ids: sent } = JSON.parse(init.body as string) as { ids: string[] };
      return json({ deleted: sent, failed: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
    const progress: number[] = [];
    const result = await bulkDeleteInChunks({ url: "/x", ids, chunkSize: 2, onProgress: (p) => progress.push(p.processed) });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.deleted).toEqual(ids);
    expect(progress).toEqual([0, 2, 4, 5]);
  });

  it("falha parcial: reporta o motivo do servidor por item", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ deleted: ["id-0"], failed: [{ id: "id-1", reason: "Está em processamento." }] })));
    const result = await bulkDeleteInChunks({ url: "/x", ids: ["id-0", "id-1"] });
    expect(result.deleted).toEqual(["id-0"]);
    expect(result.failed).toEqual([{ id: "id-1", reason: "Está em processamento." }]);
  });

  it("aceita o formato antigo da biblioteca de mídia ({ kept })", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ deleted: ["id-0"], kept: [{ id: "id-1", reason: "Já usada em publicação." }] })));
    const result = await bulkDeleteInChunks({ url: "/x", ids: ["id-0", "id-1"] });
    expect(result.failed).toEqual([{ id: "id-1", reason: "Já usada em publicação." }]);
  });

  it("falha de rede: tenta o lote de novo uma vez e, se persistir, marca só aquele lote como falha e segue", async () => {
    let call = 0;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      call += 1;
      const { ids: sent } = JSON.parse(init.body as string) as { ids: string[] };
      if (sent[0] === "id-0") throw new TypeError("network");
      return json({ deleted: sent, failed: [] });
    }));
    const result = await bulkDeleteInChunks({ url: "/x", ids: ["id-0", "id-1", "id-2"], chunkSize: 2 });
    expect(call).toBe(3); // lote 1 + retry + lote 2
    expect(result.failed.map((f) => f.id)).toEqual(["id-0", "id-1"]);
    expect(result.deleted).toEqual(["id-2"]);
  });

  it("rede volta no retry: sem falhas", async () => {
    let first = true;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      if (first) { first = false; throw new TypeError("network"); }
      return json({ deleted: (JSON.parse(init.body as string) as { ids: string[] }).ids, failed: [] });
    }));
    const result = await bulkDeleteInChunks({ url: "/x", ids: ["id-0"] });
    expect(result).toEqual({ deleted: ["id-0"], failed: [] });
  });

  it("sessão expirada (401) interrompe e marca o restante como falha", async () => {
    const fetchMock = vi.fn(async () => json({ error: "Não autenticado." }, 401));
    vi.stubGlobal("fetch", fetchMock);
    const result = await bulkDeleteInChunks({ url: "/x", ids, chunkSize: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.failed).toHaveLength(5);
  });

  it("id que o servidor ignorou não some em silêncio", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ deleted: ["id-0"], failed: [] })));
    const result = await bulkDeleteInChunks({ url: "/x", ids: ["id-0", "id-1"] });
    expect(result.failed).toEqual([{ id: "id-1", reason: "Item não reconhecido." }]);
  });
});

describe("summarizeBulkDelete", () => {
  const noun = { singular: "item", plural: "itens" };
  it("sucesso total", () => {
    expect(summarizeBulkDelete({ deleted: ["a", "b", "c"], failed: [] }, noun)).toBe("3 itens excluídos com sucesso.");
    expect(summarizeBulkDelete({ deleted: ["a"], failed: [] }, noun)).toBe("1 item excluído com sucesso.");
  });
  it("parcial e total", () => {
    expect(summarizeBulkDelete({ deleted: ["a", "b"], failed: [{ id: "c", reason: "x" }] }, noun)).toBe("2 itens excluídos. 1 item não pôde ser excluído.");
    expect(summarizeBulkDelete({ deleted: [], failed: [{ id: "c", reason: "x" }] }, noun)).toBe("Nenhum item foi excluído. 1 falha.");
  });
});
