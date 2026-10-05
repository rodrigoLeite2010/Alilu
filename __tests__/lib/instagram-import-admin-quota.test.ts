// @vitest-environment node
// Administrador (ADMIN_EMAILS, só no servidor) sem limite de importação do
// Instagram: e-mail comparado sem diferença de maiúsculas/espaços, sem a
// variável ninguém ganha bypass, e a rota usa SÓ a sessão (nunca o corpo).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));
const resolveMock = vi.fn();
const quotaMock = vi.fn();
vi.mock("@/lib/instagram-import/backend/import-service", () => ({
  InstagramImportError: class extends Error {},
  resolveInstagramLink: (...a: unknown[]) => resolveMock(...a),
  getInstagramImportQuota: (...a: unknown[]) => quotaMock(...a),
}));
vi.mock("@/lib/instagram-import/backend/import-dto", () => ({ serializeImport: (r: unknown) => r }));

const { isAdminEmail } = await import("@/lib/admin/admin-access");
const { POST } = await import("@/app/api/videos/instagram-import/resolve/route");

const original = process.env.ADMIN_EMAILS;
beforeEach(() => {
  process.env.ADMIN_EMAILS = "dono@empresa.com.br, outro@empresa.com.br";
  resolveMock.mockReset().mockResolvedValue({ record: null, duplicate: null });
  quotaMock.mockReset().mockResolvedValue({ used: 0, limit: 20, unlimited: false });
});
afterEach(() => {
  process.env.ADMIN_EMAILS = original;
});

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/videos/instagram-import/resolve", { method: "POST", body: JSON.stringify(body) });
}

describe("isAdminEmail", () => {
  it("compara sem diferença de maiúsculas e espaços", () => {
    expect(isAdminEmail("  DONO@Empresa.com.br ")).toBe(true);
    expect(isAdminEmail("outro@empresa.com.br")).toBe(true);
    expect(isAdminEmail("cliente@gmail.com")).toBe(false);
  });

  it("variável ausente ou vazia: ninguém é admin", () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAdminEmail("dono@empresa.com.br")).toBe(false);
    process.env.ADMIN_EMAILS = " , ";
    expect(isAdminEmail("")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
  });
});

describe("POST /api/videos/instagram-import/resolve", () => {
  it("sem login: 401 e nenhuma importação", async () => {
    authMock.mockResolvedValue(null);
    const response = await POST(request({ url: "x", authorized: true }));
    expect(response.status).toBe(401);
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it("admin vem da SESSÃO (e-mail em maiúsculas também vale)", async () => {
    authMock.mockResolvedValue({ user: { id: "u-admin", email: "Dono@Empresa.com.br" } });
    await POST(request({ url: "x", authorized: true }));
    expect(resolveMock.mock.calls[0][3]).toEqual({ isAdmin: true });
    expect(quotaMock).toHaveBeenCalledWith("u-admin", true);
  });

  it("usuário comum não vira admin mandando isAdmin/role no corpo", async () => {
    authMock.mockResolvedValue({ user: { id: "u-1", email: "cliente@gmail.com" } });
    await POST(request({ url: "x", authorized: true, isAdmin: true, role: "admin" }));
    expect(resolveMock.mock.calls[0][3]).toEqual({ isAdmin: false });
  });

  it("variável ausente: nem o e-mail que seria admin ganha bypass", async () => {
    delete process.env.ADMIN_EMAILS;
    authMock.mockResolvedValue({ user: { id: "u-admin", email: "dono@empresa.com.br" } });
    await POST(request({ url: "x", authorized: true }));
    expect(resolveMock.mock.calls[0][3]).toEqual({ isAdmin: false });
  });
});
