import { afterEach, describe, expect, it, vi } from "vitest";
import { generateCaptionWithAI, PlanRequiredError } from "@/lib/instagram/client/publication-api";

function respond(status: number, body: unknown) {
  global.fetch = vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body }) as unknown as typeof fetch;
}

describe("generateCaptionWithAI — convite de plano", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("403 com código de plano vira PlanRequiredError (a tela mostra 'Ver planos')", async () => {
    respond(403, { error: "A IA faz parte dos planos Criador e Pro.", code: "AI_PLAN_REQUIRED" });
    const error = await generateCaptionWithAI("promoção").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PlanRequiredError);
    expect((error as PlanRequiredError).code).toBe("AI_PLAN_REQUIRED");
    expect((error as PlanRequiredError).message).toContain("Criador");
  });

  it("401 pede para entrar (LOGIN_REQUIRED)", async () => {
    respond(401, { error: "Não autenticado." });
    const error = await generateCaptionWithAI("x").catch((e: unknown) => e);
    expect((error as PlanRequiredError).code).toBe("LOGIN_REQUIRED");
  });

  it("outro erro continua sendo um Error comum", async () => {
    respond(500, { error: "Falhou." });
    const error = await generateCaptionWithAI("x").catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(PlanRequiredError);
    expect((error as Error).message).toBe("Falhou.");
  });
});
