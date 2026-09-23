// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

class FakeInstagramPostValidationError extends Error {}
const updatePostMock = vi.fn();
const getPostDetailsMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-post-service", () => ({
  InstagramPostValidationError: FakeInstagramPostValidationError,
  cancelPost: vi.fn(),
  deletePost: vi.fn(),
  reschedulePost: vi.fn(),
  updatePost: (...args: unknown[]) => updatePostMock(...args),
  getPostDetails: (...args: unknown[]) => getPostDetailsMock(...args),
}));
const getAccountMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-account-repository", () => ({
  getInstagramAccountForUser: (...args: unknown[]) => getAccountMock(...args),
}));
const runSchedulerMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-scheduler", async () => {
  const actual = await vi.importActual<typeof import("@/lib/instagram/backend/instagram-scheduler")>(
    "@/lib/instagram/backend/instagram-scheduler",
  );
  return { ...actual, runInstagramScheduler: (...args: unknown[]) => runSchedulerMock(...args) };
});

const { GET, PATCH } = await import("@/app/api/instagram/posts/[id]/route");
const account = await import("@/app/api/instagram/account/route");
const cron = await import("@/app/api/cron/instagram-publish/route");

const params = { params: Promise.resolve({ id: "post-1" }) };
function patch(body: unknown) {
  return new Request("https://alilu.com.br/api/instagram/posts/post-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("PATCH action=update", () => {
  it("exige login", async () => {
    authMock.mockResolvedValue(null);
    expect((await PATCH(patch({ action: "update", caption: "x" }), params)).status).toBe(401);
    expect(updatePostMock).not.toHaveBeenCalled();
  });

  it("repassa legenda, data, fuso, mídia e template para o serviço, sempre com o userId da sessão", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    updatePostMock.mockResolvedValue({ status: "SCHEDULED" });
    const response = await PATCH(
      patch({
        action: "update",
        userId: "outro-usuario",
        caption: "Nova",
        scheduledAt: "2099-01-01T10:00:00.000Z",
        timezone: "America/Sao_Paulo",
        mediaUrls: ["https://blob/1.jpg"],
        templateId: "promocao",
        templateData: { version: 1 },
      }),
      params,
    );
    expect(response.status).toBe(200);
    expect(updatePostMock).toHaveBeenCalledWith({
      postId: "post-1",
      userId: "user-1",
      caption: "Nova",
      scheduledAt: "2099-01-01T10:00:00.000Z",
      mediaUrls: ["https://blob/1.jpg"],
      timezone: "America/Sao_Paulo",
      templateId: "promocao",
      templateData: { version: 1 },
    });
  });

  it("recusa template com imagem embutida e legenda longa demais", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    expect((await PATCH(patch({ action: "update", templateData: { a: "data:image/png;base64,AA" } }), params)).status).toBe(400);
    expect((await PATCH(patch({ action: "update", caption: "x".repeat(2201) }), params)).status).toBe(400);
    expect(updatePostMock).not.toHaveBeenCalled();
  });

  it("publicação em processamento: devolve a mensagem do serviço", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    updatePostMock.mockRejectedValue(new FakeInstagramPostValidationError("Esta publicação já está sendo processada."));
    const response = await PATCH(patch({ action: "update", caption: "x" }), params);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Esta publicação já está sendo processada." });
  });
});

describe("GET /api/instagram/posts/[id]", () => {
  it("404 quando não é do usuário", async () => {
    authMock.mockResolvedValue({ user: { id: "user-2" } });
    getPostDetailsMock.mockRejectedValue(new FakeInstagramPostValidationError("Publicação não encontrada."));
    expect((await GET(new Request("https://x"), params)).status).toBe(404);
    expect(getPostDetailsMock).toHaveBeenCalledWith("post-1", "user-2");
  });
});

describe("GET /api/instagram/account", () => {
  it("nunca devolve token nem id do Instagram", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getAccountMock.mockResolvedValue({ id: "acc", igUserId: "ig-123", igUsername: "alilu.tec", status: "connected", accessTokenEncrypted: "segredo" });
    const body = await (await account.GET()).json();
    expect(body).toEqual({ authenticated: true, userId: "user-1", connected: true, username: "alilu.tec", needsReconnect: false });
    expect(JSON.stringify(body)).not.toMatch(/segredo|ig-123/);
  });

  it("sem login", async () => {
    authMock.mockResolvedValue(null);
    expect(await (await account.GET()).json()).toMatchObject({ authenticated: false, connected: false });
  });
});

describe("/api/cron/instagram-publish", () => {
  it("401 sem o segredo; executa com Bearer CRON_SECRET", async () => {
    process.env.CRON_SECRET = "cron-secret-com-mais-de-16-chars";
    runSchedulerMock.mockResolvedValue([{ postId: "p1", status: "PUBLISHED" }]);

    expect((await cron.GET(new Request("https://x/api/cron/instagram-publish"))).status).toBe(401);
    expect(runSchedulerMock).not.toHaveBeenCalled();

    const ok = await cron.GET(
      new Request("https://x/api/cron/instagram-publish", { headers: { authorization: "Bearer cron-secret-com-mais-de-16-chars" } }),
    );
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ processed: 1, results: [{ postId: "p1", status: "PUBLISHED" }] });
    delete process.env.CRON_SECRET;
  });
});
