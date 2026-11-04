import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";
import { encryptSecret, decryptSecret } from "@/lib/instagram/backend/encryption";
import { settings } from "@/lib/imoveis/repository";
import { PropertyError, STATES, UUID, slugify } from "@/lib/imoveis/model";
import { TARGET_FIELDS, suggestMapping, type MappingConfig } from "./fields";
import { LIMITS, type RawRecord, type Format } from "./parsers";
import {
  normalizePhone,
  normalizeRecord,
  safePublicUrl,
  type Normalized,
  type PartnerContext,
} from "./transform";
import { validateFeedUrl } from "./safe-fetch";

const db = () => getDb();
const sha = (v: unknown) => createHash("sha256").update(typeof v === "string" ? v : JSON.stringify(v)).digest("hex");
const str = (v: unknown, max: number, min = 0, label = "campo") => {
  const s = typeof v === "string" ? v.trim() : v === undefined || v === null ? "" : String(v).trim();
  if (s.length < min || s.length > max) throw new PropertyError(`Confira o campo ${label} (${min} a ${max} caracteres).`);
  return s;
};
const bool = (v: unknown) => v === true;
export function id(v: unknown) {
  if (typeof v !== "string" || !UUID.test(v)) throw new PropertyError("Identificador inválido.", 404);
  return v;
}

export async function logIntegration(entry: {
  partnerId?: string | null;
  sourceId?: string | null;
  batchId?: string | null;
  level?: "info" | "warning" | "error";
  code: string;
  message: string;
  detail?: Record<string, unknown>;
}) {
  // Nunca registrar tokens/headers: o detalhe é montado só com dados não sensíveis.
  await db()`insert into property_integration_errors(partner_id,source_id,batch_id,level,code,message,detail)
    values(${entry.partnerId ?? null},${entry.sourceId ?? null},${entry.batchId ?? null},${entry.level ?? "error"},${entry.code},${entry.message.slice(0, 1000)},${JSON.stringify(entry.detail ?? {})}::jsonb)`;
}

// ================================================================ Parceiros
export type PartnerInput = Record<string, unknown>;
type Authorization = {
  authorizedBy: string;
  authorizedAt: string;
  scope: string;
  imagesMayBeCopied: boolean;
  descriptionsAllowed: boolean;
  linksAllowed: boolean;
  validUntil: string;
  conditions: string;
  removalPolicy: string;
};

function parseDate(v: unknown, label: string, required: boolean) {
  const s = str(v, 30, 0, label);
  if (!s) {
    if (required) throw new PropertyError(`Informe ${label}.`);
    return "";
  }
  if (!/^\d{4}-\d{2}-\d{2}/.test(s) || Number.isNaN(Date.parse(s))) throw new PropertyError(`Data inválida: ${label}.`);
  return s.slice(0, 10);
}

export function parsePartner(input: PartnerInput) {
  const auth = (input.authorization ?? {}) as Record<string, unknown>;
  const authorization: Authorization = {
    authorizedBy: str(auth.authorizedBy, 120, 2, "quem autorizou"),
    authorizedAt: parseDate(auth.authorizedAt, "a data da autorização", true),
    scope: str(auth.scope, 2000, 0, "escopo da autorização"),
    imagesMayBeCopied: bool(auth.imagesMayBeCopied),
    descriptionsAllowed: auth.descriptionsAllowed !== false,
    linksAllowed: auth.linksAllowed !== false,
    validUntil: parseDate(auth.validUntil, "a validade da autorização", false),
    conditions: str(auth.conditions, 2000, 0, "condições de uso"),
    removalPolicy: str(auth.removalPolicy, 2000, 0, "política de remoção"),
  };
  const partnerType = input.partnerType === "Corretor" ? "Corretor" : "Imobiliária";
  const creci = str(input.creci, 40, 0, "CRECI").toUpperCase();
  if (creci && !/^[A-Z]{2}\s?\d{1,10}[-\s]?[FJ]$/.test(creci))
    throw new PropertyError("Informe o CRECI no formato SP 123456-F ou SP 123456-J.");
  const whatsappRaw = str(input.whatsapp, 25, 0, "WhatsApp");
  const whatsapp = whatsappRaw ? normalizePhone(whatsappRaw) : "";
  if (whatsappRaw && !whatsapp) throw new PropertyError("Informe um WhatsApp comercial brasileiro com DDD.");
  const email = str(input.email, 160, 0, "e-mail");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PropertyError("E-mail comercial inválido.");
  const urlField = (v: unknown, label: string, https = false) => {
    const s = str(v, 500, 0, label);
    if (!s) return "";
    const u = safePublicUrl(s, https);
    if (!u) throw new PropertyError(`URL inválida: ${label}.`);
    return u;
  };
  const state = str(input.state, 2, 0, "UF").toUpperCase();
  if (state && !STATES.includes(state)) throw new PropertyError("UF inválida.");
  const hosts = (Array.isArray(input.allowedImageHosts) ? input.allowedImageHosts : String(input.allowedImageHosts ?? "").split(/[\s,;]+/))
    .map((h) => String(h).trim().toLowerCase())
    .filter(Boolean);
  if (hosts.length > 20 || hosts.some((h) => !/^(\*\.)?([a-z0-9-]+\.)+[a-z]{2,}$/.test(h)))
    throw new PropertyError("Domínios de imagens inválidos (ex.: fotos.imobiliaria.com.br).");
  const imagePolicy = input.imagePolicy === "copy" ? "copy" : "external";
  if (imagePolicy === "copy" && !authorization.imagesMayBeCopied)
    throw new PropertyError("Copiar fotos para o Alilu exige autorização expressa do parceiro.");
  const document = str(input.document, 20, 0, "CPF/CNPJ").replace(/\D/g, "");
  if (document && ![11, 14].includes(document.length)) throw new PropertyError("CPF/CNPJ inválido.");
  const maxListings = Number(input.maxListings ?? 2000);
  if (!Number.isInteger(maxListings) || maxListings < 1 || maxListings > 50000)
    throw new PropertyError("Limite de anúncios do parceiro inválido.");
  return {
    name: str(input.name, 120, 2, "nome"),
    tradeName: str(input.tradeName, 120, 0, "nome fantasia"),
    legalName: str(input.legalName, 160, 0, "razão social"),
    partnerType,
    creci,
    phone: str(input.phone, 25, 0, "telefone").replace(/[^\d+() -]/g, ""),
    whatsapp,
    email,
    website: urlField(input.website, "site"),
    logoUrl: urlField(input.logoUrl, "logo", true),
    city: str(input.city, 100, 0, "cidade"),
    state,
    contactPerson: str(input.contactPerson, 120, 0, "responsável"),
    privateData: { document, contactPhone: str(input.contactPhone, 25, 0, "telefone do responsável") },
    authorization,
    imagePolicy,
    allowedImageHosts: [...new Set(hosts)],
    allowListingContacts: bool(input.allowListingContacts),
    seoPolicy: input.seoPolicy === "index" ? "index" : "noindex",
    maxListings,
  };
}

export async function savePartner(input: PartnerInput, partnerId?: string) {
  const p = parsePartner(input);
  const privateData = encryptSecret(JSON.stringify(p.privateData));
  const common = [
    p.name, p.tradeName, p.legalName, p.partnerType, p.creci, p.phone, p.whatsapp, p.email, p.website, p.logoUrl,
    p.city, p.state, p.contactPerson, privateData, JSON.stringify(p.authorization), p.imagePolicy, p.allowedImageHosts,
    p.allowListingContacts, p.seoPolicy, p.maxListings,
  ];
  if (partnerId) {
    const rows = await db().query(
      `update property_partners set name=$1,trade_name=$2,legal_name=$3,partner_type=$4,creci=$5,phone=$6,whatsapp=$7,email=$8,website=$9,logo_url=$10,
        city=$11,state=$12,contact_person=$13,private_data=$14,authorization_data=$15::jsonb,image_policy=$16,allowed_image_hosts=$17::text[],
        allow_listing_contacts=$18,seo_policy=$19,max_listings=$20,updated_at=now() where id=$21 returning user_id`,
      [...common, id(partnerId)],
    );
    if (!rows[0]) throw new PropertyError("Parceiro não encontrado.", 404);
    await db()`update users set name=${`Parceiro: ${p.tradeName || p.name}`.slice(0, 160)} where id=${rows[0].user_id}`;
    return partnerId;
  }
  const newId = randomUUID();
  // Conta técnica sem login: e-mail em domínio reservado .invalid (RFC 2606) não recebe código nem é Google.
  const [user] = await db()`insert into users(email,name) values(${`parceiro-${newId}@parceiros.alilu.invalid`},${`Parceiro: ${p.tradeName || p.name}`.slice(0, 160)}) returning id`;
  await db().query(
    `insert into property_partners(id,user_id,name,trade_name,legal_name,partner_type,creci,phone,whatsapp,email,website,logo_url,city,state,contact_person,
      private_data,authorization_data,image_policy,allowed_image_hosts,allow_listing_contacts,seo_policy,max_listings)
     values($21,$22,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17::text[],$18,$19,$20)`,
    [...common, newId, user.id],
  );
  await db()`insert into property_partner_sources(partner_id,name,kind,format) values(${newId},'Upload manual','upload','csv')`;
  return newId;
}

export async function setPartnerStatus(partnerId: string, status: string, reason = "") {
  if (!["active", "inactive", "suspended"].includes(status)) throw new PropertyError("Status inválido.");
  const [row] = await db()`update property_partners set status=${status},updated_at=now() where id=${id(partnerId)} returning user_id`;
  if (!row) throw new PropertyError("Parceiro não encontrado.", 404);
  // Reaproveita a suspensão de anunciante existente: oculta instantaneamente busca, página, contato e sitemap.
  await db()`insert into property_advertisers(user_id,suspended) values(${row.user_id},${status !== "active"})
    on conflict(user_id) do update set suspended=excluded.suspended`;
  await logIntegration({ partnerId, level: "info", code: `partner-${status}`, message: `Parceiro marcado como ${status}. ${reason}`.trim() });
}

export async function recordRemovalRequest(partnerId: string, input: Record<string, unknown>) {
  const entry = {
    at: new Date().toISOString(),
    by: str(input.by, 120, 2, "solicitante"),
    detail: str(input.detail, 1000, 3, "detalhes"),
  };
  await db()`update property_partners set authorization_data=jsonb_set(authorization_data,'{removalRequests}',coalesce(authorization_data->'removalRequests','[]'::jsonb)||${JSON.stringify([entry])}::jsonb),updated_at=now() where id=${id(partnerId)}`;
}

export async function listPartners() {
  return db()`select p.id,p.name,p.trade_name,p.partner_type,p.creci,p.phone,p.whatsapp,p.email,p.website,p.logo_url,p.city,p.state,p.contact_person,
    p.status,p.authorization_data,p.image_policy,p.allowed_image_hosts,p.allow_listing_contacts,p.seo_policy,p.approved_once,p.max_listings,p.created_at::text,
    (select count(*)::int from property_external_listings e join properties x on x.id=e.property_id where e.partner_id=p.id and x.status<>'removed') as listings,
    (select count(*)::int from property_external_listings e join properties x on x.id=e.property_id where e.partner_id=p.id and x.status='published') as published
    from property_partners p order by p.name limit 500`;
}

export async function partnerContext(partnerId: string) {
  const [p] = await db()`select * from property_partners where id=${partnerId}`;
  if (!p) throw new PropertyError("Parceiro não encontrado.", 404);
  const auth = (p.authorization_data ?? {}) as Partial<Authorization>;
  const ctx: PartnerContext = {
    name: p.name as string,
    tradeName: p.trade_name as string,
    partnerType: p.partner_type as PartnerContext["partnerType"],
    creci: p.creci as string,
    whatsapp: p.whatsapp as string,
    allowListingContacts: p.allow_listing_contacts as boolean,
    allowedImageHosts: p.allowed_image_hosts as string[],
    descriptionsAllowed: auth.descriptionsAllowed !== false,
    linksAllowed: auth.linksAllowed !== false,
  };
  const expired = !!auth.validUntil && Date.parse(auth.validUntil) + 86400000 < Date.now();
  return { row: p, ctx, auth, expired };
}

// ================================================================ Fontes
const PAGINATION = ["none", "page", "cursor"];
export async function saveSource(partnerId: string, input: Record<string, unknown>, sourceId?: string) {
  const kind = String(input.kind);
  const format = String(input.format) as Format;
  if (!["upload", "url", "api"].includes(kind)) throw new PropertyError("Tipo de integração inválido.");
  if (!["csv", "xlsx", "json", "xml", "vrsync"].includes(format)) throw new PropertyError("Formato inválido.");
  const url = kind === "upload" ? "" : validateFeedUrl(str(input.url, 2000, 10, "URL do feed")).toString();
  const method = input.method === "POST" ? "POST" : "GET";
  const frequency = input.frequencyHours === null || input.frequencyHours === "" || input.frequencyHours === undefined ? null : Number(input.frequencyHours);
  if (frequency !== null && (!Number.isInteger(frequency) || frequency < 1 || frequency > 168))
    throw new PropertyError("Frequência inválida (1 a 168 horas ou manual).");
  if (kind === "upload" && frequency !== null) throw new PropertyError("Uploads manuais não têm sincronização automática.");
  const tolerance = Number(input.missingTolerance ?? 2);
  if (!Number.isInteger(tolerance) || tolerance < 1 || tolerance > 30) throw new PropertyError("Tolerância inválida (1 a 30).");
  const o = (input.options ?? {}) as Record<string, unknown>;
  const pag = (o.pagination ?? {}) as Record<string, unknown>;
  const options = {
    collectionPath: str(o.collectionPath, 200, 0, "caminho da coleção"),
    recordTag: str(o.recordTag, 100, 0, "elemento do registro"),
    delimiter: [",", ";", "\t", "|"].includes(String(o.delimiter)) ? String(o.delimiter) : "",
    sheet: str(o.sheet, 100, 0, "aba"),
    body: method === "POST" ? str(o.body, 4000, 0, "corpo da requisição") : "",
    allowLargeShrink: bool(o.allowLargeShrink),
    pagination: {
      type: PAGINATION.includes(String(pag.type)) ? String(pag.type) : "none",
      param: str(pag.param ?? "page", 40, 0, "parâmetro de página").replace(/[^\w.-]/g, ""),
      start: Math.max(0, Math.min(10, Number(pag.start ?? 1) || 0)),
      maxPages: Math.max(1, Math.min(200, Number(pag.maxPages ?? 20) || 1)),
      cursorPath: str(pag.cursorPath, 120, 0, "caminho do cursor"),
      cursorParam: str(pag.cursorParam ?? "cursor", 40, 0, "parâmetro do cursor").replace(/[^\w.-]/g, ""),
    },
  };
  if (options.body) {
    try {
      JSON.parse(options.body);
    } catch {
      throw new PropertyError("O corpo da requisição deve ser JSON.");
    }
  }
  let secret: string | undefined;
  if (input.headers !== undefined && input.headers !== null && input.headers !== "") {
    const headers = input.headers as Record<string, unknown>;
    if (typeof headers !== "object" || Array.isArray(headers)) throw new PropertyError("Headers inválidos.");
    const { sanitizeHeaders } = await import("./safe-fetch");
    const clean = sanitizeHeaders(Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, String(v)])));
    secret = Object.keys(clean).length ? encryptSecret(JSON.stringify(clean)) : "";
  }
  if (input.clearHeaders === true) secret = "";
  const args = [
    str(input.name, 120, 2, "nome da fonte"), kind, format, input.feedMode === "incremental" ? "incremental" : "full", url, method,
    JSON.stringify(options), frequency, tolerance, bool(input.autoPublish), input.active !== false,
  ];
  if (sourceId) {
    const rows = await db().query(
      `update property_partner_sources set name=$1,kind=$2,format=$3,feed_mode=$4,url=$5,method=$6,options=$7::jsonb,frequency_hours=$8,missing_tolerance=$9,
        auto_publish=$10,active=$11,secret_headers=coalesce($12,secret_headers),
        next_run_at=case when $8::int is null then null when next_run_at is null then now() else next_run_at end,updated_at=now()
        where id=$13 and partner_id=$14 returning id`,
      [...args, secret ?? null, id(sourceId), id(partnerId)],
    );
    if (!rows[0]) throw new PropertyError("Fonte não encontrada.", 404);
    return sourceId;
  }
  const [row] = await db().query(
    `insert into property_partner_sources(name,kind,format,feed_mode,url,method,options,frequency_hours,missing_tolerance,auto_publish,active,secret_headers,partner_id,next_run_at)
     values($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,case when $8::int is null then null else now() end) returning id`,
    [...args, secret ?? "", id(partnerId)],
  );
  return row.id as string;
}

export async function listSources(partnerId?: string) {
  // Nunca projeta secret_headers: o navegador só sabe se há headers configurados.
  return db().query(
    `select s.id,s.partner_id,s.name,s.kind,s.format,s.feed_mode,s.url,s.method,s.options,s.frequency_hours,s.missing_tolerance,s.auto_publish,s.active,
      s.next_run_at::text,s.last_run_at::text,s.last_status,s.last_error,s.consecutive_failures,(s.secret_headers<>'') as has_headers,
      (select jsonb_build_object('id',m.id,'version',m.version,'mapping',m.mapping,'defaults',m.defaults,'transforms',m.transforms) from property_field_mappings m where m.source_id=s.id order by m.version desc limit 1) as mapping
     from property_partner_sources s where ($1::uuid is null or s.partner_id=$1::uuid) order by s.created_at`,
    [partnerId ?? null],
  );
}

export function sourceHeaders(secret: string): Record<string, string> {
  return secret ? JSON.parse(decryptSecret(secret)) : {};
}

// ================================================================ Mapeamentos
export function parseMapping(input: Record<string, unknown>): MappingConfig {
  const keys = new Set<string>(TARGET_FIELDS.map((f) => f.key));
  const pick = (v: unknown, label: string) => {
    const out: Record<string, string> = {};
    if (!v || typeof v !== "object" || Array.isArray(v)) return out;
    for (const [k, val] of Object.entries(v)) {
      if (!keys.has(k)) throw new PropertyError(`Campo do Alilu desconhecido em ${label}: ${k}.`);
      const s = str(val, 300, 0, k);
      if (s) out[k] = s;
    }
    return out;
  };
  const t = (input.transforms ?? {}) as Record<string, unknown>;
  const dict = (v: unknown) => {
    const out: Record<string, string> = {};
    if (v && typeof v === "object" && !Array.isArray(v))
      for (const [k, val] of Object.entries(v).slice(0, 200)) if (k.trim() && String(val).trim()) out[k.trim().slice(0, 100)] = String(val).trim().slice(0, 100);
    return out;
  };
  const divisor = Number(t.priceDivisor ?? 1);
  return {
    mapping: pick(input.mapping, "mapeamento"),
    defaults: pick(input.defaults, "valores padrão"),
    transforms: {
      typeMap: dict(t.typeMap),
      purposeMap: dict(t.purposeMap),
      featureMap: dict(t.featureMap),
      photoDelimiter: str(t.photoDelimiter, 5, 0, "separador de fotos"),
      areaUnit: t.areaUnit === "ha" ? "ha" : "m2",
      priceDivisor: [1, 100].includes(divisor) ? divisor : 1,
    },
  };
}

export async function saveMapping(sourceId: string, input: Record<string, unknown>, actor: string | null) {
  const config = parseMapping(input);
  if (!config.mapping.code) throw new PropertyError("Mapeie ao menos o código externo do imóvel.");
  const [row] = await db()`insert into property_field_mappings(source_id,version,mapping,defaults,transforms,created_by)
    select ${id(sourceId)},coalesce(max(version),0)+1,${JSON.stringify(config.mapping)}::jsonb,${JSON.stringify(config.defaults)}::jsonb,${JSON.stringify(config.transforms)}::jsonb,${actor}
    from property_field_mappings where source_id=${sourceId} returning id,version`;
  return row as { id: string; version: number };
}

async function mappingById(mappingId: string): Promise<MappingConfig> {
  const [m] = await db()`select mapping,defaults,transforms from property_field_mappings where id=${mappingId}`;
  if (!m) throw new PropertyError("Mapeamento não encontrado.", 404);
  return m as unknown as MappingConfig;
}

// ================================================================ Lotes (staging)
export async function createBatch(input: {
  sourceId: string;
  fileName?: string;
  completeFeed?: boolean;
  origin?: "upload" | "sync";
  actor?: string | null;
}) {
  const [source] = await db()`select s.id,s.partner_id,p.status from property_partner_sources s join property_partners p on p.id=s.partner_id where s.id=${id(input.sourceId)}`;
  if (!source) throw new PropertyError("Fonte não encontrada.", 404);
  if (source.status !== "active") throw new PropertyError("Parceiro inativo ou suspenso.", 409);
  const [row] = await db()`insert into property_import_batches(partner_id,source_id,origin,file_name,complete_feed,created_by)
    values(${source.partner_id},${source.id},${input.origin ?? "upload"},${str(input.fileName, 200, 0, "arquivo")},${input.completeFeed === true},${input.actor ?? null}) returning id`;
  return row.id as string;
}

function cleanRecord(r: unknown): RawRecord {
  if (!r || typeof r !== "object" || Array.isArray(r)) throw new PropertyError("Registro inválido.");
  const out: RawRecord = {};
  const entries = Object.entries(r);
  if (entries.length > LIMITS.maxFields) throw new PropertyError("Registro com campos demais.");
  for (const [k, v] of entries) {
    if (k.length > 300 || k === "__proto__") continue;
    if (Array.isArray(v)) out[k] = v.slice(0, 200).map((x) => String(x).slice(0, LIMITS.maxValue));
    else if (v !== null && v !== undefined && typeof v !== "object") out[k] = String(v).slice(0, LIMITS.maxValue);
  }
  return out;
}

export async function stageRecords(batchId: string, records: unknown[], codeField?: string) {
  if (!Array.isArray(records) || records.length > 1000) throw new PropertyError("Envie até 1.000 registros por parte.");
  const [batch] = await db()`select status,(select count(*)::int from property_import_items where batch_id=${id(batchId)}) as n from property_import_batches where id=${batchId}`;
  if (!batch) throw new PropertyError("Lote não encontrado.", 404);
  if (batch.status !== "staging") throw new PropertyError("Este lote não aceita mais registros.", 409);
  const start = Number(batch.n);
  if (start + records.length > LIMITS.maxRecords) throw new PropertyError(`Limite de ${LIMITS.maxRecords} registros por lote.`, 413);
  const rows = records.map((r, i) => {
    const raw = cleanRecord(r);
    const code = codeField ? raw[codeField] : undefined;
    return { n: start + i + 1, code: (Array.isArray(code) ? code[0] : code ?? "").slice(0, 120), raw };
  });
  if (rows.length)
    await db()`insert into property_import_items(batch_id,row_number,external_code,raw)
      select ${batchId},(x->>'n')::int,x->>'code',x->'raw' from jsonb_array_elements(${JSON.stringify(rows)}::jsonb) x
      on conflict(batch_id,row_number) do nothing`;
  return start + rows.length;
}

export async function closeStaging(batchId: string, fields: string[]) {
  const clean = [...new Set((Array.isArray(fields) ? fields : []).map((f) => String(f).slice(0, 300)))].slice(0, LIMITS.maxFields);
  const [row] = await db()`update property_import_batches set status='staged',fields=${JSON.stringify(clean)}::jsonb,
    total=(select count(*) from property_import_items where batch_id=${id(batchId)}) where id=${batchId} and status='staging' returning total,source_id`;
  if (!row) throw new PropertyError("Lote indisponível para fechamento.", 409);
  if (!Number(row.total)) {
    await db()`update property_import_batches set status='failed',error='Arquivo sem registros.',finished_at=now() where id=${batchId}`;
    throw new PropertyError("Nenhum registro encontrado no arquivo.");
  }
  const [mapping] = await db()`select id from property_field_mappings where source_id=${row.source_id} order by version desc limit 1`;
  return { total: Number(row.total), suggestion: suggestMapping(clean), hasMapping: !!mapping };
}

async function claim(batchId: string, seconds = 90) {
  const rows = await db()`update property_import_batches set lock_until=now()+${seconds}*interval '1 second',attempts=attempts+1
    where id=${batchId} and (lock_until is null or lock_until<now()) returning id`;
  return rows.length > 0;
}
async function release(batchId: string) {
  await db()`update property_import_batches set lock_until=null where id=${batchId}`;
}

export async function cancelBatch(batchId: string) {
  const rows = await db()`update property_import_batches set status='cancelled',finished_at=now(),lock_until=null where id=${id(batchId)} and status in ('staging','staged','validated') returning id`;
  if (!rows.length) throw new PropertyError("Este lote não pode mais ser cancelado.", 409);
  await db()`update property_import_items set raw='{}'::jsonb,normalized=null where batch_id=${batchId}`;
}

// ================================================================ Validação (simulação sem gravar anúncios)
export function contentHash(n: Normalized) {
  return sha({ data: n.data, privateData: n.privateData, originalUrl: n.originalUrl });
}
function addressKey(n: Normalized) {
  const a = n.privateData.address.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return a.length >= 8 ? sha(`${a}|${n.privateData.zip}|${n.data.city.toLowerCase()}`) : "";
}

export async function resetValidation(batchId: string, mappingId: string) {
  const rows = await db()`update property_import_batches set status='staged',mapping_id=${id(mappingId)},valid=0,invalid=0,summary='{}'::jsonb
    where id=${id(batchId)} and status in ('staged','validated') returning id`;
  if (!rows.length) throw new PropertyError("O lote não pode ser revalidado agora.", 409);
  await db()`update property_import_items set status='staged',action='',errors='[]',warnings='[]',normalized=null where batch_id=${batchId}`;
}

export async function validateStep(batchId: string, limit = 400) {
  const [batch] = await db()`select * from property_import_batches where id=${id(batchId)}`;
  if (!batch) throw new PropertyError("Lote não encontrado.", 404);
  if (batch.status === "validated") return { done: true };
  if (batch.status !== "staged") throw new PropertyError("O lote não está pronto para validação.", 409);
  if (!batch.mapping_id) throw new PropertyError("Salve o mapeamento antes de validar.", 409);
  if (!(await claim(batchId, 60))) return { done: false, busy: true };
  try {
    const [{ ctx }, config, cfg] = await Promise.all([partnerContext(batch.partner_id as string), mappingById(batch.mapping_id as string), settings()]);
    const items = await db()`select id,row_number,raw from property_import_items where batch_id=${batchId} and status='staged' order by id limit ${limit}`;
    if (items.length) {
      const results = items.map((item) => {
        const n = normalizeRecord(item.raw as RawRecord, config, ctx, cfg);
        return { item, n, hash: n.errors.length ? "" : contentHash(n) };
      });
      const codes = [...new Set(results.map((r) => r.n.code).filter(Boolean))];
      const existing = await db().query(
        `select external_code,content_hash,image_hash from property_external_listings where partner_id=$1 and external_code=any($2::text[])`,
        [batch.partner_id, codes],
      );
      const known = new Map(existing.map((e) => [e.external_code as string, e]));
      const earlier = await db().query(
        `select external_code,min(row_number) as first from property_import_items where batch_id=$1 and external_code=any($2::text[]) and action not in ('','invalid') group by 1`,
        [batchId, codes],
      );
      const firstRow = new Map(earlier.map((e) => [e.external_code as string, Number(e.first)]));
      const updates = results.map(({ item, n, hash }) => {
        let action = "invalid";
        const seenRow = firstRow.get(n.code);
        if (!n.errors.length) {
          if (seenRow !== undefined && seenRow < Number(item.row_number)) {
            action = "duplicate-in-file";
            n.errors.push(`Código ${n.code} repetido no arquivo (linha ${seenRow}). Mantida a primeira ocorrência.`);
          } else {
            const k = known.get(n.code);
            action = !k ? "new" : k.content_hash === hash && k.image_hash === sha(n.images) ? "unchanged" : "update";
            if (n.feedStatus !== "available") action = k ? "remove" : "invalid";
            if (n.feedStatus !== "available" && !k) n.errors.push("Imóvel indisponível no feed e ainda não importado: ignorado.");
            if (!firstRow.has(n.code)) firstRow.set(n.code, Number(item.row_number));
          }
        }
        return {
          id: item.id,
          code: n.code,
          action,
          status: action === "invalid" || action === "duplicate-in-file" ? "skipped" : "validated",
          errors: n.errors,
          warnings: n.warnings,
          normalized: { ...n, hash, imageHash: sha(n.images), addressKey: addressKey(n) },
        };
      });
      await db()`update property_import_items i set external_code=u->>'code',action=u->>'action',status=u->>'status',errors=u->'errors',warnings=u->'warnings',normalized=u->'normalized'
        from jsonb_array_elements(${JSON.stringify(updates)}::jsonb) u where i.id=(u->>'id')::bigint and i.batch_id=${batchId}`;
    }
    const [left] = await db()`select count(*)::int as n from property_import_items where batch_id=${batchId} and status='staged'`;
    if (Number(left.n) > 0) return { done: false, remaining: Number(left.n) };
    await finalizeValidation(batchId, batch.fields as string[], config);
    return { done: true };
  } finally {
    await release(batchId);
  }
}

async function finalizeValidation(batchId: string, fields: string[], config: MappingConfig) {
  const [s] = await db()`select
    count(*) filter (where status='validated')::int as valid,
    count(*) filter (where status='skipped')::int as invalid,
    count(*) filter (where action='new')::int as new,
    count(*) filter (where action='update')::int as update,
    count(*) filter (where action='unchanged')::int as unchanged,
    count(*) filter (where action='remove')::int as remove,
    count(*) filter (where action='duplicate-in-file')::int as duplicate_in_file,
    count(*) filter (where status='validated' and jsonb_array_length(normalized->'images')=0)::int as no_photos,
    count(*) filter (where errors::text like '%sem preço%')::int as no_price,
    count(*) filter (where normalized->>'originalUrl'='')::int as no_link,
    count(*) filter (where errors::text ~ 'inválid|não reconhecid')::int as conversion_errors,
    count(*) filter (where status='validated' and jsonb_array_length(normalized->'blockers')>0)::int as blocked
    from property_import_items where batch_id=${batchId}`;
  const used = new Set(Object.values(config.mapping));
  const ignoredFields = fields.filter((f) => !used.has(f));
  await db()`update property_import_batches set status='validated',valid=${s.valid},invalid=${s.invalid},
    summary=${JSON.stringify({ ...s, ignoredFields })}::jsonb where id=${batchId}`;
}

export async function batchDetail(batchId: string, filter = "", page = 1) {
  const [batch] = await db()`select b.*,b.created_at::text,b.finished_at::text,p.name as partner_name,s.name as source_name,s.feed_mode
    from property_import_batches b join property_partners p on p.id=b.partner_id join property_partner_sources s on s.id=b.source_id where b.id=${id(batchId)}`;
  if (!batch) throw new PropertyError("Lote não encontrado.", 404);
  const filters: Record<string, string> = {
    invalid: `i.status='skipped'`,
    new: `i.action='new'`,
    update: `i.action='update'`,
    failed: `i.status='failed'`,
    blocked: `jsonb_array_length(coalesce(i.normalized->'blockers','[]'))>0`,
    warnings: `jsonb_array_length(i.warnings)>0`,
  };
  const where = filters[filter] ?? "true";
  const items = await db().query(
    `select i.id,i.row_number,i.external_code,i.action,i.status,i.result,i.errors,i.warnings,i.property_id,
      i.normalized->'data'->>'title' as title,i.normalized->'data'->>'price' as price,i.normalized->'data'->>'neighborhood' as neighborhood,
      i.normalized->'data'->>'city' as city,i.normalized->'data'->>'type' as type,i.normalized->'data'->>'purpose' as purpose,
      jsonb_array_length(coalesce(i.normalized->'images','[]')) as photos,i.normalized->'images'->>0 as cover,i.normalized->'blockers' as blockers,
      i.normalized->>'originalUrl' as original_url
     from property_import_items i where i.batch_id=$1 and ${where} order by i.row_number limit 50 offset $2`,
    [batchId, (Math.max(1, page) - 1) * 50],
  );
  const [progress] = await db()`select count(*) filter (where status='staged')::int as staged,count(*) filter (where status='validated')::int as pending_import,
    count(*) filter (where status='imported')::int as imported,count(*) filter (where status='failed')::int as failed from property_import_items where batch_id=${batchId}`;
  return { batch, items, progress };
}

export async function errorReport(batchId: string) {
  const rows = await db()`select row_number,external_code,action,status,errors,warnings,result from property_import_items
    where batch_id=${id(batchId)} and (status in ('skipped','failed') or jsonb_array_length(warnings)>0) order by row_number limit 20000`;
  return [
    ["Linha", "Código", "Ação", "Situação", "Erros", "Avisos", "Resultado"],
    ...rows.map((r) => [r.row_number, r.external_code, r.action, r.status, (r.errors as string[]).join(" | "), (r.warnings as string[]).join(" | "), r.result]),
  ];
}

export async function listBatches(limit = 50) {
  return db()`select b.id,b.origin,b.file_name,b.status,b.total,b.valid,b.invalid,b.created,b.updated,b.unchanged,b.skipped,b.duplicates,b.archived,b.error,
    b.created_at::text,b.finished_at::text,p.name as partner_name,s.name as source_name,b.complete_feed,b.publish
    from property_import_batches b join property_partners p on p.id=b.partner_id join property_partner_sources s on s.id=b.source_id
    order by b.created_at desc limit ${Math.min(200, limit)}`;
}

// ================================================================ Importação
export async function startImport(batchId: string, actor: string | null, publish: boolean) {
  const rows = await db()`update property_import_batches set status='importing',approved_by=${actor},publish=${publish}
    where id=${id(batchId)} and status='validated' and valid>0 returning id`;
  if (!rows.length) throw new PropertyError("Valide o lote (com ao menos um imóvel válido) antes de importar. Pode haver outra importação em andamento nesta fonte.", 409);
}

export async function reprocessFailed(batchId: string) {
  const rows = await db()`update property_import_batches set status='importing',finished_at=null where id=${id(batchId)} and status in ('completed','failed')
    and exists(select 1 from property_import_items where batch_id=${batchId} and status='failed') returning id`;
  if (!rows.length) throw new PropertyError("Não há falhas para reprocessar.", 409);
  await db()`update property_import_items set status='validated',result='' where batch_id=${batchId} and status='failed'`;
}

type ItemRow = { id: number; external_code: string; normalized: Normalized & { hash: string; imageHash: string; addressKey: string }; action: string };

export async function importStep(batchId: string, budgetMs = 20000) {
  const started = Date.now();
  const [batch] = await db()`select * from property_import_batches where id=${id(batchId)}`;
  if (!batch) throw new PropertyError("Lote não encontrado.", 404);
  if (batch.status === "completed") return { done: true };
  if (batch.status !== "importing") throw new PropertyError("O lote não está em importação.", 409);
  if (!(await claim(batchId, Math.ceil(budgetMs / 1000) + 30))) return { done: false, busy: true };
  try {
    const { row: partner, expired } = await partnerContext(batch.partner_id as string);
    if (partner.status !== "active" || expired) {
      await db()`update property_import_batches set status='failed',error='Parceiro inativo, suspenso ou com autorização vencida.',finished_at=now() where id=${batchId}`;
      return { done: true, failed: true };
    }
    while (Date.now() - started < budgetMs) {
      const items = (await db()`select id,external_code,normalized,action from property_import_items where batch_id=${batchId} and status='validated' order by id limit 25`) as unknown as ItemRow[];
      if (!items.length) break;
      for (const item of items) {
        if (Date.now() - started > budgetMs) break;
        await importItem(batch, partner, item);
      }
    }
    const [left] = await db()`select count(*)::int as n from property_import_items where batch_id=${batchId} and status='validated'`;
    if (Number(left.n) > 0) return { done: false, remaining: Number(left.n) };
    return { done: true, ...(await finalizeImport(batchId)) };
  } finally {
    await release(batchId);
  }
}

async function importItem(batch: Record<string, unknown>, partner: Record<string, unknown>, item: ItemRow) {
  const n = item.normalized;
  const status =
    n.feedStatus === "sold" ? "sold" : n.feedStatus === "rented" ? "rented" : n.feedStatus === "paused" ? "paused"
      : n.blockers.length ? "pending" : batch.publish ? "published" : "pending";
  const newId = randomUUID();
  const privateData = encryptSecret(
    JSON.stringify({
      ...n.privateData,
      consent: true,
      consentAt: (partner.authorization_data as Authorization).authorizedAt,
      termsVersion: "parceiro-2026-11",
      partnerId: partner.id,
    }),
  );
  try {
    const [res] = await db()`select * from upsert_partner_property(${partner.id}::uuid,${batch.source_id}::uuid,${batch.id}::uuid,${n.code},${newId}::uuid,
      ${`${slugify(`${n.data.title}-${n.data.city}`)}-${newId}`},${JSON.stringify(n.data)}::jsonb,${privateData},${sha(`partner:${partner.id}:${n.code}`)},
      ${JSON.stringify(n.images.map((url) => ({ url })))}::jsonb,${n.imageHash},${n.originalUrl},${n.hash},${n.addressKey},${status})`;
    await db()`update property_import_items set status=${res.out_action === "skipped" ? "skipped" : "imported"},result=${res.out_action},property_id=${res.out_property_id ?? null} where id=${item.id}`;
    if (res.out_property_id && (res.out_action === "created" || res.out_action === "updated")) await detectDuplicates(res.out_property_id as string);
  } catch (error) {
    const message = error instanceof Error && error.message.includes("property: ") ? error.message.split("property: ")[1].split("\n")[0] : "Falha ao gravar o imóvel.";
    await db()`update property_import_items set status='failed',result=${message.slice(0, 300)} where id=${item.id}`;
    await logIntegration({
      partnerId: partner.id as string,
      sourceId: batch.source_id as string,
      batchId: batch.id as string,
      code: "import-item",
      message,
      detail: { code: n.code, dbCode: (error as { code?: string })?.code ?? "" },
    });
  }
}

async function finalizeImport(batchId: string) {
  const [batch] = await db()`select b.*,s.feed_mode,s.missing_tolerance,s.options from property_import_batches b join property_partner_sources s on s.id=b.source_id where b.id=${batchId}`;
  // Códigos presentes no arquivo mas inválidos nesta rodada continuam "vistos": não contam como ausentes.
  await db()`update property_external_listings e set last_batch_id=${batchId},last_seen_at=now()
    from property_import_items i where i.batch_id=${batchId} and i.status in ('skipped','failed') and i.external_code<>'' and e.partner_id=${batch.partner_id} and e.external_code=i.external_code`;
  const [c] = await db()`select count(*) filter (where result='created')::int as created,count(*) filter (where result in ('updated'))::int as updated,
    count(*) filter (where result='unchanged')::int as unchanged,count(*) filter (where result in ('blocked','skipped') or status='skipped')::int as skipped,
    count(*) filter (where status='failed')::int as failed,count(*)::int as total from property_import_items where batch_id=${batchId}`;
  let archived = 0;
  const notes: string[] = [];
  if (batch.complete_feed && batch.feed_mode === "full") {
    const [active] = await db()`select count(*)::int as n from property_external_listings where source_id=${batch.source_id} and sync_status in ('active','missing')`;
    const seen = Number(c.total);
    const options = (batch.options ?? {}) as { allowLargeShrink?: boolean };
    if (Number(c.failed) > 0) notes.push("Ausências não aplicadas: houve falhas de gravação neste lote.");
    else if (!seen) notes.push("Ausências não aplicadas: feed vazio.");
    else if (!options.allowLargeShrink && Number(active.n) >= 10 && seen < Number(active.n) * 0.5)
      notes.push(`Ausências não aplicadas: o feed trouxe ${seen} registros contra ${active.n} ativos (queda acima de 50%). Confirme com o parceiro.`);
    else {
      const [r] = await db()`select archive_missing_partner_properties(${batch.source_id}::uuid,${batchId}::uuid,${batch.missing_tolerance}::int) as n`;
      archived = Number(r.n);
    }
    for (const note of notes)
      await logIntegration({ partnerId: batch.partner_id as string, sourceId: batch.source_id as string, batchId, level: "warning", code: "missing-guard", message: note });
  }
  const [dup] = await db()`select count(*)::int as n from property_duplicate_candidates d where d.status='open' and d.created_at>=${batch.created_at}
    and (d.property_a in (select property_id from property_import_items where batch_id=${batchId}) or d.property_b in (select property_id from property_import_items where batch_id=${batchId}))`;
  await db()`update property_import_batches set status='completed',finished_at=now(),created=${c.created},updated=${c.updated},unchanged=${c.unchanged},
    skipped=${c.skipped},archived=${archived},duplicates=${dup.n},summary=summary||${JSON.stringify({ failed: c.failed, notes })}::jsonb where id=${batchId}`;
  if (batch.publish) await db()`update property_partners set approved_once=true where id=${batch.partner_id}`;
  // Privacidade: endereços privados ficam só no bloco cifrado do anúncio; o bruto do lote é descartado ao final.
  await db()`update property_import_items set raw='{}'::jsonb,normalized=normalized-'privateData' where batch_id=${batchId} and status<>'failed'`;
  return { created: c.created, updated: c.updated, unchanged: c.unchanged, archived, failed: c.failed, notes };
}

// ================================================================ Duplicidades entre proprietários
const words = (s: string) => new Set(s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));
export function jaccard(a: string, b: string) {
  const A = words(a),
    B = words(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}
const near = (a: number, b: number, tolerance: number) => a > 0 && b > 0 && Math.abs(a - b) / Math.max(a, b) <= tolerance;

export function duplicateScore(
  a: { data: Record<string, unknown>; images: string[]; address_key: string },
  b: { data: Record<string, unknown>; images: string[]; address_key: string },
) {
  const signals: string[] = [];
  let score = 0,
    strong = false;
  const d1 = a.data,
    d2 = b.data;
  const add = (points: number, label: string, isStrong = false) => {
    score += points;
    signals.push(label);
    if (isStrong) strong = true;
  };
  if (String(d1.neighborhood).toLowerCase() === String(d2.neighborhood).toLowerCase()) add(1, "mesmo bairro");
  if (near(Number(d1.area), Number(d2.area), 0.03)) add(1, "área semelhante");
  if (near(Number(d1.price), Number(d2.price), 0.05)) add(1, "preço semelhante");
  if (["bedrooms", "bathrooms", "parking", "suites"].every((k) => Number(d1[k]) === Number(d2[k]))) add(1, "mesmos cômodos");
  if (a.address_key && a.address_key === b.address_key) add(4, "mesmo endereço (hash)", true);
  if (a.images.some((u) => b.images.includes(u))) add(4, "foto idêntica", true);
  if (jaccard(String(d1.title), String(d2.title)) >= 0.6) add(2, "título muito parecido", true);
  if (jaccard(String(d1.description), String(d2.description)) >= 0.5) add(3, "descrição muito parecida", true);
  // Preço, área e bairro parecidos, sozinhos, nunca bastam: exige um sinal forte.
  return { score, signals, flagged: strong && score >= 5 };
}

export async function detectDuplicates(propertyId: string) {
  const [p] = await db().query(
    `select p.id,p.user_id,p.data,coalesce(e.address_key,'') as address_key,
      coalesce((select array_agg(coalesce(nullif(i.source_url,''),i.url)) from property_images i where i.property_id=p.id),'{}') as images
     from properties p left join property_external_listings e on e.property_id=p.id where p.id=$1`,
    [propertyId],
  );
  if (!p) return 0;
  const d = p.data as Record<string, unknown>;
  const candidates = await db().query(
    `select p.id,p.data,coalesce(e.address_key,'') as address_key,
      coalesce((select array_agg(coalesce(nullif(i.source_url,''),i.url)) from property_images i where i.property_id=p.id),'{}') as images
     from properties p left join property_external_listings e on e.property_id=p.id
     where p.id<>$1 and p.user_id<>$2 and p.status in ('published','pending','paused') and lower(p.data->>'city')=lower($3)
       and p.data->>'type'=$4 and p.data->>'purpose'=$5 and (p.data->>'area')::numeric between $6 and $7 limit 200`,
    [p.id, p.user_id, d.city, d.type, d.purpose, Number(d.area) * 0.85, Number(d.area) * 1.15],
  );
  let found = 0;
  for (const c of candidates) {
    const r = duplicateScore(p as never, c as never);
    if (!r.flagged) continue;
    const [x, y] = [String(p.id), String(c.id)].sort();
    await db()`insert into property_duplicate_candidates(property_a,property_b,score,signals) values(${x},${y},${r.score},${JSON.stringify(r.signals)}::jsonb)
      on conflict(property_a,property_b) do update set score=excluded.score,signals=excluded.signals where property_duplicate_candidates.status='open'`;
    found++;
  }
  return found;
}

export async function listDuplicates(status = "open") {
  return db().query(
    `select d.id,d.score,d.signals,d.status,d.created_at::text,
      a.id as a_id,a.slug as a_slug,a.status as a_status,a.data->>'title' as a_title,a.data->>'price' as a_price,a.data->>'advertiser' as a_advertiser,
      b.id as b_id,b.slug as b_slug,b.status as b_status,b.data->>'title' as b_title,b.data->>'price' as b_price,b.data->>'advertiser' as b_advertiser
     from property_duplicate_candidates d join properties a on a.id=d.property_a join properties b on b.id=d.property_b
     where d.status=$1 order by d.score desc,d.created_at desc limit 200`,
    [["open", "distinct", "confirmed"].includes(status) ? status : "open"],
  );
}

export async function resolveDuplicate(duplicateId: number, status: string, actor: string) {
  if (!["distinct", "confirmed", "open"].includes(status)) throw new PropertyError("Status inválido.");
  // Confirmar NÃO remove nenhum anúncio: apenas registra a conferência; a ação sobre o anúncio é manual.
  await db()`update property_duplicate_candidates set status=${status},resolved_by=${actor},resolved_at=now() where id=${duplicateId}`;
}

// ================================================================ Imóveis importados / painel
export async function listImported(params: URLSearchParams) {
  const page = Math.max(1, Math.min(1000, Number(params.get("page")) || 1));
  const q = (params.get("q") ?? "").trim().slice(0, 100);
  const partner = params.get("partner") ?? "";
  const status = params.get("status") ?? "";
  const sync = params.get("sync") ?? "";
  const where = `($1='' or p.data->>'title' ilike '%'||$1||'%' or e.external_code ilike $1||'%')
    and ($2='' or e.partner_id::text=$2) and ($3='' or p.status=$3) and ($4='' or e.sync_status=$4) and p.status<>'removed'`;
  const args = [q, UUID.test(partner) ? partner : "", status, sync];
  const [items, count] = await Promise.all([
    db().query(
      `select p.id,p.slug,p.status,p.revision,p.reason,p.data->>'title' as title,p.data->>'price' as price,p.data->>'city' as city,p.data->>'neighborhood' as neighborhood,
        e.external_code,e.original_url,e.sync_status,e.missing_count,e.outbound_clicks::int,e.last_synced_at::text,pp.name as partner_name,p.views::int,p.contacts::int,
        (select count(*)::int from property_images i where i.property_id=p.id) as photos
       from property_external_listings e join properties p on p.id=e.property_id join property_partners pp on pp.id=e.partner_id
       where ${where} order by e.last_synced_at desc limit 25 offset $5`,
      [...args, (page - 1) * 25],
    ),
    db().query(`select count(*)::int as n from property_external_listings e join properties p on p.id=e.property_id where ${where}`, args),
  ]);
  return { items, total: Number(count[0].n), page };
}

export async function bulkImported(ids: unknown, action: string, actor: string, reason = "") {
  if (!Array.isArray(ids) || !ids.length || ids.length > 100) throw new PropertyError("Selecione de 1 a 100 imóveis.");
  const list = ids.map(id);
  const { transition } = await import("@/lib/imoveis/repository");
  let ok = 0;
  for (const pid of list) {
    // Somente imóveis de parceiros: ações em lote nunca alcançam anúncios diretos.
    const [ext] = await db()`select p.status from property_external_listings e join properties p on p.id=e.property_id where e.property_id=${pid}`;
    if (!ext) continue;
    try {
      if (action === "publish" && ext.status === "pending") await transition(actor, pid, "published", true, "");
      else if (action === "reject" && ["pending", "published"].includes(ext.status as string)) await transition(actor, pid, "rejected", true, reason || "Suspenso pela administração.");
      else if (action === "restore" && ext.status === "rejected") {
        await db()`update properties set status='pending',reason='',revision=revision+1,updated_at=now() where id=${pid} and status='rejected'`;
        await db()`insert into property_history(property_id,actor_id,action,snapshot) values(${pid},${actor},'partner-restore','{}'::jsonb)`;
      } else continue;
      ok++;
    } catch {
      /* Itens que não podem mudar de estado são ignorados e contabilizados. */
    }
  }
  return { ok, total: list.length };
}

export async function dashboard() {
  const [counts] = await db()`select
    (select count(*)::int from property_partners) as partners,
    (select count(*)::int from property_partners where status='active') as active_partners,
    (select count(*)::int from property_external_listings e join properties p on p.id=e.property_id where p.status<>'removed') as imported,
    (select count(*)::int from property_external_listings e join properties p on p.id=e.property_id where p.status='published') as published,
    (select count(*)::int from property_external_listings e join properties p on p.id=e.property_id where p.status='pending') as pending,
    (select count(*)::int from property_integration_errors where level='error' and created_at>now()-interval '7 days') as errors,
    (select count(*)::int from property_duplicate_candidates where status='open') as duplicates,
    (select coalesce(sum(outbound_clicks),0)::int from property_external_listings) as clicks,
    (select max(finished_at)::text from property_import_batches where origin='sync' and status='completed') as last_sync,
    (select min(next_run_at)::text from property_partner_sources s join property_partners p on p.id=s.partner_id where s.active and s.frequency_hours is not null and p.status='active') as next_sync`;
  const perPartner = await db()`select pp.name,count(*) filter (where p.status='published')::int as published,count(*) filter (where p.status='pending')::int as pending,count(*)::int as total
    from property_partners pp left join property_external_listings e on e.partner_id=pp.id left join properties p on p.id=e.property_id and p.status<>'removed'
    group by pp.id,pp.name order by total desc limit 50`;
  return { counts, perPartner };
}

export async function listLogs(partnerId?: string) {
  return db().query(
    `select l.id,l.level,l.code,l.message,l.detail,l.created_at::text,p.name as partner_name,l.batch_id from property_integration_errors l
     left join property_partners p on p.id=l.partner_id where ($1::uuid is null or l.partner_id=$1::uuid) order by l.created_at desc limit 200`,
    [partnerId && UUID.test(partnerId) ? partnerId : null],
  );
}

// ================================================================ Página pública
export async function partnerListing(propertyId: string) {
  const [row] = await db()`select e.original_url,e.last_synced_at::text,pp.name,pp.trade_name,pp.logo_url,pp.website,pp.seo_policy,pp.partner_type
    from property_external_listings e join property_partners pp on pp.id=e.partner_id where e.property_id=${propertyId} and pp.status='active'`;
  return (row as
    | { original_url: string; last_synced_at: string; name: string; trade_name: string; logo_url: string; website: string; seo_policy: string; partner_type: string }
    | undefined) ?? null;
}

export async function outboundUrl(propertyId: string, visitorKey: string) {
  const [row] = await db()`select e.original_url from property_external_listings e join properties p on p.id=e.property_id
    join property_partners pp on pp.id=e.partner_id
    where e.property_id=${id(propertyId)} and p.status='published' and (p.expires_at is null or p.expires_at>now()) and pp.status='active'
    and not exists(select 1 from property_advertisers a where a.user_id=p.user_id and a.suspended)`;
  const url = row ? safePublicUrl(String(row.original_url)) : null;
  if (!url) return null;
  const event = await db()`insert into property_rate_limits(key) values(${`outbound:${propertyId}:${visitorKey}`}) on conflict do nothing returning key`;
  if (event.length) await db()`update property_external_listings set outbound_clicks=outbound_clicks+1 where property_id=${propertyId}`;
  return url;
}
