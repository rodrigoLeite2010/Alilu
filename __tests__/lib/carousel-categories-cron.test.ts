// Carrossel Inteligente por categorias: cron → planejador → diretiva → IA (falsa) → fotos → publicação, em Postgres real (PGlite).
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

async function setup(options: { plan?: boolean; requireApproval?: boolean; prompt?: string; category?: "FINANCEIRO" | "DIVULGACAO" | "UTILIDADES" | null } = {}) {
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
type Provider = { id: string; search: (query: string, options?: { limit?: number }) => Promise<StockPhoto[]> };
function runWith(llm: FakeLlm, now: Date, provider: Provider | null) {
  return cron.runContentAutomationCron({ now: () => now, smartCarouselDeps: { llm, photos: provider, renderSlide, now } });
}
async function slidesOf(projectId: string) {
  return db.sql`select * from carousel_slides where project_id = ${projectId} order by position`;
}


const BASE_PROMPT = "Crie carrosséis para a Alilu com a autoridade visual e narrativa de uma marca reconhecida. Alterne temas de psicologia, dinheiro, motivação, comportamento, família e curiosidades surpreendentes. Termine com reflexão impactante e convite elegante para acompanhar a Alilu.";
const { CAROUSEL_CATEGORIES } = await import("@/lib/content-automation/smart-carousel/categories");
const { findCreatorBias } = await import("@/lib/carousel/editorial/theme-bias");

const DAYS = [
  "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07",
].map((d) => new Date(`${d}T10:00:00.000Z`));

function varied(total = 60) {
  let n = 0;
  return { id: "stock", search: vi.fn(async (query: string) => { void query; return Array.from({ length: 12 }, () => photo(++n % total || total)); }) };
}
async function projects(id: string) {
  return db.sql`select * from carousel_projects where automation_id = ${id} order by created_at`;
}
interface Meta {
  categoryId: string;
  category: string;
  directive: string;
  diagnostic: string;
  provider: string;
  imageIds: string[];
}
const metaOf = (row: Record<string, unknown>) => (typeof row.generation_meta === "string" ? JSON.parse(row.generation_meta) : row.generation_meta) as Meta;

describe("Carrossel por categorias no cron", () => {
  it("8 execuções seguidas: categoria e tema mudam, nenhuma repete nas últimas 3, e o tema NÃO é o texto do prompt", async () => {
    const { seed, id } = await setup({ prompt: BASE_PROMPT, category: "UTILIDADES" /* legada: ignorada no modo AUTO */ });
    await service.activateAutomation(id, seed.userId);
    const llm = new FakeLlm();
    const stock = varied();
    for (const day of DAYS) await runWith(llm, day, stock);
    const rows = await projects(id);
    expect(rows).toHaveLength(8);
    const cats = rows.map((r) => metaOf(r).categoryId as string);
    const topics = rows.map((r) => r.topic as string);
    expect(cats.every(Boolean)).toBe(true);
    cats.forEach((cat, i) => expect(cats.slice(Math.max(0, i - 3), i)).not.toContain(cat));
    expect(new Set(topics).size).toBe(8);
    const bank = CAROUSEL_CATEGORIES.flatMap((c) => c.themes);
    for (const topic of topics) {
      expect(bank).toContain(topic);
      expect(topic).not.toContain("Crie carrosséis");
    }
    expect(cats.filter((c) => c === "CRIACAO_CONTEUDO").length).toBeLessThanOrEqual(1);
    // fora da categoria de conteúdo, o niche do projeto é a categoria (não "ferramentas para criadores")
    expect(rows.every((r) => CAROUSEL_CATEGORIES.some((c) => c.label === r.niche))).toBe(true);
  });

  it("o prompt REAL enviado à IA: diretiva completa em pesquisa, ganchos, roteiro e legenda; sistema neutro", async () => {
    const { seed, id } = await setup({ prompt: BASE_PROMPT });
    await service.activateAutomation(id, seed.userId);
    const llm = new FakeLlm();
    await runWith(llm, DAYS[0], varied());
    const [row] = await projects(id);
    const meta = metaOf(row);
    const kinds = {
      research: llm.calls.find((c) => c.prompt.includes('"facts"'))!,
      hooks: llm.calls.find((c) => c.prompt.includes('"hooks"'))!,
      script: llm.calls.find((c) => /EXATAMENTE/.test(c.prompt))!,
      caption: llm.calls.find((c) => c.prompt.includes('"caption"'))!,
    };
    for (const [name, call] of Object.entries(kinds)) {
      expect(call, name).toBeTruthy();
      expect(call.prompt, name).toContain("convite elegante para acompanhar a Alilu.");
      expect(call.prompt, name).toContain(`CATEGORIA ESCOLHIDA: ${meta.category}`);
      expect(call.prompt, name).toContain(`TEMA DESTE CARROSSEL: ${row.topic}`);
      expect(call.system, name).not.toMatch(/ferramentas para criadores/i);
    }
    expect(meta.directive).toContain(BASE_PROMPT);
    expect(meta.diagnostic).toContain(`CarouselGeneration / Category: ${meta.category} / Topic: ${row.topic}`);
    expect(meta.diagnostic).toContain("PromptSource: AutomationSettings / PromptOverride: false");
    expect(meta.provider).toBe("fake");
  });

  it("imagens: entre 3 e 5 fotos num carrossel, sem foto no último slide, com consulta própria por slide", async () => {
    const { seed, id } = await setup({ prompt: BASE_PROMPT });
    await service.updateSmartCarousel(id, seed.userId, { config: { slideCount: 9 } });
    await service.activateAutomation(id, seed.userId);
    const stock = varied();
    await runWith(new FakeLlm(), DAYS[0], stock);
    const [row] = await projects(id);
    const slides = await db.sql`select * from carousel_slides where project_id = ${row.id} order by position`;
    const styleOf = (s: Record<string, unknown>) => (typeof s.style === "string" ? JSON.parse(s.style) : s.style) as Record<string, unknown> & { photo?: { id?: string } };
    const withPhoto = slides.filter((s) => styleOf(s).photo?.id);
    expect(withPhoto.length).toBeGreaterThanOrEqual(3);
    expect(withPhoto.length).toBeLessThanOrEqual(5);
    expect(styleOf(slides[slides.length - 1]).photo?.id).toBeUndefined();
    expect(new Set(withPhoto.map((s) => styleOf(s).photo?.id)).size).toBe(withPhoto.length);
    expect(metaOf(row).imageIds).toHaveLength(withPhoto.length);
    // consulta por slide (a do roteiro), não o título
    const queries = stock.search.mock.calls.map((c) => c[0]);
    expect(queries.some((q) => /^budget \d$/.test(q))).toBe(true);
    expect(queries.every((q) => !q.startsWith("Passo"))).toBe(true);
  });

  it("viés: se a IA escrever sobre criação de conteúdo num tema de família, refaz uma vez com a correção", async () => {
    const { seed, id } = await setup({ prompt: BASE_PROMPT });
    await service.updateSmartCarousel(id, seed.userId, { config: { enabledCategories: ["FAMILIA"], categoryWeights: { FAMILIA: 10 } } });
    await service.activateAutomation(id, seed.userId);
    class BiasedOnce extends FakeLlm {
      scripts = 0;
      async complete(request: LlmRequest) {
        if (/EXATAMENTE/.test(request.prompt)) {
          this.scripts += 1;
          if (this.scripts === 1) {
            const n = Number(/EXATAMENTE (\d+) slides/.exec(request.prompt)?.[1] ?? 5);
            const slides = Array.from({ length: n }, (_, i) => ({ headline: `Ideia ${i + 1}`, body: "Organize seu roteiro e poste todo dia para ganhar seguidores", cta: "", visualKind: "GRAPHIC", imageQuery: null }));
            this.calls.push(request);
            return { text: JSON.stringify({ slides }), model: "fake", tokensInput: 1, tokensOutput: 1, webSearches: 0, citations: [] };
          }
        }
        return super.complete(request);
      }
    }
    const llm = new BiasedOnce();
    await runWith(llm, DAYS[0], varied());
    const scripts = llm.calls.filter((c) => /EXATAMENTE/.test(c.prompt));
    expect(scripts.length).toBeGreaterThanOrEqual(2);
    expect(scripts[1].prompt).toContain("NÃO é sobre criação de conteúdo");
    const [row] = await projects(id);
    const text = (await db.sql`select headline, body from carousel_slides where project_id = ${row.id}`).map((s) => `${s.headline} ${s.body}`).join(" ");
    expect(findCreatorBias(text)).toEqual([]);
  });

  it("legenda recebe categoria/tema (e a regenerada continua seguindo a diretiva guardada)", async () => {
    const { seed, id } = await setup({ prompt: BASE_PROMPT });
    await service.activateAutomation(id, seed.userId);
    const llm = new FakeLlm();
    await runWith(llm, DAYS[0], varied());
    const [row] = await projects(id);
    const caption = llm.calls.find((c) => c.prompt.includes('"caption"'))!;
    expect(caption.prompt).toContain(row.topic as string);
    const editorial = await import("@/lib/carousel/backend/carousel-editorial-service");
    llm.calls.length = 0;
    await editorial.regenerateCaption(seed.userId, row.id as string, { llm });
    expect(llm.calls[0].prompt).toContain(`TEMA DESTE CARROSSEL: ${row.topic}`);
  });

  it("modo PROMPT (antigo) continua disponível: o texto do prompt é o tema", async () => {
    const { seed, id } = await setup({ prompt: "Reserva de emergência para autônomos" });
    await service.updateSmartCarousel(id, seed.userId, { config: { topicSource: "PROMPT" } });
    await service.activateAutomation(id, seed.userId);
    const llm = new FakeLlm();
    await runWith(llm, DAYS[0], varied());
    const [row] = await projects(id);
    expect(row.topic).toBe("Reserva de emergência para autônomos");
    expect(llm.calls.some((c) => c.prompt.includes("CATEGORIA ESCOLHIDA"))).toBe(false);
  });

  it("preview (Gerar exemplo) usa o mesmo caminho e devolve categoria, tema e diagnóstico", async () => {
    const { seed, id } = await setup({ prompt: BASE_PROMPT });
    await service.activateAutomation(id, seed.userId);
    const result = await service.previewSmartCarousel(id, seed.userId, { llm: new FakeLlm(), photos: varied(), renderSlide, now: DAYS[0] });
    expect(result.category).toBeTruthy();
    expect(result.diagnostic).toContain(`Category: ${result.category}`);
    expect(result.topic).toBeTruthy();
  });

  it("cache de fotos: a mesma busca só vai ao provedor uma vez", async () => {
    const { cachedPhotoProvider } = await import("@/lib/carousel/photos/photo-cache");
    const base = { id: "stock", search: vi.fn(async () => Array.from({ length: 6 }, (_, i) => photo(i + 1))) };
    const cached = cachedPhotoProvider(base);
    const first = await cached.search("Father  Son walking!", { limit: 8 });
    const second = await cached.search("father son walking", { limit: 8 });
    expect(base.search).toHaveBeenCalledTimes(1);
    expect(second.map((p) => p.id)).toEqual(first.map((p) => p.id));
    expect(await cached.search("outra cena", { limit: 8 })).toHaveLength(6);
    expect(base.search).toHaveBeenCalledTimes(2);
  });
});
