// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const tick = vi.fn(async () => ({ runs: [{ radarId: "r1", status: "SUCCEEDED", message: "ok", queued: 2 }], monitor: { checked: 1, saved: 1 }, abandoned: 0 }));
vi.mock("@/lib/viral-radar/backend/radar-cron", () => ({ runViralRadarTick: (...args: unknown[]) => tick(...(args as [])) }));

const route = await import("@/app/api/cron/viral-radar/route");

describe("/api/cron/viral-radar", () => {
  it("exige o segredo do cron e executa o radar", async () => {
    vi.stubEnv("CRON_SECRET", "segredo-de-teste-123456");
    expect((await route.POST(new Request("https://alilu.com.br/api/cron/viral-radar", { method: "POST" }))).status).toBe(401);
    expect((await route.POST(new Request("https://alilu.com.br/api/cron/viral-radar", { method: "POST", headers: { authorization: "Bearer errado-errado-errado" } }))).status).toBe(401);
    expect(tick).not.toHaveBeenCalled();
    const response = await route.POST(new Request("https://alilu.com.br/api/cron/viral-radar", { method: "POST", headers: { authorization: "Bearer segredo-de-teste-123456" } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ runs: [{ radarId: "r1", queued: 2 }], monitored: 1 });
    vi.unstubAllEnvs();
  });
});
