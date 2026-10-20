// @vitest-environment node
// Endpoints de exclusão em massa: autenticação, isolamento por usuário e regras de agendamento.
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ value: null as null | { user: { id: string } } }));
vi.mock("@/auth", () => ({ auth: async () => session.value }));

const repo = vi.hoisted(() => ({ getPostStatusForUser: vi.fn(), cancelPost: vi.fn() }));
vi.mock("@/lib/instagram/backend/instagram-post-repository", () => repo);
const service = vi.hoisted(() => {
  class InstagramPostValidationError extends Error {}
  return { deletePost: vi.fn(), InstagramPostValidationError };
});
vi.mock("@/lib/instagram/backend/instagram-post-service", () => service);

const automationRepo = vi.hoisted(() => ({ getAutomationForUser: vi.fn() }));
vi.mock("@/lib/content-automation/backend/automation-repository", () => automationRepo);
const runRepo = vi.hoisted(() => ({ cancelPendingRunsForAutomation: vi.fn() }));
vi.mock("@/lib/content-automation/backend/automation-run-repository", () => runRepo);
const automationService = vi.hoisted(() => {
  class AutomationValidationError extends Error {}
  return { deleteAutomation: vi.fn(), AutomationValidationError };
});
vi.mock("@/lib/content-automation/backend/automation-service", () => automationService);

vi.mock("server-only", () => ({}));
const posts = await import("@/app/api/instagram/posts/bulk-delete/route");
const automations = await import("@/app/api/content-automation/automations/bulk-delete/route");

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const C = "33333333-3333-3333-3333-333333333333";
const D = "44444444-4444-4444-4444-444444444444";

const req = (body: unknown) => new Request("https://x/bulk-delete", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  session.value = { user: { id: "user-1" } };
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("POST /api/instagram/posts/bulk-delete", () => {
  it("sem login: 401 e nada é tocado", async () => {
    session.value = null;
    expect((await posts.POST(req({ ids: [A] }))).status).toBe(401);
    expect(repo.getPostStatusForUser).not.toHaveBeenCalled();
  });

  it("corpo inválido / lista vazia: 400", async () => {
    expect((await posts.POST(req({ ids: [] }))).status).toBe(400);
    expect((await posts.POST(new Request("https://x", { method: "POST", body: "{" }))).status).toBe(400);
  });

  it("agendada é cancelada ANTES de excluir; rascunho e publicada só excluem; sempre com o userId da sessão", async () => {
    const status: Record<string, string> = { [A]: "SCHEDULED", [B]: "DRAFT", [C]: "PUBLISHED" };
    repo.getPostStatusForUser.mockImplementation(async (id: string) => status[id] ?? null);
    const order: string[] = [];
    repo.cancelPost.mockImplementation(async (id: string) => { order.push(`cancel:${id}`); return true; });
    service.deletePost.mockImplementation(async (id: string) => { order.push(`delete:${id}`); });

    const body = await (await posts.POST(req({ ids: [A, B, C], userId: "outro-usuario" }))).json();

    expect(body).toEqual({ deleted: [A, B, C], failed: [] });
    expect(order.indexOf(`cancel:${A}`)).toBeLessThan(order.indexOf(`delete:${A}`));
    expect(order).not.toContain(`cancel:${B}`);
    expect(order).not.toContain(`cancel:${C}`);
    for (const call of [...repo.getPostStatusForUser.mock.calls, ...repo.cancelPost.mock.calls, ...service.deletePost.mock.calls]) {
      expect(call[1]).toBe("user-1");
    }
  });

  it("em processamento é recusada com motivo; item de outro usuário/inexistente não é apagado (idempotente)", async () => {
    repo.getPostStatusForUser.mockImplementation(async (id: string) => (id === A ? "PROCESSING" : id === B ? null : "DRAFT"));
    service.deletePost.mockResolvedValue(undefined);
    const body = await (await posts.POST(req({ ids: [A, B, C] }))).json();
    expect(body.failed).toEqual([{ id: A, reason: expect.stringContaining("processamento") }]);
    expect(body.deleted).toEqual([B, C]);
    expect(service.deletePost).toHaveBeenCalledTimes(1);
    expect(service.deletePost).toHaveBeenCalledWith(C, "user-1");
  });

  it("falha parcial inesperada não derruba o lote e não vaza detalhes", async () => {
    repo.getPostStatusForUser.mockResolvedValue("DRAFT");
    service.deletePost.mockImplementation(async (id: string) => { if (id === B) throw new Error("db password=123"); });
    const body = await (await posts.POST(req({ ids: [A, B, C] }))).json();
    expect(body.deleted).toEqual([A, C]);
    expect(body.failed).toEqual([{ id: B, reason: "Não foi possível excluir agora." }]);
  });

  it("registra evento de auditoria sem dados pessoais", async () => {
    repo.getPostStatusForUser.mockResolvedValue("DRAFT");
    service.deletePost.mockResolvedValue(undefined);
    await posts.POST(req({ ids: [A, B] }));
    const logged = JSON.parse((console.info as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
    expect(logged).toEqual({ event: "bulk_delete", module: "instagram-posts", userId: "user-1", requested: 2, deleted: 2, failed: 0 });
  });
});

describe("POST /api/content-automation/automations/bulk-delete", () => {
  it("só cancela execuções pendentes e exclui automações do próprio usuário", async () => {
    automationRepo.getAutomationForUser.mockImplementation(async (id: string, userId: string) => (userId === "user-1" && id !== D ? { id } : null));
    const order: string[] = [];
    runRepo.cancelPendingRunsForAutomation.mockImplementation(async (id: string) => { order.push(`cancel:${id}`); return 1; });
    automationService.deleteAutomation.mockImplementation(async (id: string) => { order.push(`delete:${id}`); });

    const body = await (await automations.POST(req({ ids: [A, D] }))).json();

    expect(order).toEqual([`cancel:${A}`, `delete:${A}`]);
    // D não é do usuário: nada foi cancelado nem excluído.
    expect(runRepo.cancelPendingRunsForAutomation).not.toHaveBeenCalledWith(D);
    expect(body.deleted).toEqual([A, D]);
  });
});
