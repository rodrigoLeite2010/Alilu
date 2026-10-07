// Modo "Prompt único recorrente" (SHARED_PROMPT) ponta a ponta contra um
// Postgres REAL em memória (PGlite, mesmas migrações de produção). Só o
// provedor de IA é simulado — o SQL de claim/idempotência é o de verdade.
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

vi.mock("@/lib/instagram/backend/template-render-service", () => ({
  renderAndStoreAutomationArt: vi.fn(),
  renderAndStoreAutomationCarousel: vi.fn(),
}));

const cron = await import("@/lib/content-automation/backend/content-automation-cron");
const service = await import("@/lib/content-automation/backend/automation-service");
const shared = await import("@/lib/content-automation/shared-schedule");
const { DAYS_OF_WEEK } = await import("@/lib/content-automation/backend/automation-types");

const ALL_DAYS = [...DAYS_OF_WEEK];
const PROMPT = "Crie uma reflexão motivacional sobre persistência.";

function happyPost() {
  fakeProvider.generatePost.mockResolvedValue({
    content: {
      title: "Título",
      caption: "Legenda gerada",
      hashtags: ["#alilu"],
      cta: "Siga!",
      visualDescription: "Foto",
    },
    usage: { provider: "anthropic", model: "claude-test", tokensInput: 10, tokensOutput: 5 },
  });
}

async function sharedAutomation(
  seed: Awaited<ReturnType<typeof seedUserWithAccount>>,
  schedule: { days: string[]; times: string[] },
  options: { prompt?: string; activate?: boolean; timezone?: string; generationLeadMinutes?: number } = {},
) {
  const id = await service.createAutomation({
    userId: seed.userId,
    instagramAccountId: seed.accountId,
    name: "Reflexão diária",
    timezone: options.timezone ?? "America/Sao_Paulo",
    generationLeadMinutes: options.generationLeadMinutes ?? 120,
    imageMode: "FIXED_IMAGE",
    fixedImageMediaId: seed.mediaId,
    scheduleMode: "SHARED_PROMPT",
  });
  await service.updateSharedAutomation(id, seed.userId, {
    content: { contentType: "POST", contentMode: "AI", prompt: options.prompt ?? PROMPT },
    schedule,
  });
  if (options.activate !== false) await service.activateAutomation(id, seed.userId);
  return id;
}

async function enabledRows(automationId: string) {
  return db.sql`select * from content_automation_days where automation_id = ${automationId} and enabled = true`;
}

beforeEach(async () => {
  db = await createTestDb();
  happyPost();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  await db.close();
  fakeProvider.generatePost.mockReset();
  fakeProvider.generateReel.mockReset();
  vi.restoreAllMocks();
});

describe("regras puras da agenda compartilhada", () => {
  it("valida: pelo menos 1 dia, 1 horário, formato HH:mm e sem horários repetidos", () => {
    expect(() => shared.validateSharedSchedule({ days: [], times: ["08:00"] })).toThrow("pelo menos um dia");
    expect(() => shared.validateSharedSchedule({ days: ["MONDAY"], times: [] })).toThrow("pelo menos um horário");
    expect(() => shared.validateSharedSchedule({ days: ["MONDAY"], times: ["8h"] })).toThrow("Horário inválido");
    expect(() => shared.validateSharedSchedule({ days: ["FUNDAY"], times: ["08:00"] })).toThrow("Dia da semana inválido");
    expect(() => shared.validateSharedSchedule({ days: ["MONDAY"], times: ["08:00", "08:00"] })).toThrow("repetido");
    const ok = shared.validateSharedSchedule({ days: ["FRIDAY", "MONDAY"], times: ["12:00", "08:00"] });
    expect(ok).toEqual({ days: ["MONDAY", "FRIDAY"], times: ["08:00", "12:00"] });
  });

  it("agenda completa 7 dias × 3 horários = 21 linhas, sem duplicar nem sobrar", () => {
    const rows = ALL_DAYS.map((dayOfWeek) => ({
      id: dayOfWeek,
      dayOfWeek,
      slotIndex: 0,
      publishTime: "09:00",
      enabled: false,
      hasRuns: false,
    }));
    const plan = shared.planScheduleReconciliation(rows, { days: ALL_DAYS, times: ["08:00", "12:00", "19:00"] });
    expect(plan.update).toHaveLength(7); // reaproveita a linha principal de cada dia
    expect(plan.insert).toHaveLength(14);
    expect(plan.disable).toHaveLength(0);
  });
});

describe("modo Prompt único recorrente: modelo de dados", () => {
  it("guarda o prompt UMA vez e cria 1 linha por dia × horário (21), sem copiar o prompt", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await sharedAutomation(seed, { days: ALL_DAYS, times: ["08:00", "12:00", "19:00"] });

    const rows = await enabledRows(id);
    expect(rows).toHaveLength(21);
    expect(new Set(rows.map((row) => `${row.day_of_week}-${row.publish_time}`)).size).toBe(21);
    expect(rows.every((row) => row.prompt === "")).toBe(true);

    const [automation] = await db.sql`select schedule_mode, shared_prompt from content_automations where id = ${id}`;
    expect(automation.schedule_mode).toBe("SHARED_PROMPT");
    expect(automation.shared_prompt).toBe(PROMPT);

    const details = await service.getAutomationDetails(id, seed.userId);
    expect(shared.countWeeklyExecutions(details.days)).toBe(21);
    expect(shared.deriveSharedSchedule(details.days)).toEqual({ days: ALL_DAYS, times: ["08:00", "12:00", "19:00"] });
  });

  it("não ativa sem prompt, e valida dias/horários antes de gravar qualquer coisa", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await sharedAutomation(seed, { days: ["MONDAY"], times: ["08:00"] }, { prompt: "", activate: false });
    await expect(service.activateAutomation(id, seed.userId)).rejects.toThrow("Defina o que publicar");

    await expect(
      service.updateSharedAutomation(id, seed.userId, {
        content: { prompt: "Novo prompt" },
        schedule: { days: ["MONDAY"], times: ["08:00", "08:00"] },
      }),
    ).rejects.toThrow("repetido");
    const [automation] = await db.sql`select shared_prompt from content_automations where id = ${id}`;
    expect(automation.shared_prompt).toBe(""); // nada foi gravado
  });

  it("o modo atual (CUSTOM) segue intacto: edita por dia, e o modo novo bloqueia edição linha a linha", async () => {
    const seed = await seedUserWithAccount(db);
    const customId = await service.createAutomation({
      userId: seed.userId,
      instagramAccountId: seed.accountId,
      name: "Personalizada",
      fixedImageMediaId: seed.mediaId,
    });
    const [custom] = await db.sql`select schedule_mode from content_automations where id = ${customId}`;
    expect(custom.schedule_mode).toBe("CUSTOM");
    await service.updateAutomationDay(customId, seed.userId, "MONDAY", { enabled: true, prompt: "Prompt de segunda", publishTime: "08:00" });
    await expect(
      service.updateSharedAutomation(customId, seed.userId, { content: { prompt: "x" } }),
    ).rejects.toThrow("não usa o modo");

    const sharedId = await sharedAutomation(seed, { days: ["MONDAY"], times: ["08:00"], }, { activate: false });
    await expect(
      service.updateAutomationDay(sharedId, seed.userId, "MONDAY", { prompt: "à mão" }),
    ).rejects.toThrow("Prompt único recorrente");
  });
});

describe("modo Prompt único recorrente: cron", () => {
  it("7 dias × 3 horários geram exatamente 21 execuções na semana, todas com o MESMO prompt", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await sharedAutomation(seed, { days: ALL_DAYS, times: ["08:00", "12:00", "19:00"] });

    // Segunda 2026-09-21 a domingo 2026-09-27; 20:30 em São Paulo = 23:30Z (os 3 horários já na janela).
    for (let day = 21; day <= 27; day += 1) {
      const now = () => new Date(`2026-09-${day}T23:30:00.000Z`);
      const results = await cron.runContentAutomationCron({ now });
      expect(results).toHaveLength(3);
      // Chamar de novo no mesmo dia não gera nada (idempotência).
      expect(await cron.runContentAutomationCron({ now })).toHaveLength(0);
    }

    expect(fakeProvider.generatePost).toHaveBeenCalledTimes(21);
    for (const [args] of fakeProvider.generatePost.mock.calls) {
      expect(JSON.stringify(args)).toContain(PROMPT);
    }
    const runs = await db.sql`select * from automation_runs where automation_id = ${id}`;
    expect(runs).toHaveLength(21);
    const generated = await db.sql`select publication_id from automation_runs where automation_id = ${id} and publication_id is not null`;
    expect(generated).toHaveLength(21);
  });

  it("dois crons ao mesmo tempo não geram duas vezes (3 horários = 3 execuções)", async () => {
    const seed = await seedUserWithAccount(db);
    await sharedAutomation(seed, { days: ["WEDNESDAY"], times: ["08:00", "12:00", "19:00"] });
    const now = () => new Date("2026-09-23T23:30:00.000Z"); // quarta
    const [first, second] = await Promise.all([cron.runContentAutomationCron({ now }), cron.runContentAutomationCron({ now })]);
    expect(first.length + second.length).toBe(3);
    expect(fakeProvider.generatePost).toHaveBeenCalledTimes(3);
  });

  it("usa o dia civil de São Paulo, nunca o UTC", async () => {
    const seed = await seedUserWithAccount(db);
    // Quarta 00:30 em SP, janela de 120 min. 2026-09-23T02:30Z = terça 23:30 em SP, mas quarta 02:30 em UTC.
    await sharedAutomation(seed, { days: ["WEDNESDAY"], times: ["00:30"] });
    expect(await cron.runContentAutomationCron({ now: () => new Date("2026-09-23T02:30:00.000Z") })).toHaveLength(0);
    // Terça já é "hoje" em SP; quarta só começa às 03:00Z — e aí o horário de quarta 00:30 está na janela.
    expect(await cron.runContentAutomationCron({ now: () => new Date("2026-09-23T03:30:00.000Z") })).toHaveLength(1);
  });

  it("editar o prompt no meio do dia: o que já rodou não repete, o próximo usa o prompt novo", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await sharedAutomation(seed, { days: ["WEDNESDAY"], times: ["08:00", "12:00"] });

    // 09:00 em SP: só o das 08:00 está na janela.
    expect(await cron.runContentAutomationCron({ now: () => new Date("2026-09-23T12:00:00.000Z") })).toHaveLength(1);
    expect(JSON.stringify(fakeProvider.generatePost.mock.calls[0][0])).toContain(PROMPT);

    await service.updateSharedAutomation(id, seed.userId, { content: { prompt: "Prompt NOVO sobre gratidão" } });

    // 10:30 em SP: o das 12:00 entra na janela (e o das 08:00 não repete).
    expect(await cron.runContentAutomationCron({ now: () => new Date("2026-09-23T13:30:00.000Z") })).toHaveLength(1);
    expect(fakeProvider.generatePost).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(fakeProvider.generatePost.mock.calls[1][0])).toContain("Prompt NOVO sobre gratidão");
  });

  it("remover um dia desabilita as linhas (sem apagar) e preserva o histórico", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await sharedAutomation(seed, { days: ALL_DAYS, times: ["08:00", "12:00"] });

    // Domingo 2026-09-27 roda normalmente.
    expect(await cron.runContentAutomationCron({ now: () => new Date("2026-09-27T23:30:00.000Z") })).toHaveLength(2);
    const rowsBefore = await db.sql`select id from content_automation_days where automation_id = ${id}`;

    await service.updateSharedAutomation(id, seed.userId, {
      schedule: { days: ALL_DAYS.filter((day) => day !== "SUNDAY"), times: ["08:00", "12:00"] },
    });

    expect(await enabledRows(id)).toHaveLength(12);
    const rowsAfter = await db.sql`select id from content_automation_days where automation_id = ${id}`;
    expect(rowsAfter).toHaveLength(rowsBefore.length); // nenhuma linha apagada
    const sundayRuns = await db.sql`select id from automation_runs where automation_id = ${id}`;
    expect(sundayRuns).toHaveLength(2); // histórico do domingo continua

    // Próximo domingo (2026-10-04): não executa mais.
    expect(await cron.runContentAutomationCron({ now: () => new Date("2026-10-04T23:30:00.000Z") })).toHaveLength(0);
  });

  it("adicionar um horário vale para todos os dias selecionados", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await sharedAutomation(seed, { days: ["MONDAY", "TUESDAY", "WEDNESDAY"], times: ["08:00", "12:00"] });
    expect(await enabledRows(id)).toHaveLength(6);

    await service.updateSharedAutomation(id, seed.userId, {
      schedule: { days: ["MONDAY", "TUESDAY", "WEDNESDAY"], times: ["08:00", "12:00", "19:00"] },
    });
    const rows = await enabledRows(id);
    expect(rows).toHaveLength(9);
    expect(rows.filter((row) => row.publish_time === "19:00")).toHaveLength(3);
  });

  it("pausar para todas as execuções; reativar retoma", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await sharedAutomation(seed, { days: ["WEDNESDAY"], times: ["08:00", "12:00"] });
    const now = () => new Date("2026-09-23T23:30:00.000Z");

    await service.pauseAutomation(id, seed.userId, { cancelScheduledRuns: false });
    expect(await cron.runContentAutomationCron({ now })).toHaveLength(0);

    await service.activateAutomation(id, seed.userId);
    expect(await cron.runContentAutomationCron({ now })).toHaveLength(2);
  });

  it("excluir a automação para as execuções futuras", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await sharedAutomation(seed, { days: ["WEDNESDAY"], times: ["08:00"] });
    await service.deleteAutomation(id, seed.userId);
    expect(await cron.runContentAutomationCron({ now: () => new Date("2026-09-23T23:30:00.000Z") })).toHaveLength(0);
    expect(await db.sql`select id from content_automation_days where automation_id = ${id}`).toHaveLength(0);
  });

  it("trocar o horário depois que o antigo já rodou: o antigo não repete; o novo gera (atrasado, como no modo atual)", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await sharedAutomation(seed, { days: ["WEDNESDAY"], times: ["08:00"] });
    const now = () => new Date("2026-09-23T23:30:00.000Z");
    expect(await cron.runContentAutomationCron({ now })).toHaveLength(1);

    await service.updateSharedAutomation(id, seed.userId, { schedule: { days: ["WEDNESDAY"], times: ["09:00"] } });
    // O 08:00 já tem execução e sai da agenda; o 09:00 é um horário novo e gera uma vez (atrasado).
    expect(await cron.runContentAutomationCron({ now })).toHaveLength(1);
    expect(await cron.runContentAutomationCron({ now })).toHaveLength(0);
    expect(await enabledRows(id)).toHaveLength(1);
    const runs = await db.sql`select id from automation_runs where automation_id = ${id}`;
    expect(runs).toHaveLength(2); // histórico do 08:00 preservado
  });
});

describe("troca de modo", () => {
  it("de Prompt único para Personalizado copia o prompt para as linhas habilitadas", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await sharedAutomation(seed, { days: ["MONDAY", "TUESDAY"], times: ["08:00"] }, { activate: false });
    await service.updateAutomation(id, seed.userId, { scheduleMode: "CUSTOM" });
    const rows = await enabledRows(id);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.prompt === PROMPT)).toBe(true);
  });

  it("não troca de modo com a automação ATIVA", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await sharedAutomation(seed, { days: ["MONDAY"], times: ["08:00"] });
    await expect(service.updateAutomation(id, seed.userId, { scheduleMode: "CUSTOM" })).rejects.toThrow("Pause a automação");
  });
});

describe("cenários de agenda (contagem semanal exata)", () => {
  // Segunda 2026-09-21 a domingo 2026-09-27; 20:30 em São Paulo = 23:30Z (todos os horários de teste já na janela).
  async function runWeek() {
    let total = 0;
    for (let day = 21; day <= 27; day += 1) {
      total += (await cron.runContentAutomationCron({ now: () => new Date(`2026-09-${day}T23:30:00.000Z`) })).length;
    }
    return total;
  }

  it("1 dia + 1 horário = 1 execução por semana", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await sharedAutomation(seed, { days: ["THURSDAY"], times: ["08:00"] });
    expect(await runWeek()).toBe(1);
    expect(fakeProvider.generatePost).toHaveBeenCalledTimes(1);
    expect(await enabledRows(id)).toHaveLength(1);
  });

  it("7 dias + 1 horário = 7 execuções por semana", async () => {
    const seed = await seedUserWithAccount(db);
    await sharedAutomation(seed, { days: ALL_DAYS, times: ["08:00"] });
    expect(await runWeek()).toBe(7);
  });

  it("dias alternados (seg, qua, sex) × 2 horários = 6 execuções, só nesses dias", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await sharedAutomation(seed, { days: ["MONDAY", "WEDNESDAY", "FRIDAY"], times: ["08:00", "19:00"] });
    expect(await runWeek()).toBe(6);
    const runs = await db.sql`select to_char(run_date, 'YYYY-MM-DD') as run_date from automation_runs where automation_id = ${id} order by run_date`;
    expect(runs.map((run) => run.run_date)).toEqual([
      "2026-09-21", "2026-09-21", "2026-09-23", "2026-09-23", "2026-09-25", "2026-09-25",
    ]);
  });

  it("remover e readicionar um horário reaproveita a linha (sem acumular registros)", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await sharedAutomation(seed, { days: ["MONDAY"], times: ["08:00", "19:00"] });
    const rowsAt = async () => (await db.sql`select id from content_automation_days where automation_id = ${id}`).length;
    const before = await rowsAt();

    await service.updateSharedAutomation(id, seed.userId, { schedule: { days: ["MONDAY"], times: ["08:00"] } });
    expect(await enabledRows(id)).toHaveLength(1);
    await service.updateSharedAutomation(id, seed.userId, { schedule: { days: ["MONDAY"], times: ["08:00", "19:00"] } });
    expect(await enabledRows(id)).toHaveLength(2);
    expect(await rowsAt()).toBe(before);
  });

  it("trocar horários muitas vezes nunca passa de 6 linhas por dia e mantém exatamente dias × horários habilitados", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await sharedAutomation(seed, { days: ["TUESDAY"], times: ["06:00"] });
    // Cria histórico em cada rodada para impedir o reaproveitamento "sem execução".
    const rounds = ["07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00"];
    for (let index = 0; index < rounds.length; index += 1) {
      await service.updateSharedAutomation(id, seed.userId, { schedule: { days: ["TUESDAY"], times: [rounds[index]] } });
      await db.sql`
        insert into automation_runs (automation_id, automation_day_id, instagram_account_id, run_date)
        select automation_id, id, ${seed.accountId}, ${`2026-08-${String(index + 1).padStart(2, "0")}`}::date
        from content_automation_days where automation_id = ${id} and enabled = true
      `;
      expect(await enabledRows(id)).toHaveLength(1);
    }
    const tuesdayRows = await db.sql`select id from content_automation_days where automation_id = ${id} and day_of_week = 'TUESDAY'`;
    expect(tuesdayRows.length).toBeLessThanOrEqual(6);
  });
});
