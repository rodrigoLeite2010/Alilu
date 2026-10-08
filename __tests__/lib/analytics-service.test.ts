import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const getAdminSession = vi.fn();
vi.mock("@/lib/admin/admin-access", () => ({ getAdminSession: () => getAdminSession() }));

const service = await import("@/lib/analytics/backend/analytics-service");
const summaryRoute = await import("@/app/api/admin/analytics/summary/route");
const pagesRoute = await import("@/app/api/admin/analytics/pages/route");
const recentRoute = await import("@/app/api/admin/analytics/recent/route");

const fetchMock = vi.fn();
const originalFetch = global.fetch;

function ok(results: unknown[][]) {
  return new Response(JSON.stringify({ columns: [], results }), { status: 200 });
}

beforeEach(() => {
  service.__clearAnalyticsCacheForTests();
  process.env.POSTHOG_PERSONAL_API_KEY = "phx_secret";
  process.env.POSTHOG_PROJECT_ID = "123";
  process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://us.i.posthog.com";
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  getAdminSession.mockReset().mockResolvedValue({ userId: "u", email: "admin@x.com" });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("analytics (PostHog) — serviço do admin", () => {
  it("resumo: visitantes, sessões, visualizações e online; chave privada só no header do servidor", async () => {
    fetchMock.mockResolvedValueOnce(ok([[184, 236, 1042, 12]]));
    const summary = await service.getAnalyticsSummary();
    expect(summary).toMatchObject({ visitorsToday: 184, sessionsToday: 236, pageViewsToday: 1042, onlineNow: 12, onlineWindowMinutes: 5 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://us.posthog.com/api/projects/123/query/");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer phx_secret" });
    expect(String((init as RequestInit).body)).toContain("interval 5 minute");
    expect(String((init as RequestInit).body)).toContain("environment = 'production'");
  });

  it("cache: duas leituras seguidas (inclusive simultâneas) fazem uma única consulta ao PostHog", async () => {
    fetchMock.mockResolvedValue(ok([[1, 1, 1, 1]]));
    await Promise.all([service.getAnalyticsSummary(), service.getAnalyticsSummary()]);
    await service.getAnalyticsSummary();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("páginas mais acessadas e últimos acessos (sem IP nem id de usuário)", async () => {
    fetchMock.mockResolvedValueOnce(ok([["/instagram/carrossel", 320], ["/instagram/reels", 218]]));
    expect(await service.getTopPages()).toEqual([
      { path: "/instagram/carrossel", views: 320 },
      { path: "/instagram/reels", views: 218 },
    ]);
    fetchMock.mockResolvedValueOnce(ok([["2026-10-08T12:00:00Z", "/agenda", true], ["2026-10-08T11:59:00Z", "/", null]]));
    const recent = await service.getRecentVisits();
    expect(recent.map((v) => [v.path, v.userType])).toEqual([["/agenda", "logged"], ["/", "anonymous"]]);
    expect(Object.keys(recent[0]).sort()).toEqual(["path", "time", "userType"]);
  });
});

describe("analytics — rotas do admin", () => {
  it("usuário comum / sem login: 403 e o PostHog nem é consultado", async () => {
    getAdminSession.mockResolvedValue(null);
    for (const route of [summaryRoute, pagesRoute, recentRoute]) {
      const response = await route.GET();
      expect(response.status).toBe(403);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("admin: recebe os dados", async () => {
    fetchMock.mockResolvedValueOnce(ok([[5, 6, 7, 2]]));
    const response = await summaryRoute.GET();
    expect(response.status).toBe(200);
    expect((await response.json()).data.visitorsToday).toBe(5);
  });

  it("falha do PostHog vira 502 amigável (sem vazar detalhes) e não fica em cache", async () => {
    fetchMock.mockRejectedValueOnce(new Error("boom phx_secret"));
    const response = await pagesRoute.GET();
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("phx_secret");
    fetchMock.mockResolvedValueOnce(ok([["/a", 1]]));
    expect((await pagesRoute.GET()).status).toBe(200);
  });

  it("sem variáveis do PostHog: responde configured=false, sem erro", async () => {
    delete process.env.POSTHOG_PERSONAL_API_KEY;
    const response = await summaryRoute.GET();
    expect(response.status).toBe(200);
    expect((await response.json()).configured).toBe(false);
  });
});
