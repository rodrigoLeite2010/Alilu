// SmartStoryEngine — serviço + histórico contra um Postgres REAL em memória
// (PGlite, mesmas migrações de produção). Só a IA é simulada.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedUserWithAccount, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({
  getDb: () => db.sql,
  assertDatabaseConfigured: () => undefined,
}));

const service = await import("@/lib/content-automation/backend/automation-service");
const smart = await import("@/lib/content-automation/backend/smart-story-service");
const repo = await import("@/lib/content-automation/backend/smart-story-repository");
const { STORY_TYPES } = await import("@/lib/content-automation/smart-story");

type Seed = Awaited<ReturnType<typeof seedUserWithAccount>>;

async function newAutomation(seed: Seed) {
  return service.createAutomation({
    userId: seed.userId,
    instagramAccountId: seed.accountId,
    name: "Stories inteligentes",
    timezone: "America/Sao_Paulo",
    generationLeadMinutes: 120,
    imageMode: "FIXED_IMAGE",
    fixedImageMediaId: seed.mediaId,
    scheduleMode: "SHARED_PROMPT",
  });
}

/** IA falsa que responde com conteúdo válido para o tipo pedido no prompt. */
function aiForPrompt() {
  let counter = 0;
  return vi.fn(async (prompt: string) => {
    counter += 1;
    const type = STORY_TYPES.find((candidate) => prompt.includes(`(${candidate})`)) ?? "REFLECTION";
    return {
      content: {
        type,
        headline: `Título único ${counter}`,
        body: type === "CHECKLIST" ? "um\ndois\ntrês" : "Corpo curto.",
        optionA: "Opção A",
        optionB: "Opção B",
        cta: `CTA número ${counter}`,
        visualMood: "emotional",
        topic: `assunto ${counter}`,
      },
      usage: { provider: "anthropic", model: "test", tokensInput: 1, tokensOutput: 1 },
    };
  });
}

function input(seed: Seed, automationId: string, scheduledAt: string, time: string, callAi: ReturnType<typeof aiForPrompt>) {
  return {
    userId: seed.userId,
    automationId,
    runId: null,
    scheduledAt: new Date(scheduledAt),
    time,
    rawConfig: {},
    basePrompt: "Fale de gratidão.",
    brandContext: "",
    callAi,
  };
}

beforeEach(async () => {
  db = await createTestDb();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});
afterEach(async () => {
  await db.close();
  vi.restoreAllMocks();
});

describe("migração 0034", () => {
  it("automações existentes ficam com o modo inteligente DESLIGADO e config vazia", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await newAutomation(seed);
    const [row] = await db.sql`select smart_story_enabled, smart_story_config from content_automations where id = ${id}`;
    expect(row.smart_story_enabled).toBe(false);
    expect(row.smart_story_config).toEqual({});
  });
});

describe("prepareSmartStory", () => {
  it("planeja, chama a IA, grava e devolve o Story estruturado", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await newAutomation(seed);
    const callAi = aiForPrompt();
    const result = await smart.prepareSmartStory(input(seed, id, "2026-10-07T11:00:00Z", "08:00", callAi));
    expect(result.created).toBe(true);
    expect(callAi).toHaveBeenCalledTimes(1);
    expect(result.record).toMatchObject({ status: "GENERATED", source: "AI", layout: "SINGLE", sequenceCount: 1 });
    expect(["REFLECTION", "EMOTIONAL_QUESTION", "ADVICE", "MINI_STORY"]).toContain(result.record.content.type); // faixa das 08:00
    expect(result.record.promptUsed).toContain("Fale de gratidão.");
    expect(result.usages).toHaveLength(1);
  });

  it("cron duplicado / retry do MESMO horário reaproveita o mesmo Story, sem nova IA", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await newAutomation(seed);
    const callAi = aiForPrompt();
    const first = await smart.prepareSmartStory(input(seed, id, "2026-10-07T11:00:00Z", "08:00", callAi));
    const again = await smart.prepareSmartStory(input(seed, id, "2026-10-07T11:00:00Z", "08:00", callAi));
    expect(again.created).toBe(false);
    expect(again.record.id).toBe(first.record.id);
    expect(again.record.content).toEqual(first.record.content);
    expect(callAi).toHaveBeenCalledTimes(1);
    const rows = await db.sql`select count(*)::int as n from smart_story_generations`;
    expect(rows[0].n).toBe(1);
  });

  it("duas execuções SIMULTÂNEAS do mesmo horário gravam uma linha só e devolvem o mesmo Story", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await newAutomation(seed);
    const [a, b] = await Promise.all([
      smart.prepareSmartStory(input(seed, id, "2026-10-07T11:00:00Z", "08:00", aiForPrompt())),
      smart.prepareSmartStory(input(seed, id, "2026-10-07T11:00:00Z", "08:00", aiForPrompt())),
    ]);
    expect(a.record.id).toBe(b.record.id);
    expect((await db.sql`select count(*)::int as n from smart_story_generations`)[0].n).toBe(1);
  });

  it("vários horários no mesmo dia e vários dias: nunca repete tipo seguido nem título", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await newAutomation(seed);
    const callAi = aiForPrompt();
    const slots = [
      ["2026-10-07T11:00:00Z", "08:00"],
      ["2026-10-07T15:00:00Z", "12:00"],
      ["2026-10-07T22:00:00Z", "19:00"],
      ["2026-10-08T11:00:00Z", "08:00"],
      ["2026-10-08T15:00:00Z", "12:00"],
      ["2026-10-08T22:00:00Z", "19:00"],
      ["2026-10-09T11:00:00Z", "08:00"],
      ["2026-10-09T15:00:00Z", "12:00"],
      ["2026-10-09T22:00:00Z", "19:00"],
    ];
    const created = [];
    for (const [at, time] of slots) created.push((await smart.prepareSmartStory(input(seed, id, at, time, callAi))).record);
    for (let index = 1; index < created.length; index += 1) {
      expect(created[index].content.type).not.toBe(created[index - 1].content.type);
    }
    expect(new Set(created.map((record) => record.content.headline)).size).toBe(created.length);
    expect(new Set(created.map((record) => record.content.cta)).size).toBeGreaterThan(5);
  });

  it("o histórico (últimos Stories) entra no prompt da IA", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await newAutomation(seed);
    const callAi = aiForPrompt();
    const first = await smart.prepareSmartStory(input(seed, id, "2026-10-07T11:00:00Z", "08:00", callAi));
    await smart.prepareSmartStory(input(seed, id, "2026-10-07T15:00:00Z", "12:00", callAi));
    expect(callAi.mock.calls[1][0]).toContain(first.record.content.headline);
  });

  it("reprocessar um horário ANTIGO não enxerga Stories do futuro", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await newAutomation(seed);
    const callAi = aiForPrompt();
    await smart.prepareSmartStory(input(seed, id, "2026-10-09T11:00:00Z", "08:00", callAi));
    await smart.prepareSmartStory(input(seed, id, "2026-10-07T11:00:00Z", "08:00", callAi));
    expect(callAi.mock.calls[1][0]).not.toContain("Título único 1");
  });

  it("falha da IA → grava FALLBACK com o motivo, sem lançar (a automação não aborta)", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await newAutomation(seed);
    const callAi = vi.fn(async () => {
      throw new Error("O provedor de IA respondeu com erro (HTTP 500).");
    });
    const result = await smart.prepareSmartStory(input(seed, id, "2026-10-07T11:00:00Z", "08:00", callAi as never));
    expect(result.record.source).toBe("FALLBACK");
    expect(result.record.generationError).toContain("HTTP 500");
    expect(result.record.content.headline).toBeTruthy();
    expect(callAi).toHaveBeenCalledTimes(2);
  });

  it("retorno inválido da IA → retry → aceita; attempts = 2", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await newAutomation(seed);
    const good = aiForPrompt();
    const callAi = vi
      .fn()
      .mockResolvedValueOnce({ content: { oops: true } })
      .mockImplementationOnce(good);
    const result = await smart.prepareSmartStory(input(seed, id, "2026-10-07T11:00:00Z", "08:00", callAi as never));
    expect(result.record).toMatchObject({ source: "AI", attempts: 2 });
  });

  it("configuração personalizada vale (só CTA e ADVICE habilitados à noite)", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await newAutomation(seed);
    const result = await smart.prepareSmartStory({
      ...input(seed, id, "2026-10-07T22:00:00Z", "19:00", aiForPrompt()),
      rawConfig: { enabledTypes: ["ADVICE"] , timeBuckets: [{ id: "all", fromMinute: 0, toMinute: 1440, types: ["ADVICE", "CTA"] }] },
    });
    expect(result.record.content.type).toBe("ADVICE");
  });

  it("a semente é estável por (automação, horário UTC) — mesmo horário local em fusos diferentes são slots diferentes", async () => {
    expect(smart.storySeed("a", new Date("2026-10-07T11:00:00Z"))).toBe(smart.storySeed("a", new Date("2026-10-07T11:00:00Z")));
    expect(smart.storySeed("a", new Date("2026-10-07T11:00:00Z"))).not.toBe(smart.storySeed("a", new Date("2026-10-07T10:00:00Z")));
  });
});

describe("status do Story (Generated → … → Published)", () => {
  it("avança sem apagar o que já foi preenchido", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await newAutomation(seed);
    const { record } = await smart.prepareSmartStory(input(seed, id, "2026-10-07T11:00:00Z", "08:00", aiForPrompt()));
    await repo.updateSmartStoryProgress(record.id, { status: "RENDERING" });
    await repo.updateSmartStoryProgress(record.id, { status: "READY", templateId: "reflection-v1", imageUrl: "https://blob/x.jpg" });
    await repo.updateSmartStoryProgress(record.id, { status: "PUBLISHED", instagramMediaId: "178", publishedAt: new Date("2026-10-07T11:01:00Z") });
    const final = await repo.getSmartStoryForSlot(id, new Date("2026-10-07T11:00:00Z"));
    expect(final).toMatchObject({
      status: "PUBLISHED",
      templateId: "reflection-v1",
      imageUrl: "https://blob/x.jpg",
      instagramMediaId: "178",
    });
    expect(final?.publishedAt?.toISOString()).toBe("2026-10-07T11:01:00.000Z");
  });

  it("rejeita status fora dos seis permitidos (check do banco)", async () => {
    const seed = await seedUserWithAccount(db);
    const id = await newAutomation(seed);
    const { record } = await smart.prepareSmartStory(input(seed, id, "2026-10-07T11:00:00Z", "08:00", aiForPrompt()));
    await expect(repo.updateSmartStoryProgress(record.id, { status: "WHATEVER" as never })).rejects.toThrow();
  });
});
