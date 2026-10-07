// Carrossel Inteligente — CarouselGenerationService (pipeline único), com IA/fotos/render falsos (PGlite).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({ getDb: () => db.sql, assertDatabaseConfigured: () => undefined }));
let sessionUser: { id: string; email: string } | null = null;
vi.mock("@/auth", () => ({ auth: async () => (sessionUser ? { user: sessionUser } : null) }));

const gen = await import("@/lib/carousel/backend/carousel-generation-service");
const repo = await import("@/lib/carousel/backend/carousel-repository");
const actions = await import("@/lib/carousel/backend/carousel-actions");
type CarouselLlm = import("@/lib/carousel/backend/carousel-llm").CarouselLlm;
type LlmRequest = import("@/lib/carousel/backend/carousel-llm").LlmRequest;
type StockPhoto = import("@/lib/carousel/photos/photo-provider").StockPhoto;

const NOW = new Date("2026-10-07T12:00:00Z");
const FUTURE = "2026-11-07T12:00:00Z";

class FakeLlm implements CarouselLlm {
  provider = "fake";
  calls: LlmRequest[] = [];
  constructor(private readonly fail = false) {}
  async complete(request: LlmRequest) {
    this.calls.push(request);
    if (this.fail) throw new Error("IA fora do ar");
    const p = request.prompt;
    let json: unknown;
    if (p.includes('"facts"')) json = { summary: "Panorama", facts: [], sources: [], caution: null };
    else if (p.includes('"hooks"')) json = { hooks: [{ style: "ORIGINAL", headline: "O erro que drena seu orçamento" }, { style: "PROVOCATIVE", headline: "Você não controla seus gastos" }] };
    else if (p.includes('"caption"')) json = { caption: "Legenda forte.\n\nSalve.", hashtags: ["#Orcamento"] };
    else {
      const n = Number(/EXATAMENTE (\d+) slides/.exec(p)?.[1] ?? 5);
      json = { slides: Array.from({ length: n }, (_, i) => ({ headline: `Passo ${i + 1}`, body: `Explicação ${i + 1} do orçamento mensal`, cta: i === n - 1 ? "Salve" : "", visualKind: "PHOTO", imageQuery: `budget ${i}` })) };
    }
    return { text: JSON.stringify(json), model: "fake", tokensInput: 1, tokensOutput: 1, webSearches: 0, citations: [] };
  }
}

const photo = (n: number): StockPhoto => ({ provider: "pixabay", id: `p${n}`, url: `https://pixabay.com/get/g${n}_1280.jpg`, thumbUrl: `https://pixabay.com/get/g${n}_640.jpg`, width: 800, height: 1200, author: "a", authorUrl: null, sourceUrl: null });
const photos = (limit = 100) => {
  let n = 0;
  return { id: "fake", search: vi.fn(async () => (n < limit ? [photo(++n)] : [])) };
};
const renderSlide = vi.fn(async (uid: string, input: { position: number }) => {
  const [row] = await db.sql`insert into instagram_media (user_id, storage_url, media_type, file_size_bytes) values (${uid}, ${`https://x.blob.vercel-storage.com/s${input.position}-${Math.random()}.jpg`}, 'image', 10) returning id`;
  return { mediaId: row.id as string, url: "u", warnings: [], photoMissing: false };
});

async function user(email: string, plan = true): Promise<string> {
  const [row] = await db.sql`insert into users (email) values (${email}) returning id`;
  const id = row.id as string;
  if (plan) await db.sql`insert into carousel_subscriptions (user_id, plan_code, status, list_price_cents, price_cents, current_period_ends_at) values (${id}, 'STARTER', 'ACTIVE', 2990, 2990, ${FUTURE})`;
  await repo.saveCarouselBrand(id, { brandName: "Studio", handle: null, niche: "Educação financeira", audience: null, objective: null, tone: null, accentColor: null, secondaryColor: null, fontId: null, defaultTemplateId: null, logoUrl: null });
  return id;
}

beforeEach(async () => {
  db = await createTestDb();
  sessionUser = null;
  renderSlide.mockClear();
});
afterEach(async () => {
  await db.close();
});

describe("pipeline completo", () => {
  it("tema → texto → fotos → artes → legenda, sem consumir cota", async () => {
    const u = await user("a@x.com");
    const p = photos();
    const out = await gen.generateCarouselProject({ userId: u, topic: "Como montar um orçamento", slideCount: 6, templateMode: "FIXED", templateId: "alilu-areia" }, { llm: new FakeLlm(), photos: p, renderSlide, now: NOW });
    expect(out.stagesRun).toEqual(["TEXT", "IMAGES", "RENDER"]);
    expect(out.project).toMatchObject({ status: "READY", slideCount: 6, templateId: "alilu-areia" });
    expect(out.project.caption).toContain("Legenda forte");
    const slides = await repo.listSlides(out.project.id);
    expect(slides).toHaveLength(6);
    expect(slides.every((s) => s.renderedMediaId)).toBe(true);
    expect(slides.every((s) => (s.style.photo as { id?: string } | undefined)?.id)).toBe(true);
    expect(new Set(slides.map((s) => (s.style.photo as { id: string }).id)).size).toBe(6);
    expect(out.project.completedAt).toBeNull();
    expect(await db.sql`select 1 from plan_usage_cycles where user_id = ${u}`).toHaveLength(0);
  });

  it("etapas isoladas e idempotentes (para o cron dividir o trabalho)", async () => {
    const u = await user("b@x.com");
    const llm = new FakeLlm();
    const first = await gen.generateCarouselProject({ userId: u, topic: "Reserva de emergência", slideCount: 5, stages: ["TEXT"] }, { llm, now: NOW });
    expect(first.stagesRun).toEqual(["TEXT"]);
    expect(renderSlide).not.toHaveBeenCalled();
    const second = await gen.generateCarouselProject({ userId: u, projectId: first.project.id, stages: ["IMAGES", "RENDER"] }, { photos: photos(), renderSlide, now: NOW });
    expect(second.stagesRun).toEqual(["IMAGES", "RENDER"]);
    const calls = renderSlide.mock.calls.length;
    await gen.generateCarouselProject({ userId: u, projectId: first.project.id, stages: ["RENDER"] }, { renderSlide, now: NOW });
    expect(renderSlide.mock.calls.length).toBe(calls); // nada refeito
    expect(llm.calls.length).toBeGreaterThan(0);
  });

  it("falta de foto não quebra: slide sai só com o template", async () => {
    const u = await user("c@x.com");
    const out = await gen.generateCarouselProject({ userId: u, topic: "Cartão de crédito", slideCount: 5 }, { llm: new FakeLlm(), photos: photos(2), renderSlide, now: NOW });
    expect(out.images?.missing.length).toBe(3);
    expect(out.warnings.some((w) => w.includes("Sem foto"))).toBe(true);
    expect((await repo.listSlides(out.project.id)).every((s) => s.renderedMediaId)).toBe(true);
  });

  it("sem banco de fotos configurado ou com imageSource NONE, segue só com o template", async () => {
    const u = await user("d@x.com");
    const a = await gen.generateCarouselProject({ userId: u, topic: "Tema um", slideCount: 5 }, { llm: new FakeLlm(), photos: null, renderSlide, now: NOW });
    expect(a.warnings.some((w) => w.includes("não configurado"))).toBe(true);
    const p = photos();
    const b = await gen.generateCarouselProject({ userId: u, topic: "Tema dois", slideCount: 5, imageSource: "NONE" }, { llm: new FakeLlm(), photos: p, renderSlide, now: NOW });
    expect(p.search).not.toHaveBeenCalled();
    expect(b.project.status).toBe("READY");
  });

  it("falha de IA: projeto FAILED, nada renderizado", async () => {
    const u = await user("e@x.com");
    await expect(gen.generateCarouselProject({ userId: u, topic: "Tema" , slideCount: 5 }, { llm: new FakeLlm(true), photos: photos(), renderSlide, now: NOW })).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
    const [row] = await db.sql`select status from carousel_projects where user_id = ${u}`;
    expect(row.status).toBe("FAILED");
    expect(renderSlide).not.toHaveBeenCalled();
  });

  it("falha de render propaga (nada é publicado/cobrado)", async () => {
    const u = await user("f@x.com");
    const boom = vi.fn(async () => {
      throw new Error("canvas");
    });
    await expect(gen.generateCarouselProject({ userId: u, topic: "Tema", slideCount: 5 }, { llm: new FakeLlm(), photos: photos(), renderSlide: boom, now: NOW })).rejects.toThrow("canvas");
    expect(await db.sql`select 1 from plan_usage_cycles where user_id = ${u}`).toHaveLength(0);
  });

  it("legenda opcional, imagem final e lista de evitar chegam na IA", async () => {
    const u = await user("g@x.com");
    const llm = new FakeLlm();
    const out = await gen.generateCarouselProject(
      { userId: u, topic: "Financiamento", slideCount: 5, generateCaption: false, addFinalImage: false, prompt: "Tom prático", avoid: { topics: ["Reserva de emergência"], hooks: ["O erro que drena"] } },
      { llm, photos: photos(), renderSlide, now: NOW },
    );
    expect(out.project.caption).toBe("");
    expect(out.project.includeEndMedia).toBe(false);
    const script = llm.calls.find((c) => c.prompt.includes("EXATAMENTE"))!;
    expect(script.prompt).toContain("Reserva de emergência");
    expect(script.prompt).toContain("Tom prático");
    expect(llm.calls.some((c) => c.prompt.includes('"caption"'))).toBe(false);
  });

  it("exige tema, limita slides e respeita o dono", async () => {
    const u = await user("h@x.com");
    await expect(gen.generateCarouselProject({ userId: u }, {})).rejects.toMatchObject({ code: "INVALID" });
    const out = await gen.generateCarouselProject({ userId: u, topic: "Tema longo", slideCount: 99, stages: ["TEXT"] }, { llm: new FakeLlm(), now: NOW });
    expect((await repo.listSlides(out.project.id)).length).toBe(9);
    expect(out.project.slideCount).toBeLessThanOrEqual(10); // 9 quando a imagem final reserva 1 slide
    const other = await user("i@x.com");
    await expect(gen.generateCarouselProject({ userId: other, projectId: out.project.id }, {})).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("sem plano nem teste, não gera (cota do carrossel)", async () => {
    const u = await user("j@x.com", false);
    await db.sql`insert into carousel_trial_claims (user_id, email_key) values (${u}, 'j@x.com')`;
    await expect(gen.generateCarouselProject({ userId: u, topic: "Tema" }, { llm: new FakeLlm(), now: NOW })).rejects.toMatchObject({ code: "ACCESS_DENIED" });
  });
});

describe("tela manual e rota usam o mesmo serviço", () => {
  it("ação generate-all do projeto roda o pipeline completo", async () => {
    const u = await user("k@x.com");
    const p = await (await import("@/lib/carousel/backend/carousel-project-service")).createCarouselProject({ userId: u, topic: "Tema para tela", slideCount: 5, now: NOW });
    const res = await actions.runProjectAction(u, p.id, { action: "generate-all" }, { llm: new FakeLlm(), photos: photos(), renderSlide, now: NOW });
    expect(res.stagesRun).toEqual(["TEXT", "IMAGES", "RENDER"]);
    expect((await repo.getProject(u, p.id))?.status).toBe("READY");
  });
  it("ação generate (manual) roda só a etapa de texto", async () => {
    const u = await user("l@x.com");
    const p = await (await import("@/lib/carousel/backend/carousel-project-service")).createCarouselProject({ userId: u, topic: "Tema manual", slideCount: 5, now: NOW });
    await actions.runProjectAction(u, p.id, { action: "generate" }, { llm: new FakeLlm(), renderSlide, now: NOW });
    expect(renderSlide).not.toHaveBeenCalled();
    expect(await repo.listSlides(p.id)).toHaveLength(5);
  });
  it("rota /api/carousel/generate exige login", async () => {
    const route = await import("@/app/api/carousel/generate/route");
    const res = await route.POST(new Request("http://x", { method: "POST", body: JSON.stringify({ topic: "x" }) }));
    expect(res.status).toBe(401);
  });
});
