// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { newTrip } from "@/lib/viagens/planner";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), save: vi.fn(), remove: vi.fn(), quota: vi.fn(), route: vi.fn(), enabled: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUserId: mocks.auth, isUuid: (v: string) => /^[a-f0-9-]{36}$/.test(v) }));
vi.mock("@/lib/viagens/repository", () => ({ listTrips: mocks.list, saveTrip: mocks.save, deleteTrip: mocks.remove, claimRouteQuota: mocks.quota }));
vi.mock("@/lib/viagens/routing", () => ({ fetchRoadRoute: mocks.route, routingEnabled: mocks.enabled }));
const api = await import("@/app/api/viagens/route");
const routes = await import("@/app/api/viagens/rota/route");
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ userId: "owner" }); mocks.enabled.mockReturnValue(true); });
it("recusa acesso não autenticado antes de consultar o banco", async () => {
  mocks.auth.mockResolvedValue({ response: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) });
  expect((await api.GET()).status).toBe(401); expect(mocks.list).not.toHaveBeenCalled();
});
it("valida dados e evita salvar viagem inválida", async () => {
  const r = await api.POST(new Request("https://alilu.com.br/api/viagens", { method: "POST", body: JSON.stringify({ plan: { ...newTrip(), budget: -1 }, id: null, revision: 0, archived: false }) }));
  expect(r.status).toBe(400); expect(mocks.save).not.toHaveBeenCalled();
});
it("usa proprietário da sessão e responde conflito sem sobrescrever", async () => {
  mocks.save.mockResolvedValue(null);
  const r = await api.POST(new Request("https://alilu.com.br/api/viagens", { method: "POST", body: JSON.stringify({ plan: newTrip(), id: null, revision: 0, archived: false }) }));
  expect(r.status).toBe(409); expect(mocks.save.mock.calls[0][0]).toBe("owner");
});
it("mantém falhas de banco como indisponibilidade recuperável", async () => {
  mocks.list.mockRejectedValue(new Error("db")); expect((await api.GET()).status).toBe(503);
  expect((await api.DELETE(new Request("https://alilu.com.br/api/viagens?id=bad"))).status).toBe(400);
});
it("rejeita rotas inválidas e excesso de chamadas sem consultar provedor", async () => {
  const request = (body: unknown) => new Request("https://alilu.com.br/api/viagens/rota", { method: "POST", body: JSON.stringify(body) });
  expect((await routes.POST(request({ origin: "A" }))).status).toBe(400);
  mocks.quota.mockResolvedValue(false);
  expect((await routes.POST(request({ origin: "São Paulo", destination: "Rio", stops: [], roundTrip: true }))).status).toBe(429); expect(mocks.route).not.toHaveBeenCalled();
  mocks.enabled.mockReturnValue(false); expect((await routes.POST(request({}))).status).toBe(503);
});
