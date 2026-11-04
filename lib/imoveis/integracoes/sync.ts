import "server-only";
import { put } from "@vercel/blob";
import { getDb } from "@/lib/db/client";
import { processImage } from "@/lib/imoveis/images";
import { PropertyError } from "@/lib/imoveis/model";
import { parseFile, parseJsonValue, ImportParseError, LIMITS, type Format, type RawRecord } from "./parsers";
import { safeFetch, SafeFetchError } from "./safe-fetch";
import {
  closeStaging,
  createBatch,
  importStep,
  logIntegration,
  partnerContext,
  resetValidation,
  sourceHeaders,
  stageRecords,
  startImport,
  validateStep,
} from "./repository";
import { suggestMapping } from "./fields";

const db = () => getDb();
const ACCEPT = /xml|json|csv|text\/plain|octet-stream|spreadsheet|excel|zip/i;

type SourceOptions = {
  collectionPath?: string;
  recordTag?: string;
  delimiter?: string;
  sheet?: string;
  body?: string;
  pagination?: { type: string; param: string; start: number; maxPages: number; cursorPath: string; cursorParam: string };
};

function getPath(value: unknown, path: string): unknown {
  let cur = value;
  for (const part of path.split(".").filter(Boolean)) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/** Busca e lê todas as páginas autorizadas do feed (limitado em páginas, bytes e registros). */
export async function fetchFeed(source: Record<string, unknown>) {
  const options = (source.options ?? {}) as SourceOptions;
  const headers = sourceHeaders(String(source.secret_headers ?? ""));
  const format = source.format as Format;
  const pag = options.pagination ?? { type: "none", param: "page", start: 1, maxPages: 1, cursorPath: "", cursorParam: "cursor" };
  const records: RawRecord[] = [];
  const fields = new Set<string>();
  let cursor = "";
  let bytes = 0;
  for (let i = 0; i < (pag.type === "none" ? 1 : pag.maxPages); i++) {
    const url = new URL(String(source.url));
    if (pag.type === "page") url.searchParams.set(pag.param || "page", String(pag.start + i));
    if (pag.type === "cursor" && cursor) url.searchParams.set(pag.cursorParam || "cursor", cursor);
    const res = await safeFetch(url.toString(), {
      method: source.method === "POST" ? "POST" : "GET",
      headers,
      body: options.body || undefined,
      accept: ACCEPT,
      maxBytes: 25 * 1024 * 1024 - bytes,
    });
    bytes += res.body.length;
    const data = new Uint8Array(res.body);
    let page;
    let doc: unknown = null;
    if (format === "json") {
      try {
        doc = JSON.parse(new TextDecoder().decode(data));
      } catch {
        throw new ImportParseError("JSON malformado.");
      }
      page = parseJsonValue(doc as never, { collectionPath: options.collectionPath || undefined });
    } else {
      page = await parseFile(data, format === "vrsync" ? "xml" : format, {
        delimiter: options.delimiter || undefined,
        sheet: options.sheet || undefined,
        recordTag: options.recordTag || (format === "vrsync" ? "Listing" : undefined),
        collectionPath: options.collectionPath || undefined,
      });
    }
    records.push(...page.records);
    page.fields.forEach((f) => fields.add(f));
    if (records.length > LIMITS.maxRecords) throw new ImportParseError(`Feed acima de ${LIMITS.maxRecords} registros.`);
    if (pag.type === "page" && !page.records.length) break;
    if (pag.type === "cursor") {
      const next = doc && pag.cursorPath ? getPath(doc, pag.cursorPath) : null;
      if (!next || typeof next !== "string" || next === cursor) break;
      cursor = next.slice(0, 500);
    }
  }
  return { records, fields: [...fields] };
}

/** Executa uma sincronização: busca, staging, validação e importação dentro do orçamento de tempo. */
export async function runSource(sourceId: string, budgetMs = 45000) {
  const started = Date.now();
  const [source] = await db()`select * from property_partner_sources where id=${sourceId}`;
  if (!source || source.kind === "upload") throw new PropertyError("Fonte sem feed configurado.", 409);
  const { row: partner, expired } = await partnerContext(source.partner_id as string);
  const base = { partnerId: partner.id as string, sourceId };
  if (partner.status !== "active" || !source.active || expired) {
    await logIntegration({ ...base, level: "warning", code: "sync-skipped", message: expired ? "Autorização do parceiro vencida: sincronização não executada." : "Parceiro ou fonte inativos." });
    return { skipped: true };
  }
  const [mapping] = await db()`select id from property_field_mappings where source_id=${sourceId} order by version desc limit 1`;
  let batchId: string | null = null;
  try {
    batchId = await createBatch({ sourceId, origin: "sync", completeFeed: source.feed_mode === "full", fileName: new URL(String(source.url)).host });
    const feed = await fetchFeed(source);
    if (!feed.records.length) throw new ImportParseError("Feed sem registros. Nenhum imóvel foi alterado.");
    const codeField = mapping ? ((await db()`select mapping->>'code' as f from property_field_mappings where id=${mapping.id}`)[0].f as string) : suggestMapping(feed.fields).code;
    for (let i = 0; i < feed.records.length; i += 1000) await stageRecords(batchId, feed.records.slice(i, i + 1000), codeField);
    await closeStaging(batchId, feed.fields);
    if (!mapping) {
      // Sem mapeamento aprovado não há importação automática: o lote fica aguardando revisão.
      await logIntegration({ ...base, batchId, level: "warning", code: "sync-needs-mapping", message: "Feed lido, mas a fonte ainda não tem mapeamento salvo. Revise o lote no painel." });
      await finishSource(sourceId, "aguardando mapeamento", "");
      return { batchId, needsMapping: true };
    }
    await resetValidation(batchId, mapping.id as string);
    const result = await continueBatch(batchId, budgetMs - (Date.now() - started));
    await finishSource(sourceId, result.done ? "ok" : "em andamento", "");
    return { batchId, ...result };
  } catch (error) {
    const message = error instanceof SafeFetchError || error instanceof ImportParseError || error instanceof PropertyError ? error.message : "Falha inesperada na sincronização.";
    if (batchId) await db()`update property_import_batches set status='failed',error=${message},finished_at=now(),lock_until=null where id=${batchId} and status in ('staging','staged','validated')`;
    await db()`update property_partner_sources set last_run_at=now(),last_status='falha',last_error=${message},consecutive_failures=consecutive_failures+1 where id=${sourceId}`;
    // Erro HTTP, timeout, arquivo vazio ou parsing inválido NUNCA arquivam imóveis.
    await logIntegration({ ...base, batchId, code: error instanceof SafeFetchError ? `fetch-${error.code}` : "sync-failed", message });
    return { batchId, failed: true, error: message };
  }
}

async function finishSource(sourceId: string, status: string, error: string) {
  await db()`update property_partner_sources set last_run_at=now(),last_status=${status},last_error=${error},consecutive_failures=0 where id=${sourceId}`;
}

/** Continua um lote de sincronização (validação → importação). Idempotente e retomável. */
export async function continueBatch(batchId: string, budgetMs: number) {
  const started = Date.now();
  for (;;) {
    const [b] = await db()`select b.status,b.origin,b.partner_id,s.auto_publish,p.approved_once from property_import_batches b
      join property_partner_sources s on s.id=b.source_id join property_partners p on p.id=b.partner_id where b.id=${batchId}`;
    if (!b || ["completed", "failed", "cancelled", "staging"].includes(b.status as string)) return { done: true };
    if (Date.now() - started > budgetMs) return { done: false };
    if (b.status === "staged") {
      const r = await validateStep(batchId);
      if (r.busy) return { done: false };
      continue;
    }
    if (b.status === "validated") {
      if (b.origin !== "sync") return { done: true };
      const [v] = await db()`select valid from property_import_batches where id=${batchId}`;
      if (!Number(v.valid)) {
        await db()`update property_import_batches set status='failed',error='Nenhum imóvel válido no feed. Nada foi alterado.',finished_at=now() where id=${batchId}`;
        return { done: true };
      }
      // Publicação automática só depois da primeira aprovação administrativa e com opção ligada na fonte.
      await startImport(batchId, null, b.approved_once === true && b.auto_publish === true);
      continue;
    }
    if (b.status === "importing") {
      const r = await importStep(batchId, Math.min(20000, budgetMs - (Date.now() - started)));
      if (r.busy || !r.done) return { done: false };
      continue;
    }
    return { done: true };
  }
}

/** Cópia de fotos para o Blob, somente para parceiros com autorização expressa (image_policy='copy'). */
export async function copyPendingImages(limit = 10) {
  const rows = await db()`select i.id,i.user_id,i.source_url from property_images i join property_external_listings e on e.property_id=i.property_id
    join property_partners pp on pp.id=e.partner_id where i.external and i.source_url<>'' and pp.image_policy='copy' and pp.status='active'
    and not exists(select 1 from property_rate_limits r where r.key='imgcopy:'||i.id::text) limit ${limit}`;
  let copied = 0;
  for (const row of rows) {
    await db()`insert into property_rate_limits(key) values(${`imgcopy:${row.id}`}) on conflict do nothing`;
    // Reserva de 2 MiB dentro do orçamento de storage do módulo.
    const [reserved] = await db()`update property_images set bytes=2097152 where id=${row.id} and external and bytes=0
      and (select coalesce(sum(bytes),0) from property_images)+2097152 <= (select (config->>'storageMB')::bigint*1048576 from property_settings where id=1) returning id`;
    if (!reserved) break;
    try {
      const res = await safeFetch(String(row.source_url), { accept: /^image\/(jpeg|png|webp)/i, maxBytes: 15 * 1024 * 1024, timeoutMs: 15000 });
      const ext = res.contentType.includes("png") ? "png" : res.contentType.includes("webp") ? "webp" : "jpg";
      const { full, thumb } = await processImage(res.body, ext, res.contentType.split(";")[0]);
      const opts = { access: "public" as const, contentType: "image/webp", addRandomSuffix: false, cacheControlMaxAge: 31536000 };
      const photo = await put(`imoveis/${row.user_id}/${row.id}.webp`, full, opts);
      const thumbnail = await put(`imoveis/${row.user_id}/${row.id}-thumb.webp`, thumb, opts);
      await db()`update property_images set url=${photo.url},thumbnail=${thumbnail.url},bytes=${full.length + thumb.length},external=false where id=${row.id}`;
      copied++;
    } catch (error) {
      await db()`update property_images set bytes=0 where id=${row.id} and external`;
      await logIntegration({ level: "warning", code: "image-copy", message: error instanceof Error ? error.message.slice(0, 200) : "Falha ao copiar foto.", detail: { image: row.id } });
    }
  }
  return copied;
}

/** Rotina agendada: fontes vencidas, lotes interrompidos, cópia de fotos e limpeza. */
export async function runIntegrationCron(budgetMs = 50000) {
  const started = Date.now();
  const left = () => budgetMs - (Date.now() - started);
  const report = { resumed: 0, synced: 0, copied: 0, purged: 0 };
  // 1. Retoma lotes interrompidos (lock expirado).
  const pending = await db()`select id from property_import_batches where (status='importing' or (status='staged' and origin='sync' and mapping_id is not null))
    and (lock_until is null or lock_until<now()) order by created_at limit 5`;
  for (const b of pending) {
    if (left() < 8000) break;
    await continueBatch(b.id as string, Math.min(20000, left() - 5000));
    report.resumed++;
  }
  // 2. Fontes com sincronização vencida: claim atômico do próximo horário evita execuções duplicadas.
  while (left() > 15000) {
    const [due] = await db()`update property_partner_sources s set next_run_at=now()+make_interval(hours=>s.frequency_hours)
      where s.id=(select s2.id from property_partner_sources s2 join property_partners p on p.id=s2.partner_id
        where s2.active and s2.frequency_hours is not null and s2.next_run_at<=now() and p.status='active' and s2.kind<>'upload'
        and not exists(select 1 from property_import_batches b where b.source_id=s2.id and b.status in ('staging','importing'))
        order by s2.next_run_at limit 1 for update skip locked) returning s.id`;
    if (!due) break;
    await runSource(due.id as string, left() - 5000);
    report.synced++;
  }
  // 3. Fotos autorizadas para cópia.
  if (left() > 10000) report.copied = await copyPendingImages(5);
  // 4. Limpeza: dados brutos de lotes antigos e lotes abandonados.
  const purged = await db()`with old as (
      update property_import_items set raw='{}'::jsonb,normalized=null where batch_id in (
        select id from property_import_batches where finished_at<now()-interval '30 days') and raw<>'{}'::jsonb returning 1)
    select count(*)::int as n from old`;
  await db()`update property_import_batches set status='failed',error='Interrompido durante a leitura do feed.',finished_at=now() where status='staging' and origin='sync' and created_at<now()-interval '1 hour'`;
  await db()`update property_import_batches set status='cancelled',finished_at=now() where status in ('staging','staged','validated') and created_at<now()-interval '7 days'`;
  await db()`delete from property_import_items where batch_id in (select id from property_import_batches where status='cancelled' and finished_at<now()-interval '2 days')`;
  await db()`delete from property_integration_errors where created_at<now()-interval '180 days'`;
  report.purged = Number(purged[0].n);
  return report;
}
