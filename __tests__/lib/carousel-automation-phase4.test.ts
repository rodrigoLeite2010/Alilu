// Piloto Automático × Carrossel Inteligente (Fase 3): cron → CarouselGenerationService → publishCarousel.
// Postgres real em memória (PGlite); só IA, fotos e desenho dos slides são falsos.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedUserWithAccount, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({ getDb: () => db.sql, assertDatabaseConfigured: () => undefined }));
vi.mock("@/lib/content-automation/backend/provider-factory", () => ({
  getContentAIProvider: () => ({ generatePost: vi.fn(), generateReel: vi.fn(), rewriteText: vi.fn() }),
}));
vi.mock("@/lib/instagram/backend/template-render-service", () => ({
  renderAndStoreAutomationArt: vi.fn(),
  renderAndStoreAutomationCarousel: vi.fn(),
}));

const cron = await import("@/lib/content-automation/backend/content-automation-cron");
const service = await import("@/lib/content-automation/backend/automation-service");
const { DAYS_OF_WEEK } = await import("@/lib/content-automation/backend/automation-types");
type CarouselLlm = import("@/lib/carousel/backend/carousel-llm").CarouselLlm;
type LlmRequest = import("@/lib/carousel/backend/carousel-llm").LlmRequest;
type StockPhoto = import("@/lib/carousel/photos/photo-provider").StockPhoto;

// Quarta-feira 30/09/2026, 07:00 em São Paulo.
const NOW = new Date("2026-09-30T10:00:00.000Z");
const FUTURE = "2027-01-01T12:00:00Z";

class FakeLlm implements CarouselLlm {
  provider = "fake";
  calls: LlmRequest[] = [];
  constructor(public fail = false) {}
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
      json = { slides: Array.from({ length: n }, (_, i) => ({ headline: `Passo ${i + 1}`, body: `Explicação ${i + 1} do orçamento`, cta: i === n - 1 ? "Salve" : "", visualKind: "PHOTO", imageQuery: `budget ${i}` })) };
    }
    return { text: JSON.stringify(json), model: "fake", tokensInput: 1, tokensOutput: 1, webSearches: 0, citations: [] };
  }
}

const photo = (n: number): StockPhoto => ({ provider: "pixabay", id: `p${n}`, url: `https://pixabay.com/get/g${n}_1280.jpg`, thumbUrl: `https://pixabay.com/get/g${n}_640.jpg`, width: 800, height: 1200, author: "a", authorUrl: null, sourceUrl: null });
const photos = () => {
  let n = 0;
  return { id: "fake", search: vi.fn(async () => [photo(++n)]) };
};
let renderFails = false;
const renderSlide = vi.fn(async (uid: string, input: { position: number }) => {
  if (renderFails) throw new Error("canvas quebrou");
  const [row] = await db.sql`insert into instagram_media (user_id, storage_url, media_type, file_size_bytes) values (${uid}, ${`https://x.blob.vercel-storage.com/s${input.position}-${Math.random()}.jpg`}, 'image', 10) returning id`;
  return { mediaId: row.id as string, url: "u", warnings: [], photoMissing: false };
});

async function setup(options: { plan?: boolean; requireApproval?: boolean; prompt?: string; category?: "FINANCEIRO" | "DIVULGACAO" | null } = {}) {
  const seed = await seedUserWithAccount(db);
  await db.sql`update instagram_accounts set status = 'connected' where id = ${seed.accountId}`;
  if (options.plan !== false) {
    await db.sql`insert into carousel_subscriptions (user_id, plan_code, status, list_price_cents, price_cents, current_period_ends_at) values (${seed.userId}, 'STARTER', 'ACTIVE', 2990, 2990, ${FUTURE})`;
  }
  const id = await service.createAutomation({
    userId: seed.userId,
    instagramAccountId: seed.accountId,
    name: "Carrossel diário",
    timezone: "America/Sao_Paulo",
    generationLeadMinutes: 1440,
    imageMode: "FIXED_IMAGE",
    fixedImageMediaId: seed.mediaId,
    autoPublish: options.requireApproval === false,
    requireApproval: options.requireApproval ?? true,
    scheduleMode: "SHARED_PROMPT",
  });
  await service.updateSharedAutomation(id, seed.userId, {
    content: {
      contentType: "SMART_CAROUSEL",
      contentMode: "AI",
      prompt: options.prompt ?? "Educação financeira para iniciantes",
      ...(options.category === undefined ? {} : { contentCategory: options.category }),
    },
    schedule: { days: [...DAYS_OF_WEEK], times: ["08:00"] },
  });
  return { seed, id };
}


const sel = await import("@/lib/content-automation/smart-carousel/selection");

const DAY2 = new Date("2026-10-01T10:00:00.000Z");

beforeEach(async () => {
  db = await createTestDb();
  renderFails = false;
  renderSlide.mockClear();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(async () => {
  await db.close();
});

/** Fotos de um conjunto fixo (ids p1..pN), sempre na mesma ordem — força o conflito entre carrosséis. */
function fixedPhotos(total = 40) {
  return { id: "fixed", search: vi.fn(async () => Array.from({ length: total }, (_, i) => photo(i + 1))) };
}
function runWith(llm: FakeLlm, now: Date, provider: ReturnType<typeof fixedPhotos> | ReturnType<typeof photos> | null) {
  return cron.runContentAutomationCron({ now: () => now, smartCarouselDeps: { llm, photos: provider, renderSlide, now } });
}
async function slidesOf(projectId: string) {
  return db.sql`select * from carousel_slides where project_id = ${projectId} order by position`;
}

describe("seleção automática (pura)", () => {
  it("similaridade e repetição", () => {
    expect(sel.textSimilarity("Como montar um orçamento mensal", "Como montar um orçamento mensal!")).toBe(1);
    expect(sel.textSimilarity("Reserva de emergência", "Curiosidades sobre o Pix")).toBeLessThan(0.2);
    expect(sel.findRepeat("Orçamento mensal que funciona", ["Como montar um orçamento mensal que funciona"])).not.toBeNull();
    expect(sel.findRepeat("Outro assunto totalmente", ["Como montar um orçamento mensal que funciona"])).toBeNull();
  });
  it("tema: evita os recentes e, esgotado o banco, devolve o menos recente", () => {
    const pool = sel.THEME_POOLS.DIVULGACAO;
    const first = sel.pickTheme({ category: "DIVULGACAO", recentTopics: [], seed: "a" });
    expect(pool).toContain(first.topic);
    const second = sel.pickTheme({ category: "DIVULGACAO", recentTopics: [first.topic], seed: "a" });
    expect(second.topic).not.toBe(first.topic);
    const all = sel.pickTheme({ category: "DIVULGACAO", recentTopics: [...pool], seed: "a" });
    expect(all.exhausted).toBe(true);
    expect(all.topic).toBe(pool[pool.length - 1]);
    expect(() => sel.pickTheme({ category: "PERSONALIZADO", recentTopics: [], seed: "a" })).toThrow();
    expect(sel.pickTheme({ category: "PERSONALIZADO", recentTopics: [], seed: "a", niche: "Culinária" }).topic).toBe("Culinária");
  });
  it("template: preferência da categoria sem repetir os últimos", () => {
    const available = ["alilu-petroleo", "alilu-areia", "alilu-editorial", "alilu-noite"];
    expect(sel.pickTemplate({ category: "FINANCEIRO", recentTemplateIds: [], available })).toBe("alilu-petroleo");
    expect(sel.pickTemplate({ category: "FINANCEIRO", recentTemplateIds: ["alilu-petroleo"], available })).toBe("alilu-areia");
    expect(sel.pickTemplate({ category: "FINANCEIRO", recentTemplateIds: ["alilu-petroleo", "alilu-areia"], available })).toBe("alilu-editorial");
  });
});

describe("anti-repetição no cron", () => {
  it("tema automático pela categoria: não repete o tema, o template nem as fotos do carrossel anterior", async () => {
    const { seed, id } = await setup({ prompt: "", category: "FINANCEIRO" });
    await service.activateAutomation(id, seed.userId);
    const provider = fixedPhotos();
    const llm = new FakeLlm();
    await runWith(llm, NOW, provider);
    await runWith(llm, DAY2, provider);
    const projects = await db.sql`select * from carousel_projects where automation_id = ${id} order by created_at`;
    expect(projects).toHaveLength(2);
    // Modo AUTO (padrão): o plano sorteia categoria + tema do banco das categorias; a categoria legada do dia não manda.
    const bank = (await import("@/lib/content-automation/smart-carousel/categories")).CAROUSEL_CATEGORIES.flatMap((c) => c.themes);
    const catOf = (row: Record<string, unknown>) => ((typeof row.generation_meta === "string" ? JSON.parse(row.generation_meta) : row.generation_meta) as { categoryId: string }).categoryId;
    expect(bank).toContain(projects[0].topic);
    expect(bank).toContain(projects[1].topic);
    expect(projects[1].topic).not.toBe(projects[0].topic);
    expect(catOf(projects[1])).not.toBe(catOf(projects[0]));
    expect(projects[1].template_id).not.toBe(projects[0].template_id);
    const ids = async (p: Record<string, unknown>) => (await slidesOf(p.id as string)).map((s) => (typeof s.style === "string" ? JSON.parse(s.style) : s.style).photo?.id).filter(Boolean);
    const a = await ids(projects[0]);
    const b = await ids(projects[1]);
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    expect(b.filter((x: string) => a.includes(x))).toEqual([]);
  });

  it("gancho repetido: gera o texto de novo uma vez e segue sem travar", async () => {
    const { seed, id } = await setup({ requireApproval: true });
    await service.activateAutomation(id, seed.userId);
    const llm = new FakeLlm(); // sempre devolve os mesmos títulos
    await runWith(llm, NOW, photos());
    const first = llm.calls.filter((c) => /EXATAMENTE/.test(c.prompt)).length;
    await runWith(llm, DAY2, photos());
    const second = llm.calls.filter((c) => /EXATAMENTE/.test(c.prompt)).length - first;
    expect(first).toBe(1);
    expect(second).toBe(2); // 1ª tentativa + 1 nova (repetiu) — depois aceita
    const [{ n }] = await db.sql`select count(*)::int as n from carousel_projects where automation_id = ${id} and instagram_post_id is not null`;
    expect(n).toBe(2);
  });

  it("a janela é configurável: com janela 1 só o carrossel anterior conta", async () => {
    const { seed, id } = await setup({ prompt: "", category: "DIVULGACAO" });
    await service.updateSmartCarousel(id, seed.userId, { config: { antiRepeatWindow: 1 } });
    await service.activateAutomation(id, seed.userId);
    const provider = fixedPhotos();
    const llm = new FakeLlm();
    await runWith(llm, NOW, provider);
    await runWith(llm, DAY2, provider);
    const projects = await db.sql`select topic from carousel_projects where automation_id = ${id} order by created_at`;
    expect(projects[1].topic).not.toBe(projects[0].topic);
  });
});

describe("fonte de imagens", () => {
  async function ownMedia(userId: string, n: number): Promise<string[]> {
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const [row] = await db.sql`insert into instagram_media (user_id, storage_url, media_type, file_size_bytes) values (${userId}, ${`https://x.blob.vercel-storage.com/own${i}.jpg`}, 'image', 10) returning id`;
      out.push(row.id as string);
    }
    return out;
  }
  async function project(id: string) {
    const [p] = await db.sql`select * from carousel_projects where automation_id = ${id}`;
    return slidesOf(p.id as string);
  }

  it("OWN: usa só imagens próprias, sem chamar o banco de fotos", async () => {
    const { seed, id } = await setup();
    const media = await ownMedia(seed.userId, 3);
    await service.updateSmartCarousel(id, seed.userId, { config: { imageSource: "OWN", ownImageMediaIds: media, slideCount: 5 } });
    await service.activateAutomation(id, seed.userId);
    const provider = fixedPhotos();
    await runWith(new FakeLlm(), NOW, provider);
    const slides = await project(id);
    expect(slides.filter((s) => s.image_media_id).map((s) => s.image_media_id)).toEqual(media);
    expect(provider.search).not.toHaveBeenCalled();
  });

  it("COMBINED: próprias nos slides ímpares e banco nos demais", async () => {
    const { seed, id } = await setup();
    const media = await ownMedia(seed.userId, 5);
    await service.updateSmartCarousel(id, seed.userId, { config: { imageSource: "COMBINED", ownImageMediaIds: media, slideCount: 6 } });
    await service.activateAutomation(id, seed.userId);
    await runWith(new FakeLlm(), NOW, fixedPhotos());
    const slides = await project(id);
    for (const slide of slides) {
      if (Number(slide.position) % 2 === 1) expect(slide.image_media_id).toBeTruthy();
      else expect(slide.image_media_id).toBeNull();
    }
    // Nova regra: não força foto em todo slide — entre 3 e 5 imagens reais (próprias + banco) por carrossel.
    const withImage = slides.filter((s) => s.image_media_id || (typeof s.style === "string" ? JSON.parse(s.style) : s.style).photo?.id);
    expect(withImage.length).toBeGreaterThanOrEqual(3);
    expect(withImage.length).toBeLessThanOrEqual(5);
  });

  it("sem fotos no banco: o carrossel sai só com o modelo visual (nunca quebra)", async () => {
    const { seed, id } = await setup();
    await service.activateAutomation(id, seed.userId);
    const results = await runWith(new FakeLlm(), NOW, null);
    expect(results[0].status).toBe("WAITING_APPROVAL");
  });

  it("NONE: não chama o banco de fotos", async () => {
    const { seed, id } = await setup();
    await service.updateSmartCarousel(id, seed.userId, { config: { imageSource: "NONE" } });
    await service.activateAutomation(id, seed.userId);
    const provider = fixedPhotos();
    await runWith(new FakeLlm(), NOW, provider);
    expect(provider.search).not.toHaveBeenCalled();
  });

  it("valida OWN sem imagens e janela inválida", async () => {
    const { seed, id } = await setup();
    await expect(service.updateSmartCarousel(id, seed.userId, { config: { imageSource: "OWN", ownImageMediaIds: [] } })).rejects.toThrow(/imagem própria/);
    await expect(service.updateSmartCarousel(id, seed.userId, { config: { antiRepeatWindow: 0 } })).rejects.toThrow(/janela/);
  });
});
