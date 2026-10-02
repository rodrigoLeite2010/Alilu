// @vitest-environment node
//
// Rotas da Agenda: exigem sessão e usam SEMPRE o userId da sessão (um
// userId enviado no corpo é ignorado). Cron exige Bearer.
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ value: null as null | { user: { id: string } } }));
vi.mock("@/auth", () => ({ auth: async () => session.value }));

const serviceMocks = vi.hoisted(() => ({
  createAgendaEvent: vi.fn(),
  listAgenda: vi.fn(),
  serializeEvent: vi.fn((event: unknown) => event),
}));
vi.mock("@/lib/agenda/backend/agenda-service", async (original) => ({ ...(await original<object>()), ...serviceMocks }));
const cronMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/agenda/backend/reminder-service", () => ({ runAgendaReminderCron: cronMock }));

const eventsRoute = await import("@/app/api/agenda/events/route");
const cronRoute = await import("@/app/api/cron/agenda-reminders/route");

beforeEach(() => {
  vi.clearAllMocks();
  session.value = null;
  process.env.AGENDA_CRON_SECRET = "segredo-do-cron-agenda-123";
});

describe("/api/agenda/events", () => {
  it("sem login: 401", async () => {
    const response = await eventsRoute.GET(new Request("https://x/api/agenda/events?from=2026-10-01T00:00:00Z&to=2026-10-31T00:00:00Z"));
    expect(response.status).toBe(401);
    expect(serviceMocks.listAgenda).not.toHaveBeenCalled();
  });

  it("POST usa o usuário da sessão, nunca o userId do corpo", async () => {
    session.value = { user: { id: "user-sessao" } };
    serviceMocks.createAgendaEvent.mockResolvedValue({ id: "e1" });
    const response = await eventsRoute.POST(
      new Request("https://x/api/agenda/events", { method: "POST", body: JSON.stringify({ title: "X", date: "2026-10-10", userId: "outro-usuario" }) }),
    );
    expect(response.status).toBe(201);
    expect(serviceMocks.createAgendaEvent.mock.calls[0][0]).toBe("user-sessao");
  });
});

describe("/api/cron/agenda-reminders", () => {
  it("sem Bearer ou com segredo errado: 401 e não roda", async () => {
    expect((await cronRoute.GET(new Request("https://x/api/cron/agenda-reminders"))).status).toBe(401);
    expect((await cronRoute.GET(new Request("https://x", { headers: { authorization: "Bearer segredo-errado-errado-1" } }))).status).toBe(401);
    expect(cronMock).not.toHaveBeenCalled();
  });

  it("com o segredo certo roda o job", async () => {
    cronMock.mockResolvedValue({ claimed: 0, sent: 0, retried: 0, failed: 0, skipped: 0, scheduled: 0 });
    const response = await cronRoute.GET(new Request("https://x", { headers: { authorization: "Bearer segredo-do-cron-agenda-123" } }));
    expect(response.status).toBe(200);
    expect(cronMock).toHaveBeenCalledTimes(1);
  });
});
