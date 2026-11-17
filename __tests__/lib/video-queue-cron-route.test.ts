// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const run = vi.fn();
vi.mock("@/lib/video-queue/backend/queue-cron", () => ({ runVideoQueueCron: (...args: unknown[]) => run(...args) }));

const { POST, GET } = await import("@/app/api/cron/video-queue/route");
const SECRET = "segredo-de-teste-com-32-caracteres!!";

afterEach(() => {
  vi.unstubAllEnvs();
  run.mockReset();
});

describe("/api/cron/video-queue", () => {
  it("sem o segredo: 401 e nada roda", async () => {
    vi.stubEnv("INSTAGRAM_SCHEDULER_SECRET", SECRET);
    expect((await POST(new Request("https://alilu.com.br/api/cron/video-queue", { method: "POST" }))).status).toBe(401);
    expect((await GET(new Request(`https://alilu.com.br/api/cron/video-queue?secret=${SECRET}`))).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("com o segredo: roda a fila e resume o resultado", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    run.mockResolvedValue({
      planned: [{ queueId: "q1", status: "ACTIVE", published: 1, cancelled: 0, scheduled: 2 }],
      imports: [{ itemId: "i1", queueId: "q1", status: "READY" }],
    });
    const response = await POST(new Request("https://alilu.com.br/api/cron/video-queue", { method: "POST", headers: { authorization: `Bearer ${SECRET}` } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ planned: 1, scheduled: 2, published: 1, paused: [], imports: [{ itemId: "i1", status: "READY", code: null }] });
  });
});
