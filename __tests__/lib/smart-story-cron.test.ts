// SmartStoryEngine — Fase 4: integração com o cron do Piloto Automático,
// contra um Postgres REAL em memória (PGlite, migrações de produção).
// Só o provedor de IA e o desenho/upload da arte são simulados — claim,
// idempotência, retry e histórico usam o SQL de verdade.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedUserWithAccount, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({
  getDb: () => db.sql,
  assertDatabaseConfigured: () => undefined,
}));

const fakeProvider = { generatePost: vi.fn(), generateReel: vi.fn(), rewriteText: vi.fn() };
vi.mock("@/lib/content-automation/backend/provider-factory", () => ({
  getContentAIProvider: () => fakeProvider,
}));

vi.mock("@/lib/instagram/backend/template-render-service", () => ({
  renderAndStoreAutomationArt: vi.fn(),
  renderAndStoreAutomationCarousel: vi.fn(),
}));

const fakeRenderSmart = vi.fn();
vi.mock("@/lib/content-automation/smart-story/render/render-service", () => ({
  renderAndStoreSmartStory: (...args: unknown[]) => fakeRenderSmart(...args),
}));

const cron = await import("@/lib/content-automation/backend/content-automation-cron");
const service = await import("@/lib/content-automation/backend/automation-service");
const repo = await import("@/lib/content-automation/backend/automation-repository");
const smartRepo = await import("@/lib/content-automation/backend/smart-story-repository");
const { DAYS_OF_WEEK } = await import("@/lib/content-automation/backend/automation-types");
const { STORY_TYPES } = await import("@/lib/content-automation/smart-story");

type Seed = Awaited<ReturnType<typeof seedUserWithAccount>>;

const MORNING = ["REFLECTION", "EMOTIONAL_QUESTION", "ADVICE", "MINI_STORY"];
const MIDDAY = ["VISUAL_POLL", "CHOICE_AB", "COMPLETE_SENTENCE", "CURIOSITY"];
const EVENING = ["CTA", "ALILU_BRAND", "REFLECTION", "CHECKLIST"];

// Quarta-feira 30/09/2026, 07:00 em São Paulo. Antecedência de 1440 min:
// todos os horários de hoje já estão na janela de geração.
const WEDNESDAY_MORNING = () => new Date("2026-09-30T10:00:00.000Z");

/** IA que respeita o tipo pedido no prompt e nunca repete título/CTA. */
function aiWorks() {
  let counter = 0;
  fakeProvider.rewriteText.mockImplementation(async ({ prompt }: { prompt: string }) => {
    counter += 1;
    const type = STORY_TYPES.find((candidate) => prompt.includes(`(${candidate})`)) ?? "REFLECTION";
    return {
      content: {
        type,
        headline: `Título único ${counter}`,
        body: type === "CHECKLIST" ? "um\ndois\ntrês" : "Corpo curto.",
        optionA: "Opção A",
        optionB: "Opção B",
        cta: `Responda no direct (${counter})`,
        visualMood: "emotional",
        topic: `assunto ${counter}`,
      },
      usage: { provider: "anthropic", model: "claude-test", tokensInput: 10, tokensOutput: 5 },
    };
  });
}

function renderCreatesMedia(userId: string) {
  let counter = 0;
  fakeRenderSmart.mockImplementation(async (input: { background: { id: string }; useMascot: boolean }) => {
    counter += 1;
    const [media] = await db.sql`
      insert into instagram_media (user_id, storage_url, media_type)
      values (${userId}, ${`https://blob.example.com/smart-${counter}.jpg`}, 'image') returning id
    `;
    return {
      mediaId: media.id as string,
      imageUrl: `https://blob.example.com/smart-${counter}.jpg`,
      templateId: "smart-reflection",
      backgroundId: input.background.id,
      mascotDrawn: input.useMascot,
      warnings: [],
    };
  });
}

interface SmartOptions {
  times?: string[];
  days?: string[];
  timezone?: string;
  requireApproval?: boolean;
  enableSmart?: boolean;
  contentMode?: "AI" | "MANUAL";
  smartConfig?: Record<string, unknown>;
  noImage?: boolean;
  imageMode?: "FIXED_IMAGE" | "MEDIA_LIBRARY" | "AUTO_TEMPLATE";
}

/** Automação no modo "Prompt único recorrente" (STORY) com o modo inteligente ligado. */
async function smartAutomation(seed: Seed, options: SmartOptions = {}) {
  const id = await service.createAutomation({
    userId: seed.userId,
    instagramAccountId: seed.accountId,
    name: "Stories inteligentes",
    timezone: options.timezone ?? "America/Sao_Paulo",
    generationLeadMinutes: 1440,
    imageMode: options.imageMode ?? "FIXED_IMAGE",
    fixedImageMediaId: options.noImage ? null : seed.mediaId,
    autoPublish: options.requireApproval === false,
    requireApproval: options.requireApproval ?? true,
    scheduleMode: "SHARED_PROMPT",
  });
  await service.updateSharedAutomation(id, seed.userId, {
    content: {
      contentType: "STORY",
      contentMode: options.contentMode ?? "AI",
      prompt: "Fale de gratidão e recomeços.",
      ...(options.contentMode === "MANUAL" ? { visualText: "Texto manual" } : {}),
    },
    schedule: { days: options.days ?? [...DAYS_OF_WEEK], times: options.times ?? ["08:00"] },
  });
  if (options.enableSmart !== false) {
    await service.updateSmartStory(id, seed.userId, { enabled: true, config: options.smartConfig });
  }
  await service.activateAutomation(id, seed.userId);
  return id;
}

async function stories() {
  return db.sql`select * from smart_story_generations order by scheduled_at`;
}

beforeEach(async () => {
  db = await createTestDb();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  await db.close();
  fakeProvider.generatePost.mockReset();
  fakeProvider.rewriteText.mockReset();
  fakeRenderSmart.mockReset();
  vi.restoreAllMocks();
});

describe("modo inteligente ligado", () => {
  it("gera o Story estruturado, renderiza e cria a publicação 'story' sem legenda", async () => {
    const seed = await seedUserWithAccount(db);
    aiWorks();
    renderCreatesMedia(seed.userId);
    await smartAutomation(seed);

    const results = await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("WAITING_APPROVAL");
    expect(fakeProvider.generatePost).not.toHaveBeenCalled();
    expect(fakeProvider.rewriteText).toHaveBeenCalledTimes(1);
    const prompt = fakeProvider.rewriteText.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("Fale de gratidão e recomeços.");
    expect(prompt).toContain("Quarta-feira");

    const posts = await db.sql`select id, post_type, caption, status from instagram_posts`;
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ post_type: "story", caption: "", status: "DRAFT" });

    const [story] = await stories();
    expect(MORNING).toContain(story.story_type);
    expect(story).toMatchObject({ status: "READY", source: "AI", instagram_post_id: posts[0].id, layout: "SINGLE" });
    expect(story.image_media_id).toBeTruthy();
    expect(story.background_id).toBeTruthy();
    expect(story.template_id).toBe("smart-reflection");
    // Registro de uso de IA (mesma tabela do Piloto Automático).
    expect(await db.sql`select id from generation_usage`).toHaveLength(1);
  });

  it("08:00 / 12:00 / 19:00 no mesmo dia seguem a estratégia do horário e não repetem tipo seguido", async () => {
    const seed = await seedUserWithAccount(db);
    aiWorks();
    renderCreatesMedia(seed.userId);
    await smartAutomation(seed, { times: ["08:00", "12:00", "19:00"] });

    const results = await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });
    expect(results).toHaveLength(3);

    const rows = await stories();
    expect(rows).toHaveLength(3);
    expect(MORNING).toContain(rows[0].story_type);
    expect(MIDDAY).toContain(rows[1].story_type);
    expect(EVENING).toContain(rows[2].story_type);
    expect(new Set(rows.map((row) => row.headline)).size).toBe(3);
    // Uma publicação por horário.
    expect(await db.sql`select id from instagram_posts`).toHaveLength(3);
  });

  it("vários dias seguidos: nunca repete o tipo do Story anterior nem o título", async () => {
    const seed = await seedUserWithAccount(db);
    aiWorks();
    renderCreatesMedia(seed.userId);
    await smartAutomation(seed, { times: ["08:00", "12:00", "19:00"] });

    for (let day = 0; day < 6; day += 1) {
      await cron.runContentAutomationCron({ now: () => new Date(Date.UTC(2026, 8, 30 + day, 10, 0, 0)) });
    }
    const rows = await stories();
    expect(rows).toHaveLength(18);
    for (let index = 1; index < rows.length; index += 1) {
      expect(rows[index].story_type).not.toBe(rows[index - 1].story_type);
    }
    expect(new Set(rows.map((row) => row.headline)).size).toBe(18);
    expect(new Set(rows.map((row) => row.cta)).size).toBe(18);
    // Fundos variam (nunca o mesmo em sequência imediata).
    for (let index = 1; index < rows.length; index += 1) {
      if (rows[index].background_id && rows[index - 1].background_id) {
        expect(rows[index].background_id).not.toBe(rows[index - 1].background_id);
      }
    }
  });

  it("modo automático agenda o Story para o horário e respeita o fuso (Tóquio)", async () => {
    const seed = await seedUserWithAccount(db);
    aiWorks();
    renderCreatesMedia(seed.userId);
    await smartAutomation(seed, { requireApproval: false, timezone: "Asia/Tokyo", times: ["08:00"] });

    // 30/09 10:00 UTC = 19:00 em Tóquio (quarta) — o horário 08:00 local já passou: gera mesmo assim.
    const results = await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });
    expect(results[0].status).toBe("SCHEDULED");
    const [post] = await db.sql`select status, scheduled_at_utc from instagram_posts`;
    expect(post.status).toBe("SCHEDULED");
    expect(new Date(post.scheduled_at_utc as string).toISOString()).toBe("2026-09-29T23:00:00.000Z");
    const [story] = await stories();
    expect(MORNING).toContain(story.story_type); // 08:00 LOCAL, não 23:00 UTC
    expect(new Date(story.scheduled_at as string).toISOString()).toBe("2026-09-29T23:00:00.000Z");
  });

  it("falha da IA → publica com o texto de fallback (a automação não aborta)", async () => {
    const seed = await seedUserWithAccount(db);
    fakeProvider.rewriteText.mockRejectedValue(new Error("O provedor de IA respondeu com erro (HTTP 529)."));
    renderCreatesMedia(seed.userId);
    await smartAutomation(seed);

    const results = await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });

    expect(results[0].status).toBe("WAITING_APPROVAL");
    expect(fakeProvider.rewriteText).toHaveBeenCalledTimes(2); // 1ª + 1 retry controlado
    const [story] = await stories();
    expect(story).toMatchObject({ source: "FALLBACK", attempts: 2 });
    expect(story.generation_error).toContain("HTTP 529");
    expect(story.headline).toBeTruthy();
    expect(await db.sql`select id from instagram_posts`).toHaveLength(1);
  });

  it("retorno inválido da IA → retry → aceita a segunda resposta", async () => {
    const seed = await seedUserWithAccount(db);
    aiWorks();
    const good = fakeProvider.rewriteText.getMockImplementation()!;
    fakeProvider.rewriteText.mockReset();
    fakeProvider.rewriteText
      .mockResolvedValueOnce({ content: { headline: "" }, usage: { provider: "anthropic", model: "t", tokensInput: 1, tokensOutput: 1 } })
      .mockImplementation(good);
    renderCreatesMedia(seed.userId);
    await smartAutomation(seed);

    await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });

    const [story] = await stories();
    expect(story).toMatchObject({ source: "AI", attempts: 2 });
    expect(fakeProvider.rewriteText.mock.calls[1][0].prompt).toContain("A tentativa anterior foi rejeitada");
  });

  it("falha de renderização → execução em retry; o retry reaproveita o MESMO Story (sem nova IA)", async () => {
    const seed = await seedUserWithAccount(db);
    aiWorks();
    renderCreatesMedia(seed.userId);
    const ok = fakeRenderSmart.getMockImplementation()!;
    fakeRenderSmart.mockReset();
    fakeRenderSmart.mockRejectedValueOnce(new Error("canvas indisponível")).mockImplementation(ok);
    await smartAutomation(seed);

    const first = await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });
    expect(first[0].status).toBe("PENDING"); // agendada para nova tentativa
    let [story] = await stories();
    expect(story.status).toBe("FAILED");
    expect(story.generation_error).toContain("canvas indisponível");
    expect(await db.sql`select id from instagram_posts`).toHaveLength(0);
    const storyId = story.id;
    const headline = story.headline;
    const usageAfterFailure = (await db.sql`select id from generation_usage`).length;

    // 6 minutos depois (o backoff é de 5): refaz o render do MESMO Story.
    const second = await cron.runContentAutomationCron({ now: () => new Date("2026-09-30T10:06:00.000Z") });
    expect(second[0].status).toBe("WAITING_APPROVAL");
    [story] = await stories();
    expect(story).toMatchObject({ id: storyId, headline, status: "READY" });
    expect(fakeProvider.rewriteText).toHaveBeenCalledTimes(1); // IA só na primeira vez
    expect((await db.sql`select id from generation_usage`).length).toBe(usageAfterFailure);
    expect(await db.sql`select id from instagram_posts`).toHaveLength(1);
    expect(await db.sql`select id from smart_story_generations`).toHaveLength(1);
  });

  it("cron duplicado no mesmo horário: um Story, uma publicação, uma chamada de IA", async () => {
    const seed = await seedUserWithAccount(db);
    aiWorks();
    renderCreatesMedia(seed.userId);
    await smartAutomation(seed);

    await Promise.all([
      cron.runContentAutomationCron({ now: WEDNESDAY_MORNING }),
      cron.runContentAutomationCron({ now: WEDNESDAY_MORNING }),
    ]);
    await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });

    expect(fakeProvider.rewriteText).toHaveBeenCalledTimes(1);
    expect(await db.sql`select id from instagram_posts`).toHaveLength(1);
    expect(await db.sql`select id from smart_story_generations`).toHaveLength(1);
    expect(fakeRenderSmart).toHaveBeenCalledTimes(1);
  });

  it("queda entre criar o post e vincular o Story: o retry acha o post e não cria outro", async () => {
    const seed = await seedUserWithAccount(db);
    aiWorks();
    renderCreatesMedia(seed.userId);
    await smartAutomation(seed);
    await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });
    const [post] = await db.sql`select id from instagram_posts`;

    // Simula a queda: vínculo perdido e execução de volta para PENDING.
    await db.sql`update smart_story_generations set instagram_post_id = null`;
    await db.sql`update automation_runs set status = 'PENDING', publication_id = null, next_attempt_at = null, processing_lock_token = null`;
    await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });

    expect(await db.sql`select id from instagram_posts`).toHaveLength(1);
    const [story] = await stories();
    expect(story.instagram_post_id).toBe(post.id);
    expect(fakeRenderSmart).toHaveBeenCalledTimes(1);
  });

  it("espelha o status do post: Publishing → Failed → (retry do MESMO post) → Published", async () => {
    const seed = await seedUserWithAccount(db);
    aiWorks();
    renderCreatesMedia(seed.userId);
    await smartAutomation(seed, { requireApproval: false });
    await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });
    const [post] = await db.sql`select id from instagram_posts`;
    const [before] = await stories();
    expect(before.status).toBe("READY");

    await db.sql`update instagram_posts set status = 'PROCESSING' where id = ${post.id}`;
    expect(await smartRepo.syncSmartStoryStatuses()).toBe(1);
    expect((await stories())[0].status).toBe("PUBLISHING");

    await db.sql`update instagram_posts set status = 'FAILED', last_error_sanitized = 'erro da Meta' where id = ${post.id}`;
    await smartRepo.syncSmartStoryStatuses();
    expect((await stories())[0].status).toBe("FAILED");

    // O publicador (camada única) reagenda o MESMO post; o Story volta a Ready e depois Published.
    await db.sql`update instagram_posts set status = 'SCHEDULED' where id = ${post.id}`;
    await smartRepo.syncSmartStoryStatuses();
    expect((await stories())[0].status).toBe("READY");
    await db.sql`update instagram_posts set status = 'PUBLISHED', meta_media_id = '17890', published_at = '2026-09-30T11:00:00Z' where id = ${post.id}`;
    await smartRepo.syncSmartStoryStatuses();
    const [after] = await stories();
    expect(after).toMatchObject({ status: "PUBLISHED", instagram_media_id: "17890", instagram_post_id: post.id, headline: before.headline });
    expect(await db.sql`select id from instagram_posts`).toHaveLength(1);
    // Publicado é terminal e a sincronização é idempotente.
    expect(await smartRepo.syncSmartStoryStatuses()).toBe(0);
  });

  it("o histórico de execuções (automation_runs) continua ligado à mesma publicação", async () => {
    const seed = await seedUserWithAccount(db);
    aiWorks();
    renderCreatesMedia(seed.userId);
    await smartAutomation(seed);
    await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });
    const [run] = await db.sql`select status, publication_id from automation_runs`;
    const [post] = await db.sql`select id from instagram_posts`;
    expect(run).toMatchObject({ status: "WAITING_APPROVAL", publication_id: post.id });
  });
});

describe("compatibilidade: o fluxo de Stories de sempre não muda", () => {
  it("modo inteligente DESLIGADO: Story pelo caminho antigo (nenhum registro inteligente)", async () => {
    const seed = await seedUserWithAccount(db);
    const renderLegacy = (await import("@/lib/instagram/backend/template-render-service")).renderAndStoreAutomationArt as ReturnType<typeof vi.fn>;
    renderLegacy.mockImplementation(async () => {
      const [media] = await db.sql`insert into instagram_media (user_id, storage_url, media_type) values (${seed.userId}, 'https://blob.example.com/legacy.jpg', 'image') returning id`;
      return media.id as string;
    });
    fakeProvider.generatePost.mockResolvedValue({
      content: { title: "t", caption: "c", hashtags: [], cta: "", visualDescription: "", visualText: "Frase do Story antigo" },
      usage: { provider: "anthropic", model: "t", tokensInput: 1, tokensOutput: 1 },
    });
    await smartAutomation(seed, { enableSmart: false });

    const results = await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });

    expect(results[0].status).toBe("WAITING_APPROVAL");
    expect(fakeProvider.generatePost).toHaveBeenCalledTimes(1);
    expect(fakeProvider.rewriteText).not.toHaveBeenCalled();
    expect(renderLegacy).toHaveBeenCalledWith(expect.objectContaining({ formatId: "stories", visualText: "Frase do Story antigo" }));
    expect(await stories()).toHaveLength(0);
  });

  it("modo inteligente ligado + conteúdo salvo como MANUAL: o motor inteligente tem prioridade (texto manual e imagem ignorados)", async () => {
    const seed = await seedUserWithAccount(db);
    aiWorks();
    renderCreatesMedia(seed.userId);
    const renderLegacy = (await import("@/lib/instagram/backend/template-render-service")).renderAndStoreAutomationArt as ReturnType<typeof vi.fn>;
    await smartAutomation(seed, { contentMode: "MANUAL" });
    await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });
    expect(renderLegacy).not.toHaveBeenCalled();
    expect(fakeProvider.rewriteText).toHaveBeenCalledTimes(1);
    expect(await stories()).toHaveLength(1);
  });

  it("modo 'Personalizado por dia' também aceita o modo inteligente (Story de um dia específico)", async () => {
    const seed = await seedUserWithAccount(db);
    aiWorks();
    renderCreatesMedia(seed.userId);
    const id = await repo.createAutomation({
      userId: seed.userId,
      instagramAccountId: seed.accountId,
      name: "Personalizado",
      description: "",
      timezone: "America/Sao_Paulo",
      brandContext: "Alilu",
      autoPublish: false,
      requireApproval: true,
      generationLeadMinutes: 1440,
      imageMode: "FIXED_IMAGE",
      fixedImageMediaId: seed.mediaId,
      videoSelection: "FIXED",
      fixedVideoMediaId: seed.videoId,
    });
    await repo.updateAutomationDay(id, seed.userId, "WEDNESDAY", { enabled: true, contentType: "STORY", prompt: "Dica de quarta", publishTime: "12:00" });
    await service.updateSmartStory(id, seed.userId, { enabled: true });
    await service.activateAutomation(id, seed.userId);

    await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });
    const [story] = await stories();
    expect(MIDDAY).toContain(story.story_type);
  });
});

describe("configuração (update-smart-story)", () => {
  it("liga/desliga e guarda a configuração normalizada; não mexe em dias nem horários", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await smartAutomation(seed, { enableSmart: false, times: ["08:00", "19:00"] });
    const before = await service.getAutomationDetails(id, seed.userId);
    expect(before.smartStory.enabled).toBe(false);

    const saved = await service.updateSmartStory(id, seed.userId, {
      enabled: true,
      config: { enabledTypes: ["REFLECTION", "CTA"], mascotEveryN: 4, avoidTypeWindow: 2 },
    });
    expect(saved.enabled).toBe(true);
    expect(saved.config).toMatchObject({ enabledTypes: ["REFLECTION", "CTA"], mascotEveryN: 4, avoidTypeWindow: 2, enabled: true });

    const after = await service.getAutomationDetails(id, seed.userId);
    expect(after.smartStory).toMatchObject({ enabled: true });
    expect(after.smartStory.config.themes.length).toBe(12); // o que não veio mantém o padrão
    expect(after.days.filter((day) => day.enabled)).toHaveLength(before.days.filter((day) => day.enabled).length);

    // Atualização parcial mantém o resto; desligar mantém a configuração.
    await service.updateSmartStory(id, seed.userId, { enabled: false });
    const off = await service.getAutomationDetails(id, seed.userId);
    expect(off.smartStory.enabled).toBe(false);
    expect(off.smartStory.config.enabledTypes).toEqual(["REFLECTION", "CTA"]);
  });

  it("rejeita configuração inválida com mensagem clara (nada é salvo)", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await smartAutomation(seed, { enableSmart: false });
    await expect(service.updateSmartStory(id, seed.userId, { config: { enabledTypes: ["NATIVE_POLL"] } })).rejects.toThrow(/Tipos de Story/);
    await expect(service.updateSmartStory(id, seed.userId, { config: { typeWeights: { CTA: -1 } } })).rejects.toThrow(/peso de CTA/);
    await expect(service.updateSmartStory(id, seed.userId, { config: { mascotEveryN: 1 } })).rejects.toThrow(/mascote/i);
    await expect(service.updateSmartStory(id, seed.userId, { config: { language: "en" } })).rejects.toThrow(/pt-BR/);
    await expect(service.updateSmartStory(id, seed.userId, { config: { timeBuckets: [{ id: "x", fromMinute: 0, toMinute: 2000, types: ["CTA"] }] } })).rejects.toThrow(/Faixas/);
    await expect(service.updateSmartStory(id, seed.userId, { enabled: "sim" as never })).rejects.toThrow(/verdadeiro ou falso/);
    await expect(service.updateSmartStory(id, seed.userId, { config: "x" })).rejects.toThrow(/objeto/);
    expect((await service.getAutomationDetails(id, seed.userId)).smartStory.enabled).toBe(false);
  });

  it("outro usuário não consegue alterar a automação", async () => {
    const seed = await seedUserWithAccount(db);
    const other = await seedUserWithAccount(db, "2");
    const id = await smartAutomation(seed, { enableSmart: false });
    await expect(service.updateSmartStory(id, other.userId, { enabled: true })).rejects.toThrow();
  });

  it("duplicar a automação copia o modo inteligente e a configuração", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await smartAutomation(seed, { enableSmart: false });
    await service.updateSmartStory(id, seed.userId, { enabled: true, config: { mascotEveryN: 3 } });
    const copyId = await service.duplicateAutomation(id, seed.userId);
    const copy = await service.getAutomationDetails(copyId, seed.userId);
    expect(copy.smartStory.enabled).toBe(true);
    expect(copy.smartStory.config.mascotEveryN).toBe(3);
  });
});

describe("modo inteligente × imagem de fundo do fluxo antigo", () => {
  it("ativa e gera SEM nenhuma imagem configurada (a imagem de fundo não é exigida)", async () => {
    const seed = await seedUserWithAccount(db);
    aiWorks();
    renderCreatesMedia(seed.userId);
    await smartAutomation(seed, { noImage: true });
    const results = await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });
    expect(results[0].status).toBe("WAITING_APPROVAL");
    expect(await stories()).toHaveLength(1);
  });

  it("imagem antiga salva (fixa, modo 'IA sobre a imagem') é IGNORADA: o renderer só recebe conteúdo/fundo/marca/mascote", async () => {
    const seed = await seedUserWithAccount(db);
    aiWorks();
    renderCreatesMedia(seed.userId);
    const renderLegacy = (await import("@/lib/instagram/backend/template-render-service")).renderAndStoreAutomationArt as ReturnType<typeof vi.fn>;
    await smartAutomation(seed, { imageMode: "AUTO_TEMPLATE" });
    await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });

    expect(renderLegacy).not.toHaveBeenCalled();
    expect(fakeRenderSmart).toHaveBeenCalledTimes(1);
    const input = fakeRenderSmart.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(input).sort()).toEqual(["automationRunId", "background", "content", "showBrand", "useMascot", "userId"]);
    const [background] = [input.background as { id: string; kind?: string }];
    expect(background.id).toBeTruthy();
    expect(JSON.stringify(input)).not.toContain(seed.mediaId);
  });

  it("imagem salva que nem existe mais (apagada) também não derruba o Story inteligente", async () => {
    const seed = await seedUserWithAccount(db);
    aiWorks();
    renderCreatesMedia(seed.userId);
    await smartAutomation(seed);
    await db.sql`update content_automations set fixed_image_media_id = null`;
    const results = await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });
    expect(results[0].status).toBe("WAITING_APPROVAL");
  });

  it("sem prompt base, o modo inteligente não ativa (mensagem clara) — mas NÃO pede imagem", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await service.createAutomation({
      userId: seed.userId,
      instagramAccountId: seed.accountId,
      name: "Sem prompt",
      timezone: "America/Sao_Paulo",
      generationLeadMinutes: 1440,
      imageMode: "FIXED_IMAGE",
      fixedImageMediaId: null,
      requireApproval: true,
      scheduleMode: "SHARED_PROMPT",
    });
    await service.updateSharedAutomation(id, seed.userId, {
      content: { contentType: "STORY", contentMode: "AI", prompt: "" },
      schedule: { days: ["MONDAY"], times: ["08:00"] },
    });
    await service.updateSmartStory(id, seed.userId, { enabled: true });
    await expect(service.activateAutomation(id, seed.userId)).rejects.toThrow(/prompt base/i);
  });

  it("modo inteligente DESLIGADO: continua exigindo a imagem de fundo (fluxo antigo intacto)", async () => {
    const seed = await seedUserWithAccount(db);
    await expect(smartAutomation(seed, { enableSmart: false, noImage: true })).rejects.toThrow(/imagem de fundo/i);
  });

  it("manual → inteligente → manual: a imagem e o modo de imagem antigos são preservados", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await smartAutomation(seed, { enableSmart: false, imageMode: "AUTO_TEMPLATE" });
    const before = await service.getAutomationDetails(id, seed.userId);
    await service.updateSmartStory(id, seed.userId, { enabled: true });
    const during = await service.getAutomationDetails(id, seed.userId);
    expect(during.smartStory.enabled).toBe(true);
    expect(during.fixedImageMediaId).toBe(before.fixedImageMediaId);
    expect(during.imageMode).toBe("AUTO_TEMPLATE");
    await service.updateSmartStory(id, seed.userId, { enabled: false });
    const after = await service.getAutomationDetails(id, seed.userId);
    expect(after.smartStory.enabled).toBe(false);
    expect(after.fixedImageMediaId).toBe(seed.mediaId);
    expect(after.imageMode).toBe("AUTO_TEMPLATE");
  });

  it("modo aprovação e modo automático usam o mesmo Story inteligente (rascunho × agendado)", async () => {
    const seed = await seedUserWithAccount(db);
    aiWorks();
    renderCreatesMedia(seed.userId);
    await smartAutomation(seed, { requireApproval: false });
    const results = await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });
    expect(results[0].status).toBe("SCHEDULED");
    const [post] = await db.sql`select status, scheduled_at_utc from instagram_posts`;
    expect(post.status).toBe("SCHEDULED");
  });
});
