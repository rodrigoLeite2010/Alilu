// Confirma que a trava de acesso (AutomationAccessService) está de fato
// ligada no laço real do cron — content-automation.test.ts cobre o
// motor de geração em si (que continua intocado); este arquivo cobre
// só a trava nova: TESTE 14 (bloquear chamada de IA sem acesso) e a
// devolução da vaga do trial quando a geração falha por erro interno
// (seção "reserve → generate → confirm / release on internal failure").
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedUserWithAccount, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({
  getDb: () => db.sql,
  assertDatabaseConfigured: () => undefined,
}));

const fakeProvider = {
  generatePost: vi.fn(),
  generateReel: vi.fn(),
};
vi.mock("@/lib/content-automation/backend/provider-factory", () => ({
  getContentAIProvider: () => fakeProvider,
}));

const fakeRenderAndStoreAutomationArt = vi.fn();
const fakeRenderAndStoreAutomationCarousel = vi.fn();
vi.mock("@/lib/instagram/backend/template-render-service", () => ({
  renderAndStoreAutomationArt: (...args: unknown[]) => fakeRenderAndStoreAutomationArt(...args),
  renderAndStoreAutomationCarousel: (...args: unknown[]) => fakeRenderAndStoreAutomationCarousel(...args),
}));

const repo = await import("@/lib/content-automation/backend/automation-repository");
const cron = await import("@/lib/content-automation/backend/content-automation-cron");

function happyPost() {
  fakeProvider.generatePost.mockResolvedValue({
    content: {
      title: "Título gerado",
      caption: "Legenda gerada pela IA",
      hashtags: ["#alilu", "#promo"],
      cta: "Chama no direct!",
      visualDescription: "Foto do produto em fundo claro",
    },
    usage: { provider: "anthropic", model: "claude-test", tokensInput: 100, tokensOutput: 50 },
  });
}

async function activePostAutomation(seed: Awaited<ReturnType<typeof seedUserWithAccount>>) {
  const automationId = await repo.createAutomation({
    userId: seed.userId,
    instagramAccountId: seed.accountId,
    name: "Automação de teste",
    description: "",
    timezone: "America/Sao_Paulo",
    brandContext: "Marca de utilitários domésticos",
    autoPublish: false,
    requireApproval: true,
    generationLeadMinutes: 120,
    imageMode: "FIXED_IMAGE",
    fixedImageMediaId: seed.mediaId,
    videoSelection: "FIXED",
    fixedVideoMediaId: seed.videoId,
  });

  await repo.updateAutomationDay(automationId, seed.userId, "WEDNESDAY" as never, {
    enabled: true,
    contentType: "POST",
    prompt: "Fale sobre a promoção de hoje",
    publishTime: "19:00",
  });

  await repo.setAutomationStatus(automationId, seed.userId, "ACTIVE");
  return automationId;
}

// Quarta 17h em São Paulo (20h UTC) — mesma janela usada em content-automation.test.ts.
const DUE_NOW = () => new Date("2026-09-23T20:00:00.000Z");

beforeEach(async () => {
  db = await createTestDb();
  happyPost();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  await db.close();
  fakeProvider.generatePost.mockReset();
  fakeRenderAndStoreAutomationArt.mockReset();
  vi.restoreAllMocks();
});

describe("TESTE 14 — nenhuma chamada à IA acontece sem acesso liberado", () => {
  it("assinatura PAST_DUE bloqueia a geração antes de chamar o provedor de IA", async () => {
    const seed = await seedUserWithAccount(db);
    await activePostAutomation(seed);
    await db.sql`insert into automation_subscriptions (user_id, status) values (${seed.userId}, 'PAST_DUE')`;

    const results = await cron.runContentAutomationCron({ now: DUE_NOW });

    expect(fakeProvider.generatePost).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("PENDING");
    expect(results[0].error).toMatch(/atraso/i);

    const [run] = await db.sql`select * from automation_runs`;
    expect(run.status).toBe("PENDING");
    expect(run.publication_id).toBeNull();
  });

  it("limite diário do trial já esgotado bloqueia a geração antes de chamar o provedor de IA", async () => {
    const seed = await seedUserWithAccount(db);
    await activePostAutomation(seed);
    await db.sql`
      insert into automation_subscriptions (user_id, status, trial_started_at, trial_ends_at, trial_usage_date, trial_usage_count)
      values (${seed.userId}, 'TRIAL', ${DUE_NOW().toISOString()}, ${new Date(DUE_NOW().getTime() + 7 * 86400000).toISOString()}, '2026-09-23', 3)
    `;

    const results = await cron.runContentAutomationCron({ now: DUE_NOW });

    expect(fakeProvider.generatePost).not.toHaveBeenCalled();
    expect(results[0].error).toMatch(/limite/i);
  });
});

describe("devolução da vaga do trial quando a geração falha por erro interno", () => {
  it("libera o uso reservado se o provedor de IA falhar, sem derrubar o contador do usuário", async () => {
    const seed = await seedUserWithAccount(db);
    await activePostAutomation(seed);
    fakeProvider.generatePost.mockRejectedValue(new Error("IA fora do ar"));

    const results = await cron.runContentAutomationCron({ now: DUE_NOW });
    expect(results[0].status).toBe("PENDING");
    expect(results[0].error).toMatch(/IA fora do ar/);

    const [subscription] = await db.sql`select * from automation_subscriptions where user_id = ${seed.userId}`;
    expect(subscription.status).toBe("TRIAL");
    expect(Number(subscription.trial_usage_count)).toBe(0);

    // Corrige a IA e roda de novo (retry do backoff, adiantado manualmente): consome a vaga de novo, agora com sucesso.
    happyPost();
    const retryNow = () => new Date(DUE_NOW().getTime() + 6 * 60_000);
    const retryResults = await cron.runContentAutomationCron({ now: retryNow });
    expect(retryResults[0].status).toBe("WAITING_APPROVAL");

    const [afterRetry] = await db.sql`select trial_usage_count from automation_subscriptions where user_id = ${seed.userId}`;
    expect(Number(afterRetry.trial_usage_count)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Planos pagos: texto manual (R$ 19) x IA (Criador/Pro, franquia por ciclo).
// ---------------------------------------------------------------------------
async function seedPlan(userId: string, plan: "AUTOMATION" | "CREATOR" | "PRO") {
  await db.sql`
    insert into automation_subscriptions (user_id, status, plan_code, current_period_ends_at)
    values (${userId}, 'ACTIVE', ${plan}, '2026-10-20T00:00:00Z')
  `;
}

async function cycleUsed(userId: string) {
  const [row] = await db.sql`select used from plan_usage_cycles where user_id = ${userId} and cycle_key = '2026-10-20'`;
  return row ? Number(row.used) : 0;
}

describe("plano Automático (R$ 19): texto manual sem limite, IA não", () => {
  it("dia com IA é bloqueado ANTES de chamar a IA, com convite de upgrade", async () => {
    const seed = await seedUserWithAccount(db);
    await activePostAutomation(seed);
    await seedPlan(seed.userId, "AUTOMATION");

    const results = await cron.runContentAutomationCron({ now: DUE_NOW });

    expect(fakeProvider.generatePost).not.toHaveBeenCalled();
    expect(results[0].error).toMatch(/não inclui geração com IA/i);
    expect(await cycleUsed(seed.userId)).toBe(0);
  });

  it("dia com texto manual publica sem IA e sem consumir franquia", async () => {
    const seed = await seedUserWithAccount(db);
    const automationId = await activePostAutomation(seed);
    await repo.updateAutomationDay(automationId, seed.userId, "WEDNESDAY" as never, { contentMode: "MANUAL", manualCaption: "Legenda escrita por mim" });
    await seedPlan(seed.userId, "AUTOMATION");

    const results = await cron.runContentAutomationCron({ now: DUE_NOW });

    expect(fakeProvider.generatePost).not.toHaveBeenCalled();
    expect(results[0].status).toBe("WAITING_APPROVAL");
    expect(await cycleUsed(seed.userId)).toBe(0);
  });
});

describe("plano Criador: IA consome a franquia do ciclo", () => {
  it("geração com IA conta 1; falha devolve; retry conta 1", async () => {
    const seed = await seedUserWithAccount(db);
    await activePostAutomation(seed);
    await seedPlan(seed.userId, "CREATOR");
    fakeProvider.generatePost.mockRejectedValue(new Error("IA fora do ar"));

    const failed = await cron.runContentAutomationCron({ now: DUE_NOW });
    expect(failed[0].error).toMatch(/IA fora do ar/);
    expect(await cycleUsed(seed.userId)).toBe(0);

    happyPost();
    const retried = await cron.runContentAutomationCron({ now: () => new Date(DUE_NOW().getTime() + 6 * 60_000) });
    expect(retried[0].status).toBe("WAITING_APPROVAL");
    expect(await cycleUsed(seed.userId)).toBe(1);

    const [usageRow] = await db.sql`select user_id, feature from generation_usage where user_id = ${seed.userId}`;
    expect(usageRow.feature).toBe("automation"); // custo de IA por usuário fica registrado
  });

  it("franquia esgotada bloqueia antes de chamar a IA", async () => {
    const seed = await seedUserWithAccount(db);
    await activePostAutomation(seed);
    await seedPlan(seed.userId, "CREATOR");
    await db.sql`insert into plan_usage_cycles (user_id, cycle_key, plan_code, used) values (${seed.userId}, '2026-10-20', 'CREATOR', 90)`;

    const results = await cron.runContentAutomationCron({ now: DUE_NOW });

    expect(fakeProvider.generatePost).not.toHaveBeenCalled();
    expect(results[0].error).toMatch(/limite de 90 publicações com IA/i);
    expect(await cycleUsed(seed.userId)).toBe(90);
  });
});

describe("configurar a automação: o botão de IA respeita o plano", () => {
  it("plano Automático não consegue colocar um dia em modo IA nem ativar uma automação com IA", async () => {
    const seed = await seedUserWithAccount(db);
    const automationId = await activePostAutomation(seed);
    await repo.setAutomationStatus(automationId, seed.userId, "PAUSED");
    await seedPlan(seed.userId, "AUTOMATION");
    const service = await import("@/lib/content-automation/backend/automation-service");

    await expect(service.updateAutomationDay(automationId, seed.userId, "WEDNESDAY" as never, { contentMode: "AI" })).rejects.toMatchObject({
      name: "AutomationValidationError",
      code: "AI_PLAN_REQUIRED",
    });
    await expect(service.activateAutomation(automationId, seed.userId)).rejects.toMatchObject({ code: "AI_PLAN_REQUIRED" });

    // Trocando para texto manual, ativa normalmente.
    await service.updateAutomationDay(automationId, seed.userId, "WEDNESDAY" as never, { contentMode: "MANUAL", manualCaption: "Meu texto" });
    await expect(service.activateAutomation(automationId, seed.userId)).resolves.toBeUndefined();
  });

  it("plano Criador e quem ainda está no teste podem usar IA", async () => {
    const seed = await seedUserWithAccount(db);
    const automationId = await activePostAutomation(seed);
    const service = await import("@/lib/content-automation/backend/automation-service");
    await expect(service.updateAutomationDay(automationId, seed.userId, "WEDNESDAY" as never, { contentMode: "AI" })).resolves.toBeUndefined();
    await seedPlan(seed.userId, "CREATOR");
    await expect(service.updateAutomationDay(automationId, seed.userId, "WEDNESDAY" as never, { contentMode: "AI" })).resolves.toBeUndefined();
  });
});
