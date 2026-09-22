// @vitest-environment node
//
// Testa a rota de início do OAuth mockando `auth`, a geração do `state` e
// o serviço que monta a URL de autorização — sem nenhuma chamada real à
// Meta.
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

const generateOAuthStateMock = vi.fn();
vi.mock("@/lib/instagram/backend/oauth-state", async () => {
  const actual = await vi.importActual<typeof import("@/lib/instagram/backend/oauth-state")>(
    "@/lib/instagram/backend/oauth-state",
  );
  return { ...actual, generateOAuthState: (...args: unknown[]) => generateOAuthStateMock(...args) };
});

class FakeInstagramOAuthConfigError extends Error {}
const buildAuthorizeUrlForConnectMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-oauth-service", () => ({
  InstagramOAuthConfigError: FakeInstagramOAuthConfigError,
  buildAuthorizeUrlForConnect: (...args: unknown[]) => buildAuthorizeUrlForConnectMock(...args),
}));

const { GET } = await import("@/app/api/instagram/oauth/start/route");

function request(): Request {
  return new Request("https://alilu.com.br/api/instagram/oauth/start");
}

describe("GET /api/instagram/oauth/start", () => {
  beforeEach(() => {
    authMock.mockReset();
    generateOAuthStateMock.mockReset();
    buildAuthorizeUrlForConnectMock.mockReset();
  });

  it("redireciona para /entrar quando não há sessão", async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://alilu.com.br/entrar");
  });

  it("responde 503 quando o app da Meta não está configurado", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    generateOAuthStateMock.mockReturnValue("state-abc");
    buildAuthorizeUrlForConnectMock.mockImplementation(() => {
      throw new FakeInstagramOAuthConfigError("não configurado");
    });

    const response = await GET(request());
    const data = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(data.error).toBe("não configurado");
  });

  it("redireciona para a URL de autorização e grava o cookie de state", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    generateOAuthStateMock.mockReturnValue("state-abc");
    buildAuthorizeUrlForConnectMock.mockReturnValue("https://www.instagram.com/oauth/authorize?state=state-abc");

    const response = await GET(request());

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://www.instagram.com/oauth/authorize?state=state-abc");
    expect(buildAuthorizeUrlForConnectMock).toHaveBeenCalledWith(
      "https://alilu.com.br/api/instagram/oauth/callback",
      "state-abc",
    );

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("ig_oauth_state=state-abc");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/api/instagram/oauth");
  });
});
