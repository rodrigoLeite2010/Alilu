// @vitest-environment node
// Legibilidade — reescrita com IA (fase 2): prompt, interpretação da
// resposta, limites e erros. Nunca testa o texto literal da IA; o provedor
// é falso e o banco é Postgres real em memória (PGlite).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/db/client", () => ({ getDb: () => db.sql, assertDatabaseConfigured: () => undefined }));
const rewriteMock = vi.fn();
let providerHasRewrite = true;
let providerConfigured = true;
vi.mock("@/lib/content-automation/backend/provider-factory", async () => {
  const { AIProviderConfigError } = await import("@/lib/content-automation/backend/ai-provider");
  return {
    getContentAIProvider: () => {
      if (!providerConfigured) throw new AIProviderConfigError("CONTENT_AI_API_KEY não está configurada.");
      return providerHasRewrite ? { rewriteText: (...a: unknown[]) => rewriteMock(...a) } : {};
    },
  };
});

const { AIProviderRequestError } = await import("@/lib/content-automation/backend/ai-provider");
const service = await import("@/lib/text/readability/backend/rewrite-service");
const { buildRewritePrompt, findMissingFacts, parseRewriteContent } = await import("@/lib/text/readability/rewrite-prompt");

const HARD =
  "Considerando-se a imprescindibilidade da implementação de metodologias concernentes à otimização dos procedimentos, faz-se necessário que os colaboradores efetuem a verificação minuciosa das funcionalidades disponibilizadas até 15/10, conforme www.alilu.com.br.";
const EASY = "Precisamos melhorar o trabalho. A equipe deve conferir tudo até 15/10 em www.alilu.com.br.";
const usage = { provider: "anthropic", model: "x", tokensInput: 1, tokensOutput: 1 };

let userId: string;
const ORIGINAL_ADMINS = process.env.ADMIN_EMAILS;
beforeEach(async () => {
  db = await createTestDb();
  const [user] = await db.sql`insert into users (email) values ('leitor@example.com') returning id`;
  userId = user.id as string;
  rewriteMock.mockReset();
  providerHasRewrite = true;
  providerConfigured = true;
  delete process.env.READABILITY_AI_DISABLED;
  process.env.ADMIN_EMAILS = "dono@alilu.com.br";
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(async () => {
  process.env.ADMIN_EMAILS = ORIGINAL_ADMINS;
  vi.restoreAllMocks();
  await db.close();
});

const user = () => ({ userId, email: "leitor@example.com" });

describe("prompt e resposta", () => {
  it("prompt traz objetivo, público, regras de preservação e o formato JSON", () => {
    const prompt = buildRewritePrompt("Texto X", "simplify", "child10");
    expect(prompt).toMatch(/criança de aproximadamente 10 anos/);
    expect(prompt).toMatch(/Não infantilize/);
    expect(prompt).toMatch(/não invente fatos/);
    expect(prompt).toMatch(/não altere números, datas, URLs, e-mails nem valores monetários/);
    expect(prompt).toMatch(/\{"text": string\}/);
    expect(prompt).toContain("<<<\nTexto X\n>>>");
    expect(buildRewritePrompt("x", "reels", "general")).toMatch(/\{"hook": string, "body": string, "cta": string\}/);
    expect(buildRewritePrompt("x", "hook", "general")).toMatch(/SOMENTE uma abertura curta/);
  });

  it("interpreta JSON da IA; vazio vira null", () => {
    expect(parseRewriteContent("simplify", { text: "  Novo  " })).toEqual({ text: "Novo", parts: null });
    expect(parseRewriteContent("simplify", { text: "" })).toBeNull();
    expect(parseRewriteContent("reels", { hook: "G", body: "C", cta: "A" })).toEqual({ text: "G\n\nC\n\nA", parts: { hook: "G", body: "C", cta: "A" } });
    expect(parseRewriteContent("reels", {})).toBeNull();
  });

  it("aponta números/links que sumiram na reescrita", () => {
    expect(findMissingFacts("Pague R$ 50,00 até 10/12 em www.a.com.", "Pague até 10/12.")).toEqual(["50,00", "www.a.com"]);
  });
});

describe("rewriteText", () => {
  it("sucesso: reanalisa antes × depois, marca melhoria e registra só metadados (nunca o texto)", async () => {
    rewriteMock.mockResolvedValue({ content: { text: EASY }, usage });
    const result = await service.rewriteText(user(), { text: HARD, goal: "simplify", audience: "general" });
    expect(result.text).toBe(EASY);
    expect(result.after.score!).toBeGreaterThan(result.before.score!);
    expect(result.improved).toBe(true);
    expect(result.missingFacts).toEqual([]);
    expect(result.quota).toMatchObject({ used: 1, limit: 30, unlimited: false });
    expect(rewriteMock.mock.calls[0][0].prompt).toContain(HARD);
    const [row] = await db.sql`select * from readability_rewrites`;
    expect(row).toMatchObject({ success: true, goal: "simplify", character_count: HARD.length });
    expect(JSON.stringify(row)).not.toContain("imprescindibilidade");
    const logs = vi.mocked(console.info).mock.calls.map((c) => String(c[0])).join(" ");
    expect(logs).not.toContain("imprescindibilidade");
  });

  it("versão pior não é anunciada como melhoria", async () => {
    rewriteMock.mockResolvedValue({ content: { text: HARD }, usage });
    const result = await service.rewriteText(user(), { text: EASY, goal: "persuasive" });
    expect(result.improved).toBe(false);
  });

  it.each([
    ["resposta vazia", async () => rewriteMock.mockResolvedValue({ content: { text: "" }, usage }), "EMPTY_RESPONSE", 502],
    ["timeout", async () => rewriteMock.mockRejectedValue(new AIProviderRequestError("Tempo esgotado ao gerar conteúdo com IA. Tente novamente.")), "TIMEOUT", 504],
    ["erro do provedor", async () => rewriteMock.mockRejectedValue(new AIProviderRequestError("O provedor de IA respondeu com erro (HTTP 500).")), "PROVIDER_ERROR", 502],
    ["sem configuração", async () => { providerConfigured = false; }, "NOT_CONFIGURED", 503],
    ["provedor sem reescrita", async () => { providerHasRewrite = false; }, "NOT_SUPPORTED", 503],
  ])("%s → erro amigável e registro de falha (não conta no limite)", async (_name, arrange, code, status) => {
    await arrange();
    await expect(service.rewriteText(user(), { text: HARD })).rejects.toMatchObject({ code, status });
    const [row] = await db.sql`select success, error_code from readability_rewrites`;
    expect(row).toEqual({ success: false, error_code: code });
    expect((await service.getRewriteQuota(userId, "leitor@example.com")).used).toBe(0);
  });

  it("validação: texto vazio e texto acima de 5.000 caracteres (sem chamar a IA)", async () => {
    await expect(service.rewriteText(user(), { text: "  " })).rejects.toMatchObject({ code: "EMPTY", status: 400 });
    await expect(service.rewriteText(user(), { text: "a ".repeat(2600) })).rejects.toMatchObject({ code: "TOO_LONG", status: 413 });
    expect(rewriteMock).not.toHaveBeenCalled();
  });

  it("limite diário de 30 (admin sem limite) e IA desligada", async () => {
    await db.sql`
      insert into readability_rewrites (user_id, goal, audience, character_count, success)
      select ${userId}, 'simplify', 'general', 10, true from generate_series(1, 30)`;
    await expect(service.rewriteText(user(), { text: HARD })).rejects.toMatchObject({ code: "DAILY_LIMIT", status: 429 });
    rewriteMock.mockResolvedValue({ content: { text: EASY }, usage });
    const admin = await service.rewriteText({ userId, email: "DONO@alilu.com.br" }, { text: HARD });
    expect(admin.quota.unlimited).toBe(true);

    process.env.READABILITY_AI_DISABLED = "true";
    expect(service.isRewriteEnabled()).toBe(false);
    await expect(service.rewriteText(user(), { text: HARD })).rejects.toMatchObject({ code: "DISABLED", status: 503 });
  });

  it("objetivo/público inválidos caem no padrão (simplificar, geral)", async () => {
    rewriteMock.mockResolvedValue({ content: { text: EASY }, usage });
    await service.rewriteText(user(), { text: HARD, goal: "hackear", audience: "x" });
    const [row] = await db.sql`select goal, audience from readability_rewrites`;
    expect(row).toEqual({ goal: "simplify", audience: "general" });
  });
});
