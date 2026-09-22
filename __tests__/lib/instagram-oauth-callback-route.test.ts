// @vitest-environment node
//
// Testa a rota de callback do OAuth mockando `auth` e o serviço de
// conexão — cobre erro vindo da Meta, state ausente/inválido, falha no
// serviço (com e sem mensagem sanitizada) e o caminho de sucesso.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

class FakeInstagramOAuthConfigError extends Error {}
class FakeInstagramOAuthExchangeError extends Error {}
const completeInstagramConnectionMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-oauth-service", () => ({
  InstagramOAuthConfigError: FakeInstagramOAuthConfigError,
  InstagramOAuthExchangeError: FakeInstagramOAuthExchangeError,
  completeInstagramConnection: (...args: unknown[]) => completeInstagramConnectionMock(...args),
}));

const { GET } = await import("@/app/api/instagram/oauth/callback/route");

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(new Request(`https://alilu.com.br${path}`, cookie ? { headers: { cookie } } : undefined));
}

describe("GET /api/instagram/oauth/callback", () => {
  beforeEach(() => {
    authMock.mockReset();
    completeInstagramConnectionMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("redireciona para /entrar quando não há sessão", async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(request("/api/instagram/oauth/callback?code=abc&state=s"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://alilu.com.br/entrar");
  });

  it("redireciona com erro quando a Meta retorna error/error_reason", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await GET(
      request("/api/instagram/oauth/callback?error=access_denied&error_reason=user_denied"),
    );

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/instagram/painel");
    expect(location.searchParams.get("status")).toBe("erro");
    expect(completeInstagramConnectionMock).not.toHaveBeenCalled();
  });

  it("redireciona com erro quando falta o código", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await GET(request("/api/instagram/oauth/callback?state=s", "ig_oauth_state=s"));

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.searchParams.get("status")).toBe("erro");
    expect(completeInstagramConnectionMock).not.toHaveBeenCalled();
  });

  it("redireciona com erro quando o state não bate com o cookie", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await GET(
      request("/api/instagram/oauth/callback?code=abc&state=diferente", "ig_oauth_state=state-original"),
    );

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.searchParams.get("status")).toBe("erro");
    expect(completeInstagramConnectionMock).not.toHaveBeenCalled();
  });

  it("redireciona com a mensagem sanitizada quando o serviço lança InstagramOAuthExchangeError", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    completeInstagramConnectionMock.mockRejectedValue(new FakeInstagramOAuthExchangeError("falha ao trocar o token"));

    const response = await GET(
      request("/api/instagram/oauth/callback?code=abc&state=s", "ig_oauth_state=s"),
    );

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.searchParams.get("status")).toBe("erro");
    expect(location.searchParams.get("mensagem")).toBe("falha ao trocar o token");
  });

  it("redireciona com mensagem genérica quando o serviço lança um erro inesperado", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    completeInstagramConnectionMock.mockRejectedValue(new Error("detalhe interno sensível"));

    const response = await GET(
      request("/api/instagram/oauth/callback?code=abc&state=s", "ig_oauth_state=s"),
    );

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.searchParams.get("status")).toBe("erro");
    expect(location.searchParams.get("mensagem")).not.toContain("detalhe interno sensível");
  });

  it("redireciona com status=conectado e limpa o cookie de state no caminho de sucesso", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    completeInstagramConnectionMock.mockResolvedValue({ id: "account-1" });

    const response = await GET(
      request("/api/instagram/oauth/callback?code=abc&state=s", "ig_oauth_state=s"),
    );

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/instagram/painel");
    expect(location.searchParams.get("status")).toBe("conectado");
    expect(completeInstagramConnectionMock).toHaveBeenCalledWith({
      userId: "user-1",
      redirectUri: "https://alilu.com.br/api/instagram/oauth/callback",
      code: "abc",
    });

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("ig_oauth_state=");
    expect(setCookie.toLowerCase()).toContain("expires=thu, 01 jan 1970");
  });
});
