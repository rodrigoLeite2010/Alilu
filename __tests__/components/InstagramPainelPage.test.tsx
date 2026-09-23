import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

const getInstagramAccountForUserMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-account-repository", () => ({
  getInstagramAccountForUser: (...args: unknown[]) => getInstagramAccountForUserMock(...args),
}));

const { default: InstagramPainelPage } = await import("@/app/instagram/painel/page");

/**
 * O painel é um Server Component assíncrono — chamamos a função
 * diretamente (como o Next.js faria) e renderizamos o JSX resolvido, sem
 * nenhuma chamada real a `auth()` nem ao banco.
 */
describe("InstagramPainelPage", () => {
  beforeEach(() => {
    authMock.mockReset();
    getInstagramAccountForUserMock.mockReset();
  });

  it("mostra o link de entrar quando não há sessão", async () => {
    authMock.mockResolvedValue(null);

    const jsx = await InstagramPainelPage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(screen.getByRole("link", { name: "Entrar e conectar Instagram" })).toBeInTheDocument();
    expect(getInstagramAccountForUserMock).not.toHaveBeenCalled();
  });

  it("mostra a faixa de sucesso quando status=conectado", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getInstagramAccountForUserMock.mockResolvedValue(null);

    const jsx = await InstagramPainelPage({ searchParams: Promise.resolve({ status: "conectado" }) });
    render(jsx);

    expect(screen.getByRole("status")).toHaveTextContent("Conta conectada com sucesso.");
  });

  it("mostra a mensagem de erro recebida na query string", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getInstagramAccountForUserMock.mockResolvedValue(null);

    const jsx = await InstagramPainelPage({
      searchParams: Promise.resolve({ status: "erro", mensagem: "Falha específica de teste." }),
    });
    render(jsx);

    expect(screen.getByRole("alert")).toHaveTextContent("Falha específica de teste.");
  });

  it("mostra a conta conectada (username) quando já existe uma conexão", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getInstagramAccountForUserMock.mockResolvedValue({
      id: "account-1",
      userId: "user-1",
      igUserId: "178414000",
      igUsername: "alilu.tec",
      status: "connected",
      tokenExpiresAt: null,
      scopes: null,
      connectedAt: new Date(),
      updatedAt: new Date(),
    });

    const jsx = await InstagramPainelPage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(screen.getByText("@alilu.tec")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Conectar Instagram" })).not.toBeInTheDocument();
  });

  it("mostra o link para conectar quando não há conta conectada", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getInstagramAccountForUserMock.mockResolvedValue(null);

    const jsx = await InstagramPainelPage({ searchParams: Promise.resolve({}) });
    render(jsx);

    const link = screen.getByRole("link", { name: "Conectar Instagram" });
    expect(link).toHaveAttribute("href", "/api/instagram/oauth/start");
  });
});
