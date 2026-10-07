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

async function setup(options: { plan?: boolean; requireApproval?: boolean; prompt?: string; category?: "FINANCEIRO" | null } = {}) {
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

function run(llm: FakeLlm, now: Date = NOW) {
  return cron.runContentAutomationCron({ now: () => now, smartCarouselDeps: { llm, photos: photos(), renderSlide, now } });
}

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

describe("Carrossel Inteligente no Piloto Automático", () => {
  it("modo aprovação: gera tudo, vincula o projeto à execução e deixa em WAITING_APPROVAL", async () => {
    const { seed, id } = await setup();
    await service.activateAutomation(id, seed.userId);
    const results = await run(new FakeLlm());
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("WAITING_APPROVAL");

    const [project] = await db.sql`select * from carousel_projects where automation_id = ${id}`;
    expect(project).toMatchObject({ status: "READY", source_kind: "AUTOMATION", automation_run_id: results[0].runId });
    expect(project.completed_at).not.toBeNull();
    const [post] = await db.sql`select * from instagram_posts where id = ${project.instagram_post_id}`;
    expect(post).toMatchObject({ source: "AUTOMATION", status: "DRAFT" });
    const [runRow] = await db.sql`select * from automation_runs where id = ${results[0].runId}`;
    expect(runRow.status).toBe("WAITING_APPROVAL");
  });

  it("publicação automática: agenda o post (SCHEDULED) com source AUTOMATION", async () => {
    const { seed, id } = await setup({ requireApproval: false });
    await service.activateAutomation(id, seed.userId);
    const results = await run(new FakeLlm());
    expect(results[0].status).toBe("SCHEDULED");
    const [post] = await db.sql`select p.* from instagram_posts p join carousel_projects c on c.instagram_post_id = p.id where c.automation_id = ${id}`;
    expect(post).toMatchObject({ source: "AUTOMATION", status: "SCHEDULED" });
    expect(post.scheduled_at_utc).not.toBeNull();
  });

  it("idempotente: rodar o cron de novo não cria outro projeto nem outro post", async () => {
    const { seed, id } = await setup();
    await service.activateAutomation(id, seed.userId);
    const llm = new FakeLlm();
    await run(llm);
    const calls = llm.calls.length;
    const again = await run(llm);
    expect(again).toHaveLength(0);
    expect(llm.calls.length).toBe(calls);
    const [{ n }] = await db.sql`select count(*)::int as n from carousel_projects where automation_id = ${id}`;
    expect(n).toBe(1);
  });

  it("falha de render: nada é publicado nem cobrado; o retry reaproveita o projeto sem regenerar o texto", async () => {
    const { seed, id } = await setup();
    await service.activateAutomation(id, seed.userId);
    const llm = new FakeLlm();
    renderFails = true;
    const first = await run(llm);
    expect(first[0].error).toContain("canvas");
    expect(first[0].status).toBe("PENDING");
    const [p1] = await db.sql`select * from carousel_projects where automation_id = ${id}`;
    expect(p1.instagram_post_id).toBeNull();
    expect(p1.completed_at).toBeNull();
    const textCalls = llm.calls.length;

    renderFails = false;
    await db.sql`update automation_runs set next_attempt_at = null`;
    const second = await run(llm);
    expect(second[0].status).toBe("WAITING_APPROVAL");
    expect(llm.calls.length).toBe(textCalls); // texto não foi regenerado
    const projects = await db.sql`select * from carousel_projects where automation_id = ${id}`;
    expect(projects).toHaveLength(1);
    expect(projects[0].id).toBe(p1.id);
    expect(projects[0].instagram_post_id).not.toBeNull();
  });

  it("falha da IA: não publica nada incompleto e agenda nova tentativa", async () => {
    const { seed, id } = await setup();
    await service.activateAutomation(id, seed.userId);
    const results = await run(new FakeLlm(true));
    expect(results[0].status).toBe("PENDING");
    expect(results[0].error).toBeTruthy();
    const [{ n }] = await db.sql`select count(*)::int as n from instagram_posts where source = 'AUTOMATION'`;
    expect(n).toBe(0);
  });

  it("sem plano e sem carrossel grátis: bloqueia, não publica", async () => {
    const { seed, id } = await setup({ plan: false });
    await db.sql`insert into carousel_trial_claims (user_id, email_key) values (${seed.userId}, 'a@x.com')`;
    await service.activateAutomation(id, seed.userId);
    const results = await run(new FakeLlm());
    expect(results[0].error).toBeTruthy();
    const [{ n }] = await db.sql`select count(*)::int as n from instagram_posts where source = 'AUTOMATION'`;
    expect(n).toBe(0);
  });

  it("cobra só a cota do Carrossel: o uso do Piloto não é reservado", async () => {
    const { seed, id } = await setup();
    await service.activateAutomation(id, seed.userId);
    await run(new FakeLlm());
    const [{ n }] = await db.sql`select count(*)::int as n from generation_usage where user_id = ${seed.userId} and carousel_project_id is null`;
    expect(n).toBe(0);
  });
});

describe("ativação e configuração", () => {
  it("exige tema ou categoria; categoria sozinha basta", async () => {
    const { seed, id } = await setup({ prompt: "" });
    await expect(service.activateAutomation(id, seed.userId)).rejects.toThrow(/tema ou a categoria/);
    await service.updateSharedAutomation(id, seed.userId, { content: { contentCategory: "FINANCEIRO" } });
    await expect(service.activateAutomation(id, seed.userId)).resolves.toBeUndefined();
  });

  it("valida a configuração e mantém o que não veio", async () => {
    const { seed, id } = await setup();
    await expect(service.updateSmartCarousel(id, seed.userId, { config: { slideCount: 99 } })).rejects.toThrow(/slides/);
    await expect(service.updateSmartCarousel(id, seed.userId, { config: { templateMode: "FIXED" } })).rejects.toThrow(/template/i);
    const saved = await service.updateSmartCarousel(id, seed.userId, { config: { slideCount: 6, imageSource: "NONE" } });
    expect(saved).toMatchObject({ slideCount: 6, imageSource: "NONE", addFinalImage: true, templateMode: "AUTO" });
    const again = await service.updateSmartCarousel(id, seed.userId, { config: { addFinalImage: false } });
    expect(again).toMatchObject({ slideCount: 6, imageSource: "NONE", addFinalImage: false });
  });
});
