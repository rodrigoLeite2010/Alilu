// Carrossel Inteligente — Fase 2: assinatura própria, cota, teste grátis,
// desconto de cliente Alilu, limite de perfis e projeto/slides (PGlite).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({
  getDb: () => db.sql,
  assertDatabaseConfigured: () => undefined,
}));

const access = await import("@/lib/carousel/backend/carousel-access-service");
const projects = await import("@/lib/carousel/backend/carousel-project-service");
const repo = await import("@/lib/carousel/backend/carousel-repository");
const billing = await import("@/lib/carousel/backend/carousel-billing-repository");

const NOW = new Date("2026-10-07T12:00:00Z");
const FUTURE = "2026-11-07T12:00:00Z";
const PAST = "2026-09-01T12:00:00Z";

async function user(email: string): Promise<string> {
  const [row] = await db.sql`insert into users (email) values (${email}) returning id`;
  return row.id as string;
}
async function account(userId: string, n: string): Promise<string> {
  const [row] = await db.sql`
    insert into instagram_accounts (user_id, ig_user_id, ig_username, access_token_encrypted)
    values (${userId}, ${`ig-${n}-${userId}`}, ${`perfil${n}`}, 'x') returning id`;
  return row.id as string;
}
async function carouselSub(userId: string, over: { plan?: string; status?: string; end?: string | null; complimentary?: boolean } = {}) {
  const end = over.end === undefined ? FUTURE : over.end;
  await db.sql`
    insert into carousel_subscriptions (user_id, plan_code, status, list_price_cents, price_cents, current_period_ends_at, complimentary)
    values (${userId}, ${over.plan ?? "STARTER"}, ${over.status ?? "ACTIVE"}, 2990, 2990, ${end}, ${over.complimentary ?? false})`;
}
async function aliluSub(userId: string, over: { status?: string; end?: string | null; complimentary?: boolean } = {}) {
  const end = over.end === undefined ? FUTURE : over.end;
  await db.sql`
    insert into automation_subscriptions (user_id, status, plan_code, current_period_ends_at, complimentary)
    values (${userId}, ${over.status ?? "ACTIVE"}, 'CREATOR', ${end}, ${over.complimentary ?? false})`;
}
const SLIDES = (n: number) => Array.from({ length: n }, (_, i) => ({ headline: `Título ${i + 1}`, body: `Corpo ${i + 1}` }));

beforeEach(async () => {
  db = await createTestDb();
});
afterEach(async () => {
  await db.close();
  vi.clearAllMocks();
});

describe("acesso e cota", () => {
  it("sem assinatura: 1 carrossel grátis; depois, exige assinatura", async () => {
    const u = await user("ana@example.com");
    expect((await access.getCarouselAccess(u, NOW)).kind).toBe("TRIAL");
    const p = await projects.createCarouselProject({ userId: u, topic: "Organizar finanças", now: NOW });
    await projects.saveProjectSlides(u, p.id, SLIDES(10));
    const done = await projects.completeCarouselProject(u, p.id, NOW);
    expect(done.counted).toBe(true);
    const next = await access.getCarouselAccess(u, NOW);
    expect(next).toMatchObject({ kind: "NONE", allowed: false, code: "TRIAL_USED" });
    await expect(projects.createCarouselProject({ userId: u, topic: "Outro", now: NOW })).rejects.toMatchObject({ code: "ACCESS_DENIED" });
  });

  it("teste grátis não repete com outra conta de e-mail equivalente", async () => {
    const a = await user("joao.silva@gmail.com");
    const pa = await projects.createCarouselProject({ userId: a, topic: "T", now: NOW });
    await projects.saveProjectSlides(a, pa.id, SLIDES(5));
    await projects.completeCarouselProject(a, pa.id, NOW);
    const b = await user("joaosilva+x@gmail.com");
    expect((await access.getCarouselAccess(b, NOW)).kind).toBe("NONE");
  });

  it("plano ativo conta 1 por projeto; regenerar/concluir de novo NÃO conta outra vez", async () => {
    const u = await user("ana@example.com");
    await carouselSub(u);
    const p = await projects.createCarouselProject({ userId: u, topic: "T", now: NOW });
    await projects.saveProjectSlides(u, p.id, SLIDES(10));
    expect((await projects.completeCarouselProject(u, p.id, NOW)).counted).toBe(true);
    await projects.saveProjectSlides(u, p.id, SLIDES(8)); // regerou o projeto inteiro
    expect((await projects.completeCarouselProject(u, p.id, NOW)).counted).toBe(false);
    const a = await access.getCarouselAccess(u, NOW);
    expect(a).toMatchObject({ kind: "PLAN", used: 1, limit: 60 });
  });

  it("cota esgotada bloqueia (atomicamente) e falha/rascunho não cobram", async () => {
    const u = await user("ana@example.com");
    await carouselSub(u);
    const cycle = `carousel:${FUTURE.slice(0, 10)}`;
    await db.sql`insert into plan_usage_cycles (user_id, cycle_key, plan_code, used) values (${u}, ${cycle}, 'carousel:STARTER', 59)`;
    const p1 = await projects.createCarouselProject({ userId: u, topic: "Um", now: NOW });
    const p2 = await projects.createCarouselProject({ userId: u, topic: "Dois", now: NOW });
    await projects.saveProjectSlides(u, p1.id, SLIDES(5));
    await projects.saveProjectSlides(u, p2.id, SLIDES(5));
    await projects.failCarouselProject(u, p2.id, "IA indisponível"); // falha: nada cobrado
    expect(await access.getCarouselAccess(u, NOW)).toMatchObject({ used: 59, allowed: true });
    await projects.completeCarouselProject(u, p1.id, NOW);
    expect(await access.getCarouselAccess(u, NOW)).toMatchObject({ allowed: false, code: "QUOTA_EXCEEDED", used: 60 });
    const p3 = await repo.insertProject({ userId: u, instagramAccountId: null, topicId: null, title: "x", topic: "x", sourceKind: "TOPIC", sourceRef: null, niche: null, slideCount: 5, templateId: null, includeEndMedia: true, brandSnapshot: {} });
    await projects.saveProjectSlides(u, p3.id, SLIDES(5));
    await expect(projects.completeCarouselProject(u, p3.id, NOW)).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    expect((await repo.getProject(u, p3.id))?.completedAt).toBeNull();
  });

  it("estados da assinatura: pendente, atraso, cancelada no período, cancelada vencida, cortesia vencida", async () => {
    const check = async (opts: Parameters<typeof carouselSub>[1], expected: { kind: string; code?: string | null }) => {
      const u = await user(`u${Math.random().toString(36).slice(2)}@example.com`);
      await db.sql`insert into carousel_trial_claims (user_id, email_key, project_id) select ${u}, email, null from users where id = ${u}`;
      await carouselSub(u, opts);
      const a = await access.getCarouselAccess(u, NOW);
      expect(a.kind, JSON.stringify(opts)).toBe(expected.kind);
      if (expected.code !== undefined) expect(a.code).toBe(expected.code);
    };
    await check({ status: "PAST_DUE" }, { kind: "NONE", code: "PAYMENT_OVERDUE" });
    await check({ status: "PENDING_PAYMENT", end: null }, { kind: "NONE", code: "PAYMENT_PENDING" });
    await check({ status: "CANCELED" }, { kind: "PLAN" });
    await check({ status: "CANCELED", end: PAST }, { kind: "NONE", code: "SUBSCRIPTION_REQUIRED" });
    await check({ complimentary: true, end: PAST }, { kind: "NONE" });
    await check({ plan: "TURBO" }, { kind: "PLAN" });
  });

  it("projeto de outro usuário é invisível (isolamento)", async () => {
    const a = await user("a@example.com");
    const b = await user("b@example.com");
    const p = await projects.createCarouselProject({ userId: a, topic: "Meu", now: NOW });
    await expect(projects.requireProject(b, p.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(projects.saveProjectSlides(b, p.id, SLIDES(5))).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await repo.listProjects(b)).toHaveLength(0);
  });
});

describe("desconto de cliente Alilu (servidor)", () => {
  it("só com assinatura Alilu ativa, paga, não cortesia, não vencida", async () => {
    const quote = async (opts: Parameters<typeof aliluSub>[1] | null) => {
      const u = await user(`d${Math.random().toString(36).slice(2)}@example.com`);
      if (opts) await aliluSub(u, opts);
      return (await access.getCarouselQuote(u, "STARTER", NOW)).priceCents;
    };
    expect(await quote({})).toBe(2691);
    expect(await quote(null)).toBe(2990);
    expect(await quote({ status: "TRIAL", end: null })).toBe(2990);
    expect(await quote({ status: "CANCELED" })).toBe(2990);
    expect(await quote({ status: "PAST_DUE" })).toBe(2990);
    expect(await quote({ status: "PENDING_PAYMENT" })).toBe(2990);
    expect(await quote({ end: PAST })).toBe(2990);
    expect(await quote({ complimentary: true })).toBe(2990);
  });

  it("assinatura pendente guarda preço de tabela e preço com desconto; nunca rebaixa ACTIVE", async () => {
    const u = await user("ana@example.com");
    const price = await access.getCarouselQuote(u, "PRO", NOW);
    const sub = await billing.savePendingCarouselSubscription({ userId: u, planCode: "PRO", ...price });
    expect(sub).toMatchObject({ status: "PENDING_PAYMENT", listPriceCents: 4990, priceCents: 4990, discountPercent: 0 });
    await db.sql`update carousel_subscriptions set status = 'ACTIVE' where user_id = ${u}`;
    const again = await billing.savePendingCarouselSubscription({ userId: u, planCode: "TURBO", listPriceCents: 9990, priceCents: 9990, discountPercent: 0 });
    expect(again).toMatchObject({ status: "ACTIVE", planCode: "PRO" });
  });
});

describe("perfis, projeto e slides", () => {
  it("máximo de 2 perfis de Instagram com projetos; reutilizar um perfil já usado é livre", async () => {
    const u = await user("ana@example.com");
    await carouselSub(u);
    const [a1, a2, a3] = [await account(u, "1"), await account(u, "2"), await account(u, "3")];
    await projects.createCarouselProject({ userId: u, topic: "1", instagramAccountId: a1, now: NOW });
    await projects.createCarouselProject({ userId: u, topic: "2", instagramAccountId: a2, now: NOW });
    await projects.createCarouselProject({ userId: u, topic: "1b", instagramAccountId: a1, now: NOW });
    await expect(projects.createCarouselProject({ userId: u, topic: "3", instagramAccountId: a3, now: NOW })).rejects.toMatchObject({ code: "PROFILE_LIMIT" });
    const other = await user("b@example.com");
    await carouselSub(other);
    await expect(projects.createCarouselProject({ userId: other, topic: "x", instagramAccountId: a1, now: NOW })).rejects.toMatchObject({ code: "INVALID" });
  });

  it("slides: papéis por quantidade, textos nos limites, reduzir remove os excedentes", async () => {
    const u = await user("ana@example.com");
    await carouselSub(u);
    const p = await projects.createCarouselProject({ userId: u, topic: "T", now: NOW });
    const saved = await projects.saveProjectSlides(u, p.id, [{ headline: "h".repeat(200), body: "b ".repeat(200), cta: "c".repeat(90), visualKind: "PHOTO", imageQuery: "dinheiro" }, ...SLIDES(10).slice(1)]);
    expect(saved[0]).toMatchObject({ role: "HOOK", visualKind: "PHOTO", imageQuery: "dinheiro" });
    expect(saved[0].headline.length).toBeLessThanOrEqual(70);
    expect(saved[9].role).toBe("CTA");
    await projects.saveProjectSlides(u, p.id, SLIDES(6));
    const slides = await repo.listSlides(p.id);
    expect(slides.map((s) => s.position)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(slides[5].role).toBe("CTA");
    expect((await repo.getProject(u, p.id))?.slideCount).toBe(6);
    await expect(projects.saveProjectSlides(u, p.id, SLIDES(4))).rejects.toMatchObject({ code: "INVALID" });
    await expect(projects.saveProjectSlides(u, p.id, SLIDES(11))).rejects.toMatchObject({ code: "INVALID" });
  });

  it("concluir exige slides com título; status segue as transições; gancho escolhido é único", async () => {
    const u = await user("ana@example.com");
    await carouselSub(u);
    const p = await projects.createCarouselProject({ userId: u, topic: "T", now: NOW });
    await expect(projects.completeCarouselProject(u, p.id, NOW)).rejects.toMatchObject({ code: "INCOMPLETE" });
    await expect(projects.changeProjectStatus(u, p.id, "PUBLISHED")).rejects.toMatchObject({ code: "BAD_TRANSITION" });
    const h1 = await repo.insertHook(p.id, { style: "ORIGINAL", headline: "A" });
    const h2 = await repo.insertHook(p.id, { style: "PROVOCATIVE", headline: "B" });
    expect(await repo.chooseHook(u, p.id, h1.id)).toBe(true);
    expect(await repo.chooseHook(u, p.id, h2.id)).toBe(true);
    const hooks = await repo.listHooks(p.id);
    expect(hooks.filter((h) => h.chosen).map((h) => h.id)).toEqual([h2.id]);
    expect((await repo.getProject(u, p.id))?.chosenHookId).toBe(h2.id);
    const stranger = await user("x@example.com");
    expect(await repo.chooseHook(stranger, p.id, h1.id)).toBe(false);
  });

  it("pautas, fontes, marca e análise de perfil são gravadas por usuário", async () => {
    const u = await user("ana@example.com");
    await repo.insertTopic({ userId: u, weekKey: "2026-W41", niche: "finanças", title: "Reserva de emergência", summary: "s", engagementPotential: "HIGH" });
    expect(await repo.countTopicsForWeek(u, "2026-W41")).toBe(1);
    const [topic] = await repo.listTopics(u, "2026-W41");
    expect(await repo.setTopicStatus(u, topic.id, "DISMISSED")).toBe(true);
    expect(await repo.listTopics(u, "2026-W41")).toHaveLength(0);
    const p = await projects.createCarouselProject({ userId: u, topic: "T", now: NOW });
    await repo.insertSource({ projectId: p.id }, { kind: "WEB", title: "Fonte", url: "https://exemplo.com/a", publisher: "Exemplo" });
    expect(await repo.listSources(p.id)).toHaveLength(1);
    const brand = await repo.saveCarouselBrand(u, { brandName: "Ana", handle: "@ana", niche: "finanças", audience: null, objective: null, tone: "direto", accentColor: "#112233", secondaryColor: null, fontId: null, defaultTemplateId: "editorial", logoUrl: null });
    expect(brand.defaultTemplateId).toBe("editorial");
    const p2 = await projects.createCarouselProject({ userId: u, topic: "T2", now: NOW });
    expect(p2).toMatchObject({ templateId: "editorial", niche: "finanças" });
    expect(await repo.insertProfileAnalysis(u, "@concorrente", { themes: ["a"] })).toBeTruthy();
  });
});
