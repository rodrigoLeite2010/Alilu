// @vitest-environment node
// Telemetria de upload: aceita só valores conhecidos e grava metadados (nunca nome do arquivo).
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "user-1" } }) }));
const sqlMock = vi.fn(async () => []);
vi.mock("@/lib/db/client", () => ({ getDb: () => sqlMock }));

const { POST } = await import("@/app/api/client-events/route");

function post(body: unknown) {
  return POST(new Request("https://alilu.com.br/api/client-events", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "user-agent": "Mozilla/5.0 (Linux; Android 14; SM-A546E)" } }));
}

describe("POST /api/client-events", () => {
  beforeEach(() => {
    sqlMock.mockClear();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("grava um evento válido com o navegador", async () => {
    const response = await post({ tool: "split-screen", stage: "upload_error", fileType: "video/mp4", fileExt: "mp4", fileSize: 1234, message: "Failed to fetch", pageSession: "abc" });
    expect(response.status).toBe(200);
    expect(sqlMock).toHaveBeenCalledTimes(1);
    const values = (sqlMock.mock.calls[0] as unknown[]).slice(1);
    expect(values).toEqual(expect.arrayContaining(["split-screen", "upload_error", "video/mp4", "mp4", 1234, "Failed to fetch"]));
    expect(values.join(" ")).toContain("Android 14");
  });

  it("recusa ferramenta/etapa desconhecida, JSON inválido e corpo grande", async () => {
    expect((await post({ tool: "x", stage: "upload_error" })).status).toBe(400);
    expect((await post({ tool: "reels", stage: "hack" })).status).toBe(400);
    expect((await post("{nao-json")).status).toBe(400);
    expect((await post("x".repeat(5000))).status).toBe(413);
    expect(sqlMock).not.toHaveBeenCalled();
  });
});
