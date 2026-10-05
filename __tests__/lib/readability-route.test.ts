// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/readability/analyze/route";

const call = (body: unknown) =>
  POST(new Request("http://localhost/api/readability/analyze", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

describe("POST /api/readability/analyze", () => {
  it("analisa e devolve nota, índices e contagens", async () => {
    const response = await call({ text: "O gato subiu no muro. Ele viu um pássaro." });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ words: 9, sentences: 2, level: expect.any(String) });
    expect(Object.keys(body.indexes)).toEqual(["flesch", "gulpease", "fleschKincaid", "gunningFog", "ari", "colemanLiau"]);
  });

  it("valida entrada (vazio, JSON inválido, limite) e nunca registra o texto no log", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    expect((await call({ text: "  " })).status).toBe(400);
    expect((await call("{oops")).status).toBe(400);
    expect((await call({ text: "a".repeat(20_001) })).status).toBe(413);
    await call({ text: "Texto secreto do usuário." });
    const logged = info.mock.calls.map((args) => String(args[0])).join(" ");
    expect(logged).toContain('"characterCount":25');
    expect(logged).not.toContain("secreto");
    info.mockRestore();
  });
});
