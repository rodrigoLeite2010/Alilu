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

// Aprovar/publicar não recebe dependências injetáveis: o desenho real dos slides é trocado pelo falso.
vi.mock("@/lib/carousel/render/carousel-render-service", () => ({
  renderAndStoreCarouselSlide: async (uid: string, input: { position: number }) => {
    const [row] = await db.sql`insert into instagram_media (user_id, storage_url, media_type, file_size_bytes) values (${uid}, ${`https://x.blob.vercel-storage.com/r${input.position}-${Math.random()}.jpg`}, 'image', 10) returning id`;
    return { mediaId: row.id as string, url: "u", warnings: [], photoMissing: false };
  },
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



const studio = await import("@/lib/carousel/backend/carousel-studio-service");

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

function runAt(llm: FakeLlm, now: Date) {
  return cron.runContentAutomationCron({ now: () => now, smartCarouselDeps: { llm, photos: photos(), renderSlide, now } });
}
async function generated(options: Parameters<typeof setup>[0] = {}) {
  const ctx = await setup(options);
  await service.activateAutomation(ctx.id, ctx.seed.userId);
  const llm = new FakeLlm();
  const [result] = await runAt(llm, NOW);
  const [project] = await db.sql`select * from carousel_projects where automation_run_id = ${result.runId}`;
  return { ...ctx, llm, runId: result.runId, project };
}

describe("aprovação do Carrossel Inteligente", () => {
  it("Editar + Aprovar: publica a versão editada, recria o post e aponta a execução para ele", async () => {
    const { seed, runId, project } = await generated();
    const oldPostId = project.instagram_post_id as string;
    await studio.editSlide(seed.userId, project.id as string, 1, { headline: "Título editado por mim" });
    await service.approveAutomationRun(runId, seed.userId);

    const [run] = await db.sql`select * from automation_runs where id = ${runId}`;
    expect(run.status).toBe("SCHEDULED");
    expect(run.publication_id).not.toBe(oldPostId);
    const [post] = await db.sql`select * from instagram_posts where id = ${run.publication_id}`;
    expect(post).toMatchObject({ status: "SCHEDULED", source: "AUTOMATION" });
    expect(await db.sql`select id from instagram_posts where id = ${oldPostId}`).toHaveLength(0);
    const [p] = await db.sql`select * from carousel_projects where id = ${project.id}`;
    expect(p.status).toBe("SCHEDULED");
    const [slide] = await db.sql`select headline from carousel_slides where project_id = ${project.id} and position = 1`;
    expect(slide.headline).toBe("Título editado por mim");
  });

  it("Cancelar: a execução vira CANCELLED e nada é publicado", async () => {
    const { seed, runId } = await generated();
    await service.rejectAutomationRun(runId, seed.userId);
    const [run] = await db.sql`select status from automation_runs where id = ${runId}`;
    expect(run.status).toBe("CANCELLED");
    const [{ n }] = await db.sql`select count(*)::int as n from instagram_posts where status in ('SCHEDULED','PUBLISHED','PROCESSING')`;
    expect(n).toBe(0);
  });

  it("Regenerar: cancela o rascunho, guarda o projeto antigo e o próximo ciclo gera outro conteúdo", async () => {
    const { seed, id, llm, runId, project } = await generated({ prompt: "", category: "FINANCEIRO" });
    await service.regenerateAutomationRun(runId, seed.userId);
    const [reset] = await db.sql`select * from automation_runs where id = ${runId}`;
    expect(reset).toMatchObject({ status: "PENDING", publication_id: null });
    const [old] = await db.sql`select * from carousel_projects where id = ${project.id}`;
    expect(old.automation_run_id).toBeNull();

    const results = await runAt(llm, NOW);
    expect(results[0].status).toBe("WAITING_APPROVAL");
    const projects = await db.sql`select * from carousel_projects where automation_id = ${id} order by created_at`;
    expect(projects).toHaveLength(2);
    expect(projects[1].automation_run_id).toBe(runId);
    expect(projects[1].topic).not.toBe(projects[0].topic); // o antigo continua na janela anti-repetição
  });

  it("Regenerar só vale para execução aguardando aprovação de um Carrossel Inteligente", async () => {
    const { seed, runId } = await generated();
    await service.rejectAutomationRun(runId, seed.userId);
    await expect(service.regenerateAutomationRun(runId, seed.userId)).rejects.toThrow(/aguardando aprovação/);
  });
});

describe("Gerar exemplo", () => {
  it("gera um carrossel completo, sem publicar, sem cota e sem entrar no histórico", async () => {
    const { seed, id } = await setup();
    await service.activateAutomation(id, seed.userId);
    const out = await service.previewSmartCarousel(id, seed.userId, { llm: new FakeLlm(), photos: photos(), renderSlide, now: NOW });
    const [project] = await db.sql`select * from carousel_projects where id = ${out.projectId}`;
    expect(project).toMatchObject({ status: "READY", source_kind: "AUTOMATION", automation_run_id: null, automation_id: null });
    expect(project.completed_at).toBeNull();
    expect(project.instagram_post_id).toBeNull();
    const [{ n }] = await db.sql`select count(*)::int as n from carousel_slides where project_id = ${out.projectId} and rendered_media_id is not null`;
    expect(n).toBeGreaterThan(4);
    expect(await db.sql`select id from instagram_posts`).toHaveLength(0);
    expect(await db.sql`select id from automation_runs`).toHaveLength(0);
  });

  it("exige um dia configurado como Carrossel Inteligente", async () => {
    const { seed, id } = await setup();
    await service.updateSharedAutomation(id, seed.userId, { content: { contentType: "POST" } });
    await expect(service.previewSmartCarousel(id, seed.userId)).rejects.toThrow(/Nenhum dia/);
  });
});

describe("falhas e histórico", () => {
  it("sem plano nem carrossel grátis: falha direto (sem tentar de novo) e não publica", async () => {
    const { seed, id } = await setup({ plan: false });
    await db.sql`insert into carousel_trial_claims (user_id, email_key) values (${seed.userId}, 'a@x.com')`;
    await service.activateAutomation(id, seed.userId);
    const [result] = await runAt(new FakeLlm(), NOW);
    expect(result.status).toBe("FAILED");
    expect(await db.sql`select id from instagram_posts where source = 'AUTOMATION'`).toHaveLength(0);
  });

  it("erro da IA continua com tentativas (backoff) e depois falha de vez", async () => {
    const { seed, id } = await setup();
    await service.activateAutomation(id, seed.userId);
    const llm = new FakeLlm(true);
    const statuses: string[] = [];
    for (let i = 0; i < 4; i++) {
      await db.sql`update automation_runs set next_attempt_at = null`;
      const [r] = await runAt(llm, NOW);
      statuses.push(r.status);
    }
    expect(statuses).toEqual(["PENDING", "PENDING", "PENDING", "FAILED"]);
  });

  it("o histórico traz o carrossel de cada execução (abrir/editar)", async () => {
    const { seed, id, project } = await generated();
    const history = await service.listAutomationHistoryDetailed(id, seed.userId);
    expect(history[0].carouselProjectId).toBe(project.id);
    expect(history[0].status).toBe("WAITING_APPROVAL");
  });

  it("DAY2: o dia seguinte cria uma nova execução com outro projeto", async () => {
    const { id, llm } = await generated({ prompt: "", category: "FINANCEIRO" });
    await runAt(llm, DAY2);
    expect(await db.sql`select id from carousel_projects where automation_id = ${id}`).toHaveLength(2);
  });
});
