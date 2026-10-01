// Piloto Automático: STORIES + vários horários no mesmo dia (migração 0018),
// contra um Postgres REAL em memória (PGlite, mesmas migrações de produção).
// Só o provedor de IA e o desenho/upload da arte são simulados — o SQL de
// claim/lock/idempotência é o de verdade.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedUserWithAccount, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({
  getDb: () => db.sql,
  assertDatabaseConfigured: () => undefined,
}));

const fakeProvider = { generatePost: vi.fn(), generateReel: vi.fn() };
vi.mock("@/lib/content-automation/backend/provider-factory", () => ({
  getContentAIProvider: () => fakeProvider,
}));

const fakeRenderAndStoreAutomationArt = vi.fn();
vi.mock("@/lib/instagram/backend/template-render-service", () => ({
  renderAndStoreAutomationArt: (...args: unknown[]) => fakeRenderAndStoreAutomationArt(...args),
  renderAndStoreAutomationCarousel: vi.fn(),
}));

const repo = await import("@/lib/content-automation/backend/automation-repository");
const cron = await import("@/lib/content-automation/backend/content-automation-cron");
const service = await import("@/lib/content-automation/backend/automation-service");

type Seed = Awaited<ReturnType<typeof seedUserWithAccount>>;

function aiReturns(visualText: string) {
  fakeProvider.generatePost.mockResolvedValue({
    content: { title: "t", caption: "legenda que Story não usa", hashtags: [], cta: "", visualDescription: "", visualText },
    usage: { provider: "anthropic", model: "claude-test", tokensInput: 10, tokensOutput: 5 },
  });
}

/** Cada chamada de renderAndStoreAutomationArt devolve uma mídia REAL (FK de instagram_post_items). */
function renderCreatesMedia(userId: string) {
  let counter = 0;
  fakeRenderAndStoreAutomationArt.mockImplementation(async () => {
    counter += 1;
    const [media] = await db.sql`
      insert into instagram_media (user_id, storage_url, media_type)
      values (${userId}, ${`https://blob.example.com/story-${counter}.jpg`}, 'image') returning id
    `;
    return media.id as string;
  });
}

async function createAutomation(seed: Seed, overrides: { requireApproval?: boolean; name?: string } = {}) {
  const requireApproval = overrides.requireApproval ?? true;
  return repo.createAutomation({
    userId: seed.userId,
    instagramAccountId: seed.accountId,
    name: overrides.name ?? "Stories da semana",
    description: "",
    timezone: "America/Sao_Paulo",
    brandContext: "Alilu",
    autoPublish: !requireApproval,
    requireApproval,
    generationLeadMinutes: 1440,
    imageMode: "FIXED_IMAGE",
    fixedImageMediaId: seed.mediaId,
    videoSelection: "FIXED",
    fixedVideoMediaId: seed.videoId,
  });
}

// Quarta-feira 30/09/2026, 07:00 em São Paulo (10:00 UTC). Com antecedência
// de 1440 min, todo horário de hoje já está na janela de geração.
const WEDNESDAY_MORNING = () => new Date("2026-09-30T10:00:00.000Z");

beforeEach(async () => {
  db = await createTestDb();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  await db.close();
  fakeProvider.generatePost.mockReset();
  fakeRenderAndStoreAutomationArt.mockReset();
  vi.restoreAllMocks();
});

describe("geração de Story", () => {
  it("gera a arte no formato 'stories' com o texto da IA e cria uma publicação 'story' sem legenda", async () => {
    const seed = await seedUserWithAccount(db);
    renderCreatesMedia(seed.userId);
    aiReturns("Comece a semana com coragem.");
    const automationId = await createAutomation(seed);
    await repo.updateAutomationDay(automationId, seed.userId, "WEDNESDAY", {
      enabled: true,
      contentType: "STORY",
      prompt: "Frase motivacional curta",
      publishTime: "08:00",
    });
    await service.activateAutomation(automationId, seed.userId);

    const results = await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("WAITING_APPROVAL");
    expect(fakeRenderAndStoreAutomationArt).toHaveBeenCalledWith(
      expect.objectContaining({ formatId: "stories", visualText: "Comece a semana com coragem." }),
    );
    const posts = await db.sql`select post_type, caption, status from instagram_posts`;
    expect(posts).toHaveLength(1);
    expect(posts[0].post_type).toBe("story");
    expect(posts[0].caption).toBe("");
    expect(posts[0].status).toBe("DRAFT");
  });

  it("modo automático agenda o Story para o horário configurado", async () => {
    const seed = await seedUserWithAccount(db);
    renderCreatesMedia(seed.userId);
    aiReturns("Dica rápida");
    const automationId = await createAutomation(seed, { requireApproval: false });
    await repo.updateAutomationDay(automationId, seed.userId, "WEDNESDAY", {
      enabled: true,
      contentType: "STORY",
      prompt: "Dica",
      publishTime: "12:00",
    });
    await service.activateAutomation(automationId, seed.userId);

    const results = await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });

    expect(results[0].status).toBe("SCHEDULED");
    const [post] = await db.sql`select status, scheduled_at_utc from instagram_posts`;
    expect(post.status).toBe("SCHEDULED");
    // 12:00 em São Paulo = 15:00 UTC.
    expect(new Date(post.scheduled_at_utc as string).toISOString()).toBe("2026-09-30T15:00:00.000Z");
  });

  it("modo manual sem texto publica só a foto: nenhuma chamada de IA e nenhum véu", async () => {
    const seed = await seedUserWithAccount(db);
    renderCreatesMedia(seed.userId);
    const automationId = await createAutomation(seed);
    await repo.updateAutomationDay(automationId, seed.userId, "WEDNESDAY", {
      enabled: true,
      contentType: "STORY",
      contentMode: "MANUAL",
      visualText: "",
      publishTime: "08:00",
    });
    await service.activateAutomation(automationId, seed.userId);

    const results = await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });

    expect(results[0].status).toBe("WAITING_APPROVAL");
    expect(fakeProvider.generatePost).not.toHaveBeenCalled();
    expect(fakeRenderAndStoreAutomationArt).toHaveBeenCalledWith(
      expect.objectContaining({ formatId: "stories", visualText: "", overlayOpacity: 0 }),
    );
  });

  it("substitui as variáveis do prompt antes de chamar a IA", async () => {
    const seed = await seedUserWithAccount(db);
    renderCreatesMedia(seed.userId);
    aiReturns("ok");
    const automationId = await createAutomation(seed, { name: "Alilu Stories" });
    await repo.updateAutomationDay(automationId, seed.userId, "WEDNESDAY", {
      enabled: true,
      contentType: "STORY",
      contentCategory: "FINANCEIRO",
      prompt: "Hoje é {{diaSemana}} ({{data}} às {{hora}}), conta {{nomeConta}}, tema {{tema}}, categoria {{categoria}}. {{desconhecida}}",
      publishTime: "08:00",
    });
    await service.activateAutomation(automationId, seed.userId);

    await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });

    expect(fakeProvider.generatePost).toHaveBeenCalledWith(
      expect.objectContaining({
        dayPrompt:
          "Hoje é Quarta-feira (30/09/2026 às 08:00), conta conta1, tema Alilu Stories, categoria Financeiro. {{desconhecida}}",
      }),
    );
  });

  it("se a IA não devolver texto, a execução falha com retry (nunca publica um Story vazio por engano)", async () => {
    const seed = await seedUserWithAccount(db);
    renderCreatesMedia(seed.userId);
    aiReturns("");
    const automationId = await createAutomation(seed);
    await repo.updateAutomationDay(automationId, seed.userId, "WEDNESDAY", {
      enabled: true,
      contentType: "STORY",
      prompt: "Frase",
      publishTime: "08:00",
    });
    await service.activateAutomation(automationId, seed.userId);

    const results = await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });

    expect(results[0].status).toBe("PENDING"); // agendado para nova tentativa
    expect(fakeRenderAndStoreAutomationArt).not.toHaveBeenCalled();
    expect(await db.sql`select id from instagram_posts`).toHaveLength(0);
  });
});

describe("vários horários no mesmo dia", () => {
  async function threeSlotsToday(seed: Seed) {
    const automationId = await createAutomation(seed);
    await repo.updateAutomationDay(automationId, seed.userId, "WEDNESDAY", {
      enabled: true,
      contentType: "STORY",
      prompt: "Motivacional",
      publishTime: "08:00",
    });
    const noon = await service.addAutomationSlot(automationId, seed.userId, "WEDNESDAY");
    await service.updateAutomationDay(automationId, seed.userId, { slotId: noon }, {
      contentType: "STORY",
      prompt: "Financeiro",
      publishTime: "12:00",
    });
    const evening = await service.addAutomationSlot(automationId, seed.userId, "WEDNESDAY");
    await service.updateAutomationDay(automationId, seed.userId, { slotId: evening }, {
      contentType: "STORY",
      prompt: "Divulgação",
      publishTime: "19:00",
    });
    await service.activateAutomation(automationId, seed.userId);
    return automationId;
  }

  it("cada horário gera o seu Story uma única vez — rodar o cron de novo não duplica nada", async () => {
    const seed = await seedUserWithAccount(db);
    renderCreatesMedia(seed.userId);
    aiReturns("Texto");
    await threeSlotsToday(seed);

    const first = await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });
    const second = await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });

    expect(first).toHaveLength(3);
    expect(second).toHaveLength(0);
    expect(fakeProvider.generatePost).toHaveBeenCalledTimes(3);
    const runs = await db.sql`select automation_day_id, run_date from automation_runs`;
    expect(runs).toHaveLength(3);
    expect(new Set(runs.map((run) => run.automation_day_id)).size).toBe(3);
    expect(await db.sql`select id from instagram_posts where post_type = 'story'`).toHaveLength(3);
  });

  it("dois crons simultâneos nunca geram o mesmo horário duas vezes", async () => {
    const seed = await seedUserWithAccount(db);
    renderCreatesMedia(seed.userId);
    aiReturns("Texto");
    await threeSlotsToday(seed);

    const [a, b] = await Promise.all([
      cron.runContentAutomationCron({ now: WEDNESDAY_MORNING }),
      cron.runContentAutomationCron({ now: WEDNESDAY_MORNING }),
    ]);

    expect([...a, ...b]).toHaveLength(3);
    expect(fakeProvider.generatePost).toHaveBeenCalledTimes(3);
    expect(await db.sql`select id from instagram_posts`).toHaveLength(3);
  });

  it("um horário que ainda não chegou na janela de geração espera a sua vez", async () => {
    const seed = await seedUserWithAccount(db);
    renderCreatesMedia(seed.userId);
    aiReturns("Texto");
    const automationId = await threeSlotsToday(seed);
    await repo.updateAutomation(automationId, seed.userId, { generationLeadMinutes: 60 });

    // 11:30 em São Paulo: 08:00 e 12:00 estão na janela (12:00 − 60 min = 11:00); 19:00 ainda não.
    const results = await cron.runContentAutomationCron({ now: () => new Date("2026-09-30T14:30:00.000Z") });

    expect(results).toHaveLength(2);
  });

  it("Stories contam no limite do teste grátis igual a posts: o 4º do dia é bloqueado", async () => {
    const seed = await seedUserWithAccount(db);
    renderCreatesMedia(seed.userId);
    aiReturns("Texto");
    const automationId = await threeSlotsToday(seed);
    const extra = await service.addAutomationSlot(automationId, seed.userId, "WEDNESDAY");
    await service.updateAutomationDay(automationId, seed.userId, { slotId: extra }, {
      contentType: "STORY",
      prompt: "Mais um",
      publishTime: "21:00",
    });

    const results = await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });

    expect(results.filter((result) => result.status === "WAITING_APPROVAL")).toHaveLength(3);
    const blocked = results.filter((result) => result.status !== "WAITING_APPROVAL");
    expect(blocked).toHaveLength(1);
    expect(blocked[0].error).toMatch(/limite de 3 automações/);
    expect(fakeProvider.generatePost).toHaveBeenCalledTimes(3);
  });

  it("o horário principal não pode ser removido; um extra sim; o limite de horários por dia é respeitado", async () => {
    const seed = await seedUserWithAccount(db);
    const automationId = await createAutomation(seed);
    const details = await service.getAutomationDetails(automationId, seed.userId);
    const primary = details.days.find((day) => day.dayOfWeek === "MONDAY" && day.slotIndex === 0)!;

    await expect(service.removeAutomationSlot(automationId, seed.userId, primary.id)).rejects.toThrow(/principal/);

    const slotIds: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      slotIds.push(await service.addAutomationSlot(automationId, seed.userId, "MONDAY"));
    }
    await expect(service.addAutomationSlot(automationId, seed.userId, "MONDAY")).rejects.toThrow(/no máximo 6/);

    await service.removeAutomationSlot(automationId, seed.userId, slotIds[0]);
    const after = await service.getAutomationDetails(automationId, seed.userId);
    expect(after.days.filter((day) => day.dayOfWeek === "MONDAY")).toHaveLength(5);
    // Os outros 6 dias continuam com exatamente o horário principal.
    expect(after.days.filter((day) => day.dayOfWeek !== "MONDAY")).toHaveLength(6);
  });

  it("outro usuário nunca adiciona nem remove horários da automação de alguém", async () => {
    const owner = await seedUserWithAccount(db, "1");
    const intruder = await seedUserWithAccount(db, "2");
    const automationId = await createAutomation(owner);
    const slotId = await service.addAutomationSlot(automationId, owner.userId, "MONDAY");

    await expect(service.addAutomationSlot(automationId, intruder.userId, "MONDAY")).rejects.toThrow();
    await expect(service.removeAutomationSlot(automationId, intruder.userId, slotId)).rejects.toThrow();
    await expect(
      service.updateAutomationDay(automationId, intruder.userId, { slotId }, { prompt: "invadido" }),
    ).rejects.toThrow();
  });

  it("duplicar a automação copia também os horários extras", async () => {
    const seed = await seedUserWithAccount(db);
    const automationId = await threeSlotsToday(seed);

    const copyId = await service.duplicateAutomation(automationId, seed.userId);
    const copy = await service.getAutomationDetails(copyId, seed.userId);

    const wednesday = copy.days.filter((day) => day.dayOfWeek === "WEDNESDAY");
    expect(wednesday.map((day) => day.publishTime).sort()).toEqual(["08:00", "12:00", "19:00"]);
    expect(wednesday.every((day) => day.contentType === "STORY")).toBe(true);
    expect(copy.status).toBe("PAUSED");
  });
});

describe("usuário com várias contas", () => {
  it("cada automação publica o Story na própria conta", async () => {
    const seed = await seedUserWithAccount(db);
    const [secondAccount] = await db.sql`
      insert into instagram_accounts (user_id, ig_user_id, ig_username, access_token_encrypted)
      values (${seed.userId}, 'ig-segunda', 'segundaconta', 'cifrado') returning id
    `;
    renderCreatesMedia(seed.userId);
    aiReturns("Texto");

    const first = await createAutomation(seed, { name: "Conta 1" });
    const second = await createAutomation({ ...seed, accountId: secondAccount.id as string }, { name: "Conta 2" });
    for (const automationId of [first, second]) {
      await repo.updateAutomationDay(automationId, seed.userId, "WEDNESDAY", {
        enabled: true,
        contentType: "STORY",
        prompt: "Frase",
        publishTime: "08:00",
      });
      await service.activateAutomation(automationId, seed.userId);
    }

    await cron.runContentAutomationCron({ now: WEDNESDAY_MORNING });

    const posts = await db.sql`select instagram_account_id from instagram_posts where post_type = 'story' order by instagram_account_id`;
    expect(posts.map((post) => post.instagram_account_id).sort()).toEqual([seed.accountId, secondAccount.id].sort());
  });
});

describe("ativação", () => {
  it("Story em modo IA exige prompt; em modo manual o texto é opcional", async () => {
    const seed = await seedUserWithAccount(db);
    const automationId = await createAutomation(seed);
    await repo.updateAutomationDay(automationId, seed.userId, "FRIDAY", {
      enabled: true,
      contentType: "STORY",
      prompt: "",
      publishTime: "08:00",
    });
    await expect(service.activateAutomation(automationId, seed.userId)).rejects.toThrow(/Story de sexta-feira às 08:00/);

    await repo.updateAutomationDay(automationId, seed.userId, "FRIDAY", { contentMode: "MANUAL", visualText: "" });
    await expect(service.activateAutomation(automationId, seed.userId)).resolves.toBeUndefined();
  });

  it("rejeita tipo de conteúdo e categoria inválidos", async () => {
    const seed = await seedUserWithAccount(db);
    const automationId = await createAutomation(seed);
    await expect(
      service.updateAutomationDay(automationId, seed.userId, "MONDAY", { contentType: "LIVE" as never }),
    ).rejects.toThrow(/Tipo de conteúdo inválido/);
    await expect(
      service.updateAutomationDay(automationId, seed.userId, "MONDAY", { contentCategory: "OUTRA" as never }),
    ).rejects.toThrow(/Categoria inválida/);
  });
});
