import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

const getInstagramAccountForUserMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-account-repository", () => ({
  getInstagramAccountForUser: (...args: unknown[]) => getInstagramAccountForUserMock(...args),
}));

const { default: CalendarioNovoPostPage } = await import("@/app/instagram/painel/calendario/novo/page");

describe("CalendarioNovoPostPage", () => {
  beforeEach(() => {
    authMock.mockReset();
    getInstagramAccountForUserMock.mockReset();
  });

  it("mostra o link de entrar quando não há sessão", async () => {
    authMock.mockResolvedValue(null);

    const jsx = await CalendarioNovoPostPage();
    render(jsx);

    expect(screen.getByRole("link", { name: "Começar a criar sem login" })).toBeInTheDocument();
    expect(getInstagramAccountForUserMock).not.toHaveBeenCalled();
  });

  it("pede para conectar a conta quando o usuário está logado mas não tem conta conectada", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getInstagramAccountForUserMock.mockResolvedValue(null);

    const jsx = await CalendarioNovoPostPage();
    render(jsx);

    expect(screen.getByRole("link", { name: "Ir para o painel" })).toBeInTheDocument();
  });

  it("renderiza o editor com o painel de publicação quando há conta conectada", async () => {
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

    const jsx = await CalendarioNovoPostPage();
    render(jsx);

    expect(screen.getByText("@alilu.tec", { exact: false })).toBeInTheDocument();
    expect(screen.getByTestId("instagram-post-canvas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar no Instagram" })).toBeInTheDocument();
  });
});
