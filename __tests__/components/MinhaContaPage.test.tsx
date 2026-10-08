import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

const getUserByIdMock = vi.fn();
vi.mock("@/lib/instagram/backend/users-store", () => ({
  getUserById: (...args: unknown[]) => getUserByIdMock(...args),
}));

const signOutMock = vi.fn();
vi.mock("next-auth/react", () => ({
  signOut: (...args: unknown[]) => signOutMock(...args),
}));

const { default: MinhaContaPage } = await import("@/app/minha-conta/page");

/**
 * Página assíncrona (Server Component) — chamamos a função diretamente,
 * como o Next.js faria, mockando `auth()` e `getUserById` (nunca batendo
 * no banco de verdade). Cobre a exigência da FASE 13 do PROMPT: sem
 * sessão mostra a entrada amigável (nunca redireciona de cara); com
 * sessão, mostra nome/e-mail/forma de login e os atalhos para as áreas
 * privadas, além do botão "Sair da conta".
 */
describe("MinhaContaPage", () => {
  beforeEach(() => {
    authMock.mockReset();
    getUserByIdMock.mockReset();
    signOutMock.mockReset();
  });

  it("mostra a entrada amigável (não redireciona) quando não há sessão", async () => {
    authMock.mockResolvedValue(null);

    const jsx = await MinhaContaPage();
    render(jsx);

    expect(screen.getByRole("heading", { name: "Entre para ver sua conta" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Entrar ou criar conta" }),
    ).toHaveAttribute("href", "/entrar?callbackUrl=%2Fminha-conta");
    expect(getUserByIdMock).not.toHaveBeenCalled();
  });

  it('mostra "Conectado com Google" quando a conta tem google_id', async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", name: "Ana Souza", email: "ana@exemplo.com", image: null } });
    getUserByIdMock.mockResolvedValue({
      id: "user-1",
      email: "ana@exemplo.com",
      name: "Ana Souza",
      avatarUrl: null,
      googleId: "google-123",
    });

    const jsx = await MinhaContaPage();
    render(jsx);

    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("ana@exemplo.com")).toBeInTheDocument();
    expect(screen.getByText("Conectado com Google")).toBeInTheDocument();
  });

  it('mostra "Conectado por código de e-mail" quando não há google_id', async () => {
    authMock.mockResolvedValue({ user: { id: "user-2", name: null, email: "bruno@exemplo.com", image: null } });
    getUserByIdMock.mockResolvedValue({
      id: "user-2",
      email: "bruno@exemplo.com",
      name: null,
      avatarUrl: null,
      googleId: null,
    });

    const jsx = await MinhaContaPage();
    render(jsx);

    expect(screen.getByText("Conectado por código de e-mail")).toBeInTheDocument();
  });

  it("mostra os atalhos para Controle financeiro e Instagram e o botão de sair", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", name: "Ana", email: "ana@exemplo.com", image: null } });
    getUserByIdMock.mockResolvedValue({
      id: "user-1",
      email: "ana@exemplo.com",
      name: "Ana",
      avatarUrl: null,
      googleId: null,
    });

    const jsx = await MinhaContaPage();
    render(jsx);

    expect(screen.getByRole("link", { name: "Controle financeiro" })).toHaveAttribute(
      "href",
      "/financeiro/educacao-financeira",
    );
    expect(screen.getByRole("link", { name: "Instagram / Automações" })).toHaveAttribute("href", "/instagram/painel");
    expect(screen.getByRole("button", { name: /Sair da conta/ })).toBeInTheDocument();
  });

  it('clicar em "Sair da conta" chama signOut com o callbackUrl que mostra o aviso na home', async () => {
    const { fireEvent } = await import("@testing-library/react");

    authMock.mockResolvedValue({ user: { id: "user-1", name: "Ana", email: "ana@exemplo.com", image: null } });
    getUserByIdMock.mockResolvedValue({
      id: "user-1",
      email: "ana@exemplo.com",
      name: "Ana",
      avatarUrl: null,
      googleId: null,
    });

    const jsx = await MinhaContaPage();
    render(jsx);

    fireEvent.click(screen.getByRole("button", { name: /Sair da conta/ }));

    await waitFor(() => expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: "/?saiu=1" }));
  });
});
