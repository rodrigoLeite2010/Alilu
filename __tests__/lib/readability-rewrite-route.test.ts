// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));
const rewriteMock = vi.fn();
const quotaMock = vi.fn();
let enabled = true;
vi.mock("@/lib/text/readability/backend/rewrite-service", () => ({
  RewriteError: class RewriteError extends Error {
    constructor(message: string, readonly code: string, readonly status: number) {
      super(message);
    }
  },
  rewriteText: (...a: unknown[]) => rewriteMock(...a),
  getRewriteQuota: (...a: unknown[]) => quotaMock(...a),
  isRewriteEnabled: () => enabled,
}));

const { GET, POST } = await import("@/app/api/readability/rewrite/route");
const { RewriteError } = await import("@/lib/text/readability/backend/rewrite-service");
const post = (body: unknown) => POST(new Request("http://localhost/api/readability/rewrite", { method: "POST", body: JSON.stringify(body) }));

afterEach(() => {
  enabled = true;
  vi.clearAllMocks();
});

describe("/api/readability/rewrite", () => {
  it("sem login: 401 e a IA não é chamada", async () => {
    authMock.mockResolvedValue(null);
    const response = await post({ text: "x" });
    expect(response.status).toBe(401);
    expect(rewriteMock).not.toHaveBeenCalled();
  });

  it("logado: usuário e e-mail vêm da sessão (nunca do corpo)", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    rewriteMock.mockResolvedValue({ text: "ok" });
    await post({ text: "x", goal: "reels", audience: "teen", userId: "outro", email: "dono@alilu.com.br" });
    expect(rewriteMock).toHaveBeenCalledWith({ userId: "u1", email: "a@b.com" }, { text: "x", goal: "reels", audience: "teen" });
  });

  it("erros do serviço viram status + mensagem amigável", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    rewriteMock.mockRejectedValue(new RewriteError("A IA demorou demais para responder. Tente novamente.", "TIMEOUT", 504));
    const response = await post({ text: "x" });
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({ error: "A IA demorou demais para responder. Tente novamente.", code: "TIMEOUT" });
  });

  it("GET: estado da reescrita (desligada / sem login / cota)", async () => {
    enabled = false;
    authMock.mockResolvedValue(null);
    expect(await (await GET()).json()).toEqual({ enabled: false, authenticated: false, quota: null });
    enabled = true;
    authMock.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    quotaMock.mockResolvedValue({ used: 2, limit: 30, unlimited: false });
    expect(await (await GET()).json()).toEqual({ enabled: true, authenticated: true, quota: { used: 2, limit: 30, unlimited: false } });
  });
});
