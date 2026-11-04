import { getAdminSession } from "@/lib/admin/admin-access";
import { api, boundedBody, identity } from "@/lib/imoveis/http";
import { PropertyError } from "@/lib/imoveis/model";
import * as repo from "@/lib/imoveis/integracoes/repository";
import { runSource } from "@/lib/imoveis/integracoes/sync";
import { toCsv } from "@/lib/imoveis/integracoes/parsers";

// Área exclusivamente administrativa. Rotas estáticas têm prioridade sobre
// /api/imoveis/[[...path]], então este módulo não altera a API existente.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parts(request: Request) {
  return new URL(request.url).pathname.replace(/^\/api\/imoveis\/integracoes\/?/, "").split("/").filter(Boolean);
}
async function body(request: Request, max = 64 * 1024): Promise<Record<string, unknown>> {
  const buffer = await boundedBody(request, max);
  let parsed: unknown;
  try {
    parsed = JSON.parse(buffer.toString("utf8"));
  } catch {
    throw new PropertyError("JSON inválido.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new PropertyError("Envie um objeto JSON.");
  return parsed as Record<string, unknown>;
}
async function admin() {
  const session = await getAdminSession();
  if (!session) throw new PropertyError("Acesso restrito.", 403);
  return session.userId;
}

export const GET = api(async (request) => {
  await admin();
  const path = parts(request),
    params = new URL(request.url).searchParams;
  switch (path[0]) {
    case undefined:
    case "painel":
      return Response.json({
        dashboard: await repo.dashboard(),
        partners: await repo.listPartners(),
        sources: await repo.listSources(),
        batches: await repo.listBatches(30),
      });
    case "parceiros":
      return Response.json({ items: await repo.listPartners() });
    case "fontes":
      return Response.json({ items: await repo.listSources(params.get("partner") || undefined) });
    case "lotes":
      if (path[1] && path[2] === "erros.csv")
        return new Response(toCsv(await repo.errorReport(repo.id(path[1]))), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="erros-importacao-${path[1].slice(0, 8)}.csv"`,
          },
        });
      if (path[1]) return Response.json(await repo.batchDetail(path[1], params.get("filter") ?? "", Number(params.get("page")) || 1));
      return Response.json({ items: await repo.listBatches(100) });
    case "importados":
      return Response.json(await repo.listImported(params));
    case "duplicidades":
      return Response.json({ items: await repo.listDuplicates(params.get("status") ?? "open") });
    case "logs":
      return Response.json({ items: await repo.listLogs(params.get("partner") ?? undefined) });
  }
  throw new PropertyError("Rota não encontrada.", 404);
});

export const POST = api(async (request) => {
  const user = await identity(request, true);
  const path = parts(request);
  const [resource, target, action] = path;
  if (resource === "parceiros") {
    if (!target) return Response.json({ id: await repo.savePartner(await body(request)) }, { status: 201 });
    const b = await body(request);
    if (action === "status") await repo.setPartnerStatus(repo.id(target), String(b.status), String(b.reason ?? "").slice(0, 300));
    else if (action === "remocao") await repo.recordRemovalRequest(target, b);
    else throw new PropertyError("Rota não encontrada.", 404);
    return Response.json({ ok: true });
  }
  if (resource === "fontes") {
    if (!target) {
      const b = await body(request);
      return Response.json({ id: await repo.saveSource(repo.id(b.partnerId), b) }, { status: 201 });
    }
    if (action === "mapeamento") return Response.json(await repo.saveMapping(target, await body(request), user));
    if (action === "sincronizar") return Response.json(await runSource(repo.id(target), 45000));
    throw new PropertyError("Rota não encontrada.", 404);
  }
  if (resource === "lotes") {
    if (!target) {
      const b = await body(request);
      return Response.json(
        { id: await repo.createBatch({ sourceId: String(b.sourceId), fileName: String(b.fileName ?? ""), completeFeed: b.completeFeed === true, actor: user }) },
        { status: 201 },
      );
    }
    const batchId = repo.id(target);
    if (action === "registros") {
      // Partes de até ~4 MB (limite de corpo das Functions na Vercel é 4,5 MB).
      const b = await body(request, 4 * 1024 * 1024);
      return Response.json({ staged: await repo.stageRecords(batchId, b.records as unknown[], typeof b.codeField === "string" ? b.codeField : undefined) });
    }
    if (action === "fechar") return Response.json(await repo.closeStaging(batchId, (await body(request)).fields as string[]));
    if (action === "validar") {
      const b = await body(request);
      if (typeof b.mappingId === "string") await repo.resetValidation(batchId, b.mappingId);
      return Response.json(await repo.validateStep(batchId));
    }
    if (action === "importar") {
      const b = await body(request);
      await repo.startImport(batchId, user, b.publish === true);
      return Response.json({ ok: true });
    }
    if (action === "processar") return Response.json(await repo.importStep(batchId, 20000));
    if (action === "reprocessar") {
      await repo.reprocessFailed(batchId);
      return Response.json({ ok: true });
    }
    if (action === "cancelar") {
      await repo.cancelBatch(batchId);
      return Response.json({ ok: true });
    }
  }
  if (resource === "importados" && target === "lote") {
    const b = await body(request);
    if (!["publish", "reject", "restore"].includes(String(b.action))) throw new PropertyError("Ação inválida.");
    if (b.confirm !== true) throw new PropertyError("Confirme a ação em lote.");
    return Response.json(await repo.bulkImported(b.ids, String(b.action), user, String(b.reason ?? "").slice(0, 300)));
  }
  if (resource === "duplicidades" && target) {
    const n = Number(target);
    if (!Number.isInteger(n) || n < 1) throw new PropertyError("Identificador inválido.", 404);
    await repo.resolveDuplicate(n, String((await body(request)).status), user);
    return Response.json({ ok: true });
  }
  throw new PropertyError("Rota não encontrada.", 404);
});

export const PATCH = api(async (request) => {
  await identity(request, true);
  const [resource, target] = parts(request);
  const b = await body(request);
  if (resource === "parceiros" && target) return Response.json({ id: await repo.savePartner(b, repo.id(target)) });
  if (resource === "fontes" && target) return Response.json({ id: await repo.saveSource(repo.id(b.partnerId), b, repo.id(target)) });
  throw new PropertyError("Rota não encontrada.", 404);
});
