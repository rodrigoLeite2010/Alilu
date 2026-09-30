// @vitest-environment node
//
// Testa a rota GET /api/billing/automation-access mockando auth() e o
// serviço de acesso — confere só a parte da rota (401 sem sessão,
// repasse do resultado serializado em JSON).
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

const canUseAutomationMock = vi.fn();
vi.mock("@/lib/billing/backend/automation-access-service", () => ({
  canUseAutomation: (...args: unknown[]) => canUseAutomationMock(...args),
}));

const { GET } = await import("@/app/api/billing/automation-access/route");

beforeEach(() => {
  authMock.mockReset();
  canUseAutomationMock.mockReset();
});

describe("GET /api/billing/automation-access", () => {
  it("responde 401 sem sessão, sem consultar o serviço de acesso", async () => {
    authMock.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(canUseAutomationMock).not.toHaveBeenCalled();
  });

  it("devolve o status serializado (datas em ISO) para o usuário autenticado", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    canUseAutomationMock.mockResolvedValue({
      allowed: true,
      status: "TRIAL",
      reason: null,
      trialEndsAt: new Date("2026-09-30T12:00:00.000Z"),
      remainingToday: 2,
      currentPeriodEndsAt: null,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(canUseAutomationMock).toHaveBeenCalledWith("user-1");
    expect(body).toEqual({
      allowed: true,
      status: "TRIAL",
      reason: null,
      trialEndsAt: "2026-09-30T12:00:00.000Z",
      remainingToday: 2,
      currentPeriodEndsAt: null,
    });
  });
});
