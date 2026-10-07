// SmartStoryEngine — Fase 5: prévia (sem gravar nada), rota e diagnóstico admin.
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

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));
const canUse = vi.fn();
vi.mock("@/lib/billing/backend/automation-access-service", () => ({ canUseAutomation: (...a: unknown[]) => canUse(...a) }));

const preview = await import("@/lib/content-automation/backend/smart-story-preview");
const diagnostics = await import("@/lib/content-automation/backend/smart-story-diagnostics");
const route = await import("@/app/api/content-automation/smart-story/preview/route");
const { defaultSmartStoryConfig } = await import("@/lib/content-automation/smart-story/config");

function aiOk(headline = "Um recomeço gentil") {
  return async () => ({
    content: {
      type: "REFLECTION",
      headline,
      body: "Corpo curto.",
      optionA: "",
      optionB: "",
      cta: "Envie para quem precisa",
      visualMood: "emotional",
      topic: "recomeço",
    },
  });
}

async function tableCounts() {
  const rows = await db.sql`
    select
      (select count(*)::int from smart_story_generations) as stories,
      (select count(*)::int from instagram_posts) as posts,
      (select count(*)::int from instagram_media) as media
  `;
  return rows[0];
}

describe("buildSmartStoryPreview", () => {
  beforeEach(async () => {
    db = await createTestDb();
  });
  afterEach(async () => {
    await db.close();
    vi.clearAllMocks();
  });

  it("gera arte 1080×1920 e NÃO grava nada no banco", async () => {
    const seed = await seedUserWithAccount(db);
    const before = await tableCounts();
    const result = await preview.buildSmartStoryPreview({
      rawConfig: defaultSmartStoryConfig(),
      basePrompt: "gratidão",
      brandContext: "",
      time: "08:00",
      nonce: "a",
      userId: seed.userId,
      callAi: aiOk(),
    });
    expect(result.dataUrl.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(result.source).toBe("AI");
    expect(await tableCounts()).toEqual(before);
  });

  it("IA fora do ar → texto de reserva, sem lançar", async () => {
    const result = await preview.buildSmartStoryPreview({
      rawConfig: {},
      basePrompt: "",
      brandContext: "",
      time: "19:00",
      nonce: "b",
      userId: "u",
      callAi: async () => {
        throw new Error("fora do ar");
      },
    });
    expect(result.source).toBe("FALLBACK");
    expect(result.dataUrl).toContain("base64,");
  });

  it("'Gerar outro' não repete os tipos já mostrados quando há alternativa", async () => {
    const seen: string[] = [];
    for (let index = 0; index < 4; index += 1) {
      const result = await preview.buildSmartStoryPreview({
        rawConfig: {},
        basePrompt: "",
        brandContext: "",
        time: "08:00",
        nonce: `n${index}`,
        previousTypes: [...seen],
        userId: "u",
        callAi: async () => {
          throw new Error("x");
        },
      });
      expect(seen).not.toContain(result.plan.type);
      seen.push(result.plan.type);
    }
  });

  it("respeita os tipos habilitados da configuração (conta sem marca não sorteia tipos de convite)", async () => {
    const result = await preview.buildSmartStoryPreview({
      rawConfig: { enabledTypes: ["CTA", "VISUAL_POLL"] },
      basePrompt: "",
      brandContext: "",
      time: "08:00",
      nonce: "c",
      userId: "u",
      callAi: async () => {
        throw new Error("x");
      },
    });
    expect(result.plan.type).toBe("VISUAL_POLL");
  });
});

describe("POST /api/content-automation/smart-story/preview", () => {
  beforeEach(async () => {
    db = await createTestDb();
    authMock.mockResolvedValue({ user: { id: "u1" } });
    canUse.mockResolvedValue({ allowed: true, reason: null });
    fakeProvider.rewriteText.mockImplementation(async () => ({ content: (await aiOk()()).content }));
  });
  afterEach(async () => {
    await db.close();
    vi.clearAllMocks();
  });

  const post = (body: unknown) =>
    route.POST(new Request("http://t/api", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

  it("401 sem login", async () => {
    authMock.mockResolvedValue(null);
    expect((await post({})).status).toBe(401);
  });

  it("400 para corpo inválido e para configuração inválida", async () => {
    expect((await post("não é json")).status).toBe(400);
    expect((await post({ config: { enabledTypes: ["NADA"] } })).status).toBe(400);
  });

  it("403 sem teste/assinatura e sem chamar a IA", async () => {
    canUse.mockResolvedValue({ allowed: false, reason: "Assine para continuar." });
    const response = await post({});
    expect(response.status).toBe(403);
    expect(fakeProvider.rewriteText).not.toHaveBeenCalled();
  });

  it("200 com a arte e sem gravar nada", async () => {
    const seed = await seedUserWithAccount(db);
    const before = await tableCounts();
    const response = await post({ config: {}, basePrompt: "gratidão", time: "08:00", nonce: "x" });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { dataUrl: string; plan: { type: string } };
    expect(body.dataUrl).toContain("data:image/jpeg;base64,");
    expect(body.plan.type).toBeTruthy();
    expect(await tableCounts()).toEqual(before);
    expect(seed.userId).toBeTruthy();
  });
});

describe("getSmartStoryDiagnostics", () => {
  beforeEach(async () => {
    db = await createTestDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it("sem dados: tudo zerado", async () => {
    const diag = await diagnostics.getSmartStoryDiagnostics(30);
    expect(diag.total).toBe(0);
    expect(diag.recentProblems).toEqual([]);
    expect(diag.automationsEnabled).toBe(0);
  });
});
