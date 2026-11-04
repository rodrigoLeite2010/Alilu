// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createTestDb, type TestDb } from "../helpers/pglite-db";
import { EMPTY_PROPERTY } from "@/lib/imoveis/model";
import { TEMPLATE_COLUMNS, TEMPLATE_EXAMPLE, TEMPLATE_MAPPING } from "@/lib/imoveis/integracoes/fields";
import { parseCsv, parseXml } from "@/lib/imoveis/integracoes/parsers";

let db: TestDb;
let sql: TestDb["sql"] & { query: (text: string, args: unknown[]) => Promise<Record<string, unknown>[]> };
let owner: string, admin: string;
const session = vi.hoisted(() => ({ user: { id: "", email: "owner@example.com" } }));
const adminSession = vi.hoisted(() => ({ value: null as null | { userId: string; email: string } }));
const feed = vi.hoisted(() => ({ body: "", fail: null as null | Error }));
vi.mock("@/lib/db/client", () => ({ getDb: () => sql }));
vi.mock("@/auth", () => ({ auth: async () => session }));
vi.mock("@/lib/admin/admin-access", () => ({ getAdminSession: async () => adminSession.value }));
vi.mock("@vercel/blob", () => ({
  put: vi.fn(async (path: string) => ({ url: `https://test.public.blob.vercel-storage.com/${path}` })),
  del: vi.fn(async () => {}),
  list: vi.fn(async () => ({ blobs: [], hasMore: false })),
}));
vi.mock("@/lib/imoveis/integracoes/safe-fetch", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/imoveis/integracoes/safe-fetch")>();
  return {
    ...real,
    safeFetch: vi.fn(async (url: string) => {
      real.validateFeedUrl(url);
      if (feed.fail) throw feed.fail;
      return { status: 200, contentType: "application/xml", body: Buffer.from(feed.body), url };
    }),
  };
});

const repo = await import("@/lib/imoveis/repository");
const integ = await import("@/lib/imoveis/integracoes/repository");
const sync = await import("@/lib/imoveis/integracoes/sync");
const api = await import("@/app/api/imoveis/integracoes/[[...path]]/route");
const { SafeFetchError } = await import("@/lib/imoveis/integracoes/safe-fetch");

const modelos = join(process.cwd(), "public", "imoveis", "modelos");
const vrsync = readFileSync(join(modelos, "EXEMPLO_IMPORTACAO_IMOVEIS.xml"), "utf8");

beforeAll(async () => {
  process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  db = await createTestDb();
  sql = Object.assign(db.sql, {
    query: async (text: string, args: unknown[]) => (await db.pg.query<Record<string, unknown>>(text, args)).rows,
  });
}, 30000);
beforeEach(async () => {
  await db.pg.exec(
    "truncate property_duplicate_candidates,property_integration_errors,property_import_items,property_import_batches,property_external_listings,property_field_mappings,property_partner_sources,property_partners,property_images,property_history,property_reports,property_favorites,properties,property_advertisers,property_rate_limits,users cascade",
  );
  const rows = await db.sql`insert into users(email) values('owner@example.com'),('admin@example.com') returning id`;
  owner = rows[0].id as string;
  admin = rows[1].id as string;
  session.user.id = owner;
  adminSession.value = { userId: admin, email: "admin@example.com" };
  feed.body = vrsync;
  feed.fail = null;
});
afterAll(async () => {
  await db?.close();
});

function partnerInput(extra: Record<string, unknown> = {}) {
  return {
    name: "Imobiliária Exemplo",
    tradeName: "Exemplo Imóveis",
    partnerType: "Imobiliária",
    creci: "SP 12345-J",
    whatsapp: "12999990000",
    city: "São José dos Campos",
    state: "SP",
    allowedImageHosts: "parceiro.example",
    authorization: { authorizedBy: "Diretor Comercial", authorizedAt: "2026-11-01", scope: "Carteira completa em SJC" },
    ...extra,
  };
}
async function newPartner(extra: Record<string, unknown> = {}) {
  const id = await integ.savePartner(partnerInput(extra));
  const [source] = await db.sql`select id from property_partner_sources where partner_id=${id}`;
  return { id, source: source.id as string };
}
function row(code: string, extra: Partial<Record<(typeof TEMPLATE_COLUMNS)[number], string>> = {}) {
  return { ...TEMPLATE_EXAMPLE, CodigoImovel: code, Titulo: `Casa ${code} com 3 dormitórios no Urbanova`, Fotos: `https://parceiro.example/imagens/${code}-1.jpg`, ...extra };
}
async function runUpload(source: string, records: Record<string, string>[], opts: { complete?: boolean; publish?: boolean } = {}) {
  const batch = await integ.createBatch({ sourceId: source, fileName: "carteira.csv", completeFeed: opts.complete, actor: admin });
  await integ.stageRecords(batch, records, "CodigoImovel");
  await integ.closeStaging(batch, [...TEMPLATE_COLUMNS]);
  const [m] = await db.sql`select id from property_field_mappings where source_id=${source} order by version desc limit 1`;
  const mapping = m ? (m.id as string) : (await integ.saveMapping(source, { mapping: TEMPLATE_MAPPING }, admin)).id;
  await integ.resetValidation(batch, mapping);
  while (!(await integ.validateStep(batch)).done);
  const preview = await integ.batchDetail(batch);
  if (Number(preview.batch.valid)) {
    await integ.startImport(batch, admin, opts.publish ?? true);
    while (!(await integ.importStep(batch, 20000)).done);
  }
  return { batch, preview, detail: await integ.batchDetail(batch) };
}
async function directListing() {
  const photo = randomUUID();
  await db.sql`insert into property_images(id,user_id,url,thumbnail,bytes) values(${photo},${owner},${`https://blob.example/${photo}.webp`},'https://blob.example/t.webp',100)`;
  const id = await repo.saveProperty(owner, {
    ...EMPTY_PROPERTY,
    title: "Casa direta do proprietário no Urbanova",
    description: "Casa anunciada diretamente pelo proprietário, com quintal e garagem coberta.",
    city: "São José dos Campos",
    neighborhood: "Urbanova",
    area: 250,
    bedrooms: 3,
    parking: 2,
    price: 850000,
    advertiser: "Maria",
    phone: "11999999999",
    consent: true,
    submit: true,
    imageIds: [photo],
  });
  await repo.transition(admin, id, "published", true);
  const [p] = await db.sql`select * from properties where id=${id}`;
  return p;
}
const ext = async (code: string) => (await db.sql`select e.*,p.status,p.data,p.revision from property_external_listings e join properties p on p.id=e.property_id where e.external_code=${code}`)[0];
function request(path: string, data?: unknown, method = "POST", origin = "http://localhost:3000") {
  return new Request(`http://localhost:3000/api/imoveis/integracoes${path}`, {
    method,
    headers: { origin, "content-type": "application/json", "x-forwarded-for": "192.0.2.8" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}

describe("Integração de parceiros — importação real em Postgres isolado", () => {
  it("importa o CSV-modelo, publica junto dos anúncios diretos e direciona o contato ao parceiro", async () => {
    const direct = await directListing();
    const { id: partner, source } = await newPartner();
    const csv = parseCsv(new Uint8Array(readFileSync(join(modelos, "MODELO_IMPORTACAO_IMOVEIS.csv"))));
    const { preview, detail } = await runUpload(source, csv.records as Record<string, string>[], { publish: true });
    expect(preview.batch.summary).toMatchObject({ new: 2, valid: 2, invalid: 0 });
    expect(detail.batch).toMatchObject({ status: "completed", created: 2 });
    const search = await repo.searchProperties(new URLSearchParams({ city: "São José dos Campos" }));
    expect(search.total).toBe(3);
    const imported = await ext("ABC123");
    expect(imported.status).toBe("published");
    const page = await repo.publicProperty(String((await db.sql`select slug from properties where id=${imported.property_id}`)[0].slug));
    expect(page?.images[0].url).toBe("https://parceiro.example/imagens/ABC123-1.jpg");
    expect(page?.data.advertiser).toBe("Exemplo Imóveis");
    expect((await repo.activeContact(imported.property_id as string)).phone).toBe("5512999990000");
    expect(await integ.partnerListing(imported.property_id as string)).toMatchObject({ original_url: "https://parceiro.example/imovel/ABC123", seo_policy: "noindex" });
    // Sitemap: noindex do parceiro não entra; anúncio direto permanece.
    expect((await repo.sitemapEntries()).map((e) => e.slug)).toEqual([direct.slug]);
    const [p] = await db.sql`select approved_once from property_partners where id=${partner}`;
    expect(p.approved_once).toBe(true);
    // Dados brutos (inclui endereço privado) descartados após a importação.
    const [raw] = await db.sql`select count(*)::int as n from property_import_items where raw<>'{}'::jsonb`;
    expect(raw.n).toBe(0);
    // Anúncio direto intacto.
    const [after] = await db.sql`select status,revision,data from properties where id=${direct.id}`;
    expect(after).toMatchObject({ status: "published", revision: direct.revision });
  });

  it("simulação não grava anúncios e identifica inválidos, sem preço, sem foto e repetidos no arquivo", async () => {
    const { source } = await newPartner();
    const batch = await integ.createBatch({ sourceId: source, fileName: "x.csv", actor: admin });
    await integ.stageRecords(batch, [row("A1"), row("A1", { Valor: "900000" }), row("A2", { Valor: "" }), row("A3", { Fotos: "http://inseguro.example/x.jpg" }), row("", {})], "CodigoImovel");
    await integ.closeStaging(batch, [...TEMPLATE_COLUMNS]);
    const m = await integ.saveMapping(source, { mapping: TEMPLATE_MAPPING }, admin);
    await integ.resetValidation(batch, m.id);
    while (!(await integ.validateStep(batch)).done);
    const d = await integ.batchDetail(batch);
    expect(d.batch.summary).toMatchObject({ valid: 2, invalid: 3, new: 2, duplicate_in_file: 1, no_price: 1, blocked: 1 });
    const [count] = await db.sql`select count(*)::int as n from properties`;
    expect(count.n).toBe(0);
    const report = await integ.errorReport(batch);
    expect(report.length).toBeGreaterThan(3);
    await integ.cancelBatch(batch);
    await expect(integ.startImport(batch, admin, true)).rejects.toThrow();
  });

  it("é idempotente, atualiza preço e disponibilidade sem criar outro anúncio", async () => {
    const { source } = await newPartner();
    await runUpload(source, [row("C1"), row("C2")]);
    const again = await runUpload(source, [row("C1"), row("C2")]);
    expect(again.detail.batch).toMatchObject({ created: 0, unchanged: 2 });
    const before = await ext("C1");
    const changed = await runUpload(source, [row("C1", { Valor: "799000" }), row("C2", { Status: "Vendido" })]);
    expect(changed.detail.batch).toMatchObject({ created: 0, updated: 2 });
    const c1 = await ext("C1");
    expect(c1.property_id).toBe(before.property_id);
    expect((c1.data as { price: number }).price).toBe(799000);
    expect(Number(c1.revision)).toBe(Number(before.revision) + 1);
    expect((await ext("C2")).status).toBe("sold");
    const [n] = await db.sql`select count(*)::int as n from properties`;
    expect(n.n).toBe(2);
    const history = await db.sql`select action from property_history where property_id=${c1.property_id} order by id`;
    expect(history.map((h) => h.action)).toEqual(["partner-import", "partner-sync"]);
  });

  it("isola parceiros: o mesmo código em outro parceiro é outro anúncio e marca possível duplicidade sem excluir", async () => {
    const a = await newPartner();
    const b = await newPartner({ name: "Corretor B", tradeName: "", partnerType: "Corretor", creci: "SP 999-F" });
    await runUpload(a.source, [row("SAME")]);
    await runUpload(b.source, [row("SAME")]);
    const listings = await db.sql`select e.partner_id,p.status from property_external_listings e join properties p on p.id=e.property_id where e.external_code='SAME'`;
    expect(listings).toHaveLength(2);
    expect(listings.every((l) => l.status === "published")).toBe(true);
    const dups = await integ.listDuplicates();
    expect(dups).toHaveLength(1);
    expect(dups[0].signals).toEqual(expect.arrayContaining(["foto idêntica"]));
    await integ.resolveDuplicate(Number(dups[0].id), "confirmed", admin);
    const [n] = await db.sql`select count(*)::int as n from properties where status='published'`;
    expect(n.n).toBe(2);
  });

  it("não marca duplicidade apenas por preço, área e bairro parecidos", async () => {
    const a = await newPartner();
    const b = await newPartner({ name: "Outra", creci: "SP 1-J" });
    await runUpload(a.source, [row("P1", { Titulo: "Sobrado amplo perto do parque", Descricao: "Sobrado de esquina com edícula e quintal grande, reformado recentemente." })]);
    await runUpload(b.source, [row("Q9", { Titulo: "Residência térrea com piscina", Descricao: "Térrea com piscina aquecida, energia solar e jardim planejado nos fundos.", Fotos: "https://parceiro.example/imagens/outra.jpg" })]);
    expect(await integ.listDuplicates()).toHaveLength(0);
  });

  it("feed completo: ausência só pausa após a tolerância e nunca toca anúncios diretos", async () => {
    const direct = await directListing();
    const { source } = await newPartner();
    await db.sql`update property_partner_sources set missing_tolerance=2 where id=${source}`;
    await runUpload(source, [row("F1"), row("F2")], { complete: true });
    await runUpload(source, [row("F1")], { complete: true });
    expect(await ext("F2")).toMatchObject({ status: "published", sync_status: "missing", missing_count: 1 });
    const third = await runUpload(source, [row("F1")], { complete: true });
    expect(third.detail.batch.archived).toBe(1);
    expect(await ext("F2")).toMatchObject({ status: "paused", sync_status: "archived" });
    // Reaparece: volta a ser publicado.
    await runUpload(source, [row("F1"), row("F2")], { complete: true });
    expect(await ext("F2")).toMatchObject({ status: "published", sync_status: "active" });
    const [d] = await db.sql`select status from properties where id=${direct.id}`;
    expect(d.status).toBe("published");
  });

  it("feed completo com queda brusca ou item inválido não arquiva os imóveis presentes", async () => {
    const { source } = await newPartner();
    await db.sql`update property_partner_sources set missing_tolerance=1 where id=${source}`;
    const many = Array.from({ length: 12 }, (_, i) => row(`G${i}`));
    await runUpload(source, many, { complete: true });
    const shrink = await runUpload(source, many.slice(0, 3), { complete: true });
    expect(shrink.detail.batch.archived).toBe(0);
    expect((shrink.detail.batch.summary as { notes: string[] }).notes[0]).toMatch(/queda acima de 50%/);
    // Um imóvel presente mas inválido nesta rodada não conta como ausente.
    const invalid = await runUpload(source, [...many.slice(0, 11), row("G11", { Valor: "" })], { complete: true });
    expect(invalid.detail.batch.archived).toBe(0);
    expect((await ext("G11")).status).toBe("published");
  });

  it("feed incremental respeita eventos explícitos e ignora ausências", async () => {
    const { id: partner } = await newPartner();
    const source = await integ.saveSource(partner, { name: "Incremental", kind: "upload", format: "csv", feedMode: "incremental" });
    await runUpload(source, [row("I1"), row("I2")], { complete: true });
    await runUpload(source, [row("I1", { Status: "Inativo" })], { complete: true });
    expect((await ext("I1")).status).toBe("paused");
    expect(await ext("I2")).toMatchObject({ status: "published", missing_count: 0 });
  });

  it("sincroniza VRSync por URL: exige mapeamento, não publica sozinho e falhas nunca removem imóveis", async () => {
    const { id: partner } = await newPartner();
    const source = await integ.saveSource(partner, { name: "Feed VRSync", kind: "url", format: "vrsync", url: "https://parceiro.example/feed.xml", frequencyHours: 6, headers: { Authorization: "Bearer segredo-123" } });
    const [stored] = await db.sql`select secret_headers from property_partner_sources where id=${source}`;
    expect(String(stored.secret_headers)).not.toContain("segredo");
    expect(JSON.stringify(await integ.listSources(partner))).not.toContain("segredo");
    const first = await sync.runSource(source);
    expect(first).toMatchObject({ needsMapping: true });
    const fields = parseXml(Buffer.from(vrsync)).fields;
    const { suggestMapping } = await import("@/lib/imoveis/integracoes/fields");
    await integ.saveMapping(source, { mapping: suggestMapping(fields) }, admin);
    const second = await sync.runSource(source);
    expect(second).toMatchObject({ done: true });
    // Parceiro nunca aprovado + publicação automática desligada: fica pendente na moderação existente.
    expect((await ext("ABC123")).status).toBe("pending");
    expect((await ext("APT-204")).data).toMatchObject({ purpose: "Aluguel", price: 3200 });
    await integ.bulkImported([(await ext("ABC123")).property_id], "publish", admin);
    expect((await ext("ABC123")).status).toBe("published");
    // Falhas: HTTP, feed vazio e XML malformado.
    for (const failure of [() => (feed.fail = new SafeFetchError("O servidor respondeu HTTP 500.", "http")), () => ((feed.fail = null), (feed.body = "<ListingDataFeed><Listings></Listings></ListingDataFeed>")), () => (feed.body = "<ListingDataFeed><Listings>")]) {
      failure();
      const r = await sync.runSource(source);
      expect(r).toMatchObject({ failed: true });
    }
    expect((await ext("ABC123")).status).toBe("published");
    const [s] = await db.sql`select consecutive_failures,last_status from property_partner_sources where id=${source}`;
    expect(s).toMatchObject({ consecutive_failures: 3, last_status: "falha" });
    const logs = await integ.listLogs();
    expect(logs.some((l) => l.code === "fetch-http")).toBe(true);
    expect(JSON.stringify(logs)).not.toContain("segredo");
  });

  it("cron executa fontes vencidas sem duplicar e retoma lotes interrompidos", async () => {
    const { id: partner } = await newPartner();
    const source = await integ.saveSource(partner, { name: "Feed", kind: "url", format: "vrsync", url: "https://parceiro.example/feed.xml", frequencyHours: 12 });
    const { suggestMapping } = await import("@/lib/imoveis/integracoes/fields");
    await integ.saveMapping(source, { mapping: suggestMapping(parseXml(Buffer.from(vrsync)).fields) }, admin);
    const report = await sync.runIntegrationCron(40000);
    expect(report.synced).toBe(1);
    expect((await sync.runIntegrationCron(40000)).synced).toBe(0);
    const [n] = await db.sql`select count(*)::int as n from property_external_listings`;
    expect(n.n).toBe(2);
    const { source: up } = await newPartner({ name: "Outro parceiro", creci: "SP 2-J" });
    const batch = await integ.createBatch({ sourceId: up, actor: admin });
    await integ.stageRecords(batch, [row("R1"), row("R2")], "CodigoImovel");
    await integ.closeStaging(batch, [...TEMPLATE_COLUMNS]);
    const m = await integ.saveMapping(up, { mapping: TEMPLATE_MAPPING }, admin);
    await integ.resetValidation(batch, m.id);
    while (!(await integ.validateStep(batch)).done);
    await integ.startImport(batch, admin, true);
    // Navegador fechado: o cron conclui a importação.
    expect((await sync.runIntegrationCron(40000)).resumed).toBeGreaterThan(0);
    expect((await integ.batchDetail(batch)).batch.status).toBe("completed");
  });

  it("falha de gravação é registrada e pode ser reprocessada", async () => {
    const { id: partner, source } = await newPartner({ maxListings: 1 });
    const r = await runUpload(source, [row("L1"), row("L2")]);
    expect(r.detail.progress.failed).toBe(1);
    await integ.savePartner(partnerInput({ maxListings: 5 }), partner);
    await integ.reprocessFailed(r.batch);
    while (!(await integ.importStep(r.batch, 20000)).done);
    expect((await integ.batchDetail(r.batch)).progress).toMatchObject({ failed: 0, imported: 2 });
  });

  it("suspensão do parceiro oculta tudo imediatamente e é reversível", async () => {
    const { id: partner, source } = await newPartner();
    await runUpload(source, [row("S1")]);
    await integ.setPartnerStatus(partner, "suspended", "Pedido de remoção");
    expect((await repo.searchProperties(new URLSearchParams())).total).toBe(0);
    await expect(repo.activeContact((await ext("S1")).property_id as string)).rejects.toThrow();
    await expect(runUpload(source, [row("S2")])).rejects.toThrow(/inativo ou suspenso/);
    await integ.setPartnerStatus(partner, "active");
    expect((await repo.searchProperties(new URLSearchParams())).total).toBe(1);
  });

  it("respeita remoção administrativa: o feed não ressuscita anúncio removido ou rejeitado", async () => {
    const { source } = await newPartner();
    await runUpload(source, [row("X1"), row("X2")]);
    await repo.transition(admin, (await ext("X1")).property_id as string, "removed", true, "Solicitação do proprietário");
    await integ.bulkImported([(await ext("X2")).property_id], "reject", admin, "Conferência");
    await runUpload(source, [row("X1", { Valor: "1" }), row("X2", { Valor: "2" })]);
    const rows = await db.sql`select p.status from property_external_listings e join properties p on p.id=e.property_id order by e.external_code`;
    expect(rows.map((r) => r.status)).toEqual(["removed", "rejected"]);
  });

  it("conta cliques no anúncio original uma vez por visitante/dia e só para anúncio ativo", async () => {
    const { source } = await newPartner();
    await runUpload(source, [row("K1")]);
    const id = (await ext("K1")).property_id as string;
    expect(await integ.outboundUrl(id, "v1")).toBe("https://parceiro.example/imovel/ABC123");
    await integ.outboundUrl(id, "v1");
    await integ.outboundUrl(id, "v2");
    expect(Number((await ext("K1")).outbound_clicks)).toBe(2);
    const { GET } = await import("@/app/imoveis/saida/[id]/route");
    const res = await GET(new Request(`http://localhost:3000/imoveis/saida/${id}`), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://parceiro.example/imovel/ABC123");
    await db.sql`update properties set status='paused' where id=${id}`;
    expect(await integ.outboundUrl(id, "v3")).toBeNull();
  });

  it("página do imóvel importado usa noindex por padrão e preserva o SEO dos anúncios diretos", async () => {
    const direct = await directListing();
    const { id: partner, source } = await newPartner();
    await runUpload(source, [row("SEO1")]);
    const [p] = await db.sql`select slug from properties where id=${(await ext("SEO1")).property_id}`;
    const page = await import("@/app/imoveis/[slug]/page");
    const imported = await page.generateMetadata({ params: Promise.resolve({ slug: String(p.slug) }) });
    expect(imported.robots).toMatchObject({ index: false, follow: true });
    const own = await page.generateMetadata({ params: Promise.resolve({ slug: String(direct.slug) }) });
    expect(own.robots).toBeUndefined();
    await integ.savePartner(partnerInput({ seoPolicy: "index" }), partner);
    expect((await page.generateMetadata({ params: Promise.resolve({ slug: String(p.slug) }) })).robots).toBeUndefined();
    expect((await repo.sitemapEntries()).length).toBe(2);
  });

  it("cadastro de parceiro valida autorização, CRECI, URLs e política de imagens", async () => {
    await expect(integ.savePartner(partnerInput({ authorization: {} }))).rejects.toThrow(/quem autorizou/);
    await expect(integ.savePartner(partnerInput({ creci: "123" }))).rejects.toThrow(/CRECI/);
    await expect(integ.savePartner(partnerInput({ website: "javascript:alert(1)" }))).rejects.toThrow(/URL inválida/);
    await expect(integ.savePartner(partnerInput({ imagePolicy: "copy" }))).rejects.toThrow(/autorização expressa/);
    await expect(integ.saveSource(randomUUID(), { name: "x", kind: "url", format: "json", url: "https://169.254.169.254/latest" })).rejects.toThrow(/interno/);
    const { id } = await newPartner({ document: "12.345.678/0001-90" });
    const [p] = await db.sql`select private_data,user_id from property_partners where id=${id}`;
    expect(String(p.private_data)).not.toContain("12345678000190");
    const [u] = await db.sql`select email from users where id=${p.user_id}`;
    expect(String(u.email)).toMatch(/@parceiros\.alilu\.invalid$/);
  });

  it("API administrativa exige administrador e origem válida", async () => {
    adminSession.value = null;
    expect((await api.GET(request("/painel", undefined, "GET"))).status).toBe(403);
    expect((await api.POST(request("/parceiros", partnerInput()))).status).toBe(403);
    adminSession.value = { userId: admin, email: "admin@example.com" };
    expect((await api.POST(request("/parceiros", partnerInput(), "POST", "https://evil.example"))).status).toBe(403);
    const created = await api.POST(request("/parceiros", partnerInput()));
    expect(created.status).toBe(201);
    const painel = await (await api.GET(request("/painel", undefined, "GET"))).json();
    expect(painel.partners).toHaveLength(1);
    expect(painel.dashboard.counts.partners).toBe(1);
    expect((await api.POST(request("/importados/lote", { ids: [randomUUID()], action: "publish" }))).status).toBe(400);
  });

  it("ações em lote nunca alcançam anúncios diretos", async () => {
    const direct = await directListing();
    const r = await integ.bulkImported([direct.id], "reject", admin, "teste");
    expect(r.ok).toBe(0);
    const [d] = await db.sql`select status from properties where id=${direct.id}`;
    expect(d.status).toBe("published");
  });

  it("processa um lote médio sintético (600 imóveis) em partes, com checkpoints", async () => {
    const { source } = await newPartner({ maxListings: 5000 });
    const records = Array.from({ length: 600 }, (_, i) => row(`M${i}`, { Bairro: ["Urbanova", "Centro", "Aquarius"][i % 3], AreaTotal: String(80 + i) }));
    const batch = await integ.createBatch({ sourceId: source, actor: admin });
    for (let i = 0; i < records.length; i += 250) await integ.stageRecords(batch, records.slice(i, i + 250), "CodigoImovel");
    await integ.closeStaging(batch, [...TEMPLATE_COLUMNS]);
    const m = await integ.saveMapping(source, { mapping: TEMPLATE_MAPPING }, admin);
    await integ.resetValidation(batch, m.id);
    let steps = 0;
    while (!(await integ.validateStep(batch, 200)).done) steps++;
    expect(steps).toBeGreaterThanOrEqual(2);
    await integ.startImport(batch, admin, true);
    let importSteps = 0;
    while (!(await integ.importStep(batch, 1500)).done) importSteps++;
    expect(importSteps).toBeGreaterThan(0);
    const d = await integ.batchDetail(batch);
    expect(d.batch.created).toBe(600);
    expect((await repo.searchProperties(new URLSearchParams({ neighborhood: "Centro" }))).total).toBe(200);
  }, 120000);
});
