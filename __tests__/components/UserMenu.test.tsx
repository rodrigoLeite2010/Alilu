import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { UserMenu } from "@/components/layout/UserMenu";
import type { HeaderUser } from "@/components/layout/auth-state";

const signOutMock = vi.fn();
vi.mock("next-auth/react", () => ({
  signOut: (...args: unknown[]) => signOutMock(...args),
}));

const user: HeaderUser = { name: "Ana Souza", email: "ana@exemplo.com", image: null };

/**
 * Menu de conta do cabeçalho — cobre a exigência do PROMPT de deixar
 * óbvio, o tempo todo, que há uma sessão ativa (nome visível no gatilho)
 * e de ter um "Sair" que de fato funciona (chama signOut com o
 * callbackUrl que mostra o aviso de saída na home).
 */
describe("UserMenu", () => {
  beforeEach(() => {
    signOutMock.mockReset();
  });

  it("mostra o primeiro nome no gatilho, fechado por padrão", () => {
    render(<UserMenu user={user} />);

    expect(screen.getByRole("button", { name: /Ana/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("abre o menu ao clicar e mostra nome, e-mail e os atalhos (sem 'Minha assinatura')", () => {
    render(<UserMenu user={user} />);

    fireEvent.click(screen.getByRole("button", { name: /Ana/ }));

    const menu = screen.getByRole("menu", { name: "Menu da conta" });
    expect(menu).toBeInTheDocument();
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("ana@exemplo.com")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Minha conta" })).toHaveAttribute("href", "/minha-conta");
    expect(screen.getByRole("menuitem", { name: "Controle financeiro" })).toHaveAttribute(
      "href",
      "/financeiro/educacao-financeira",
    );
    expect(screen.getByRole("menuitem", { name: "Instagram / Automações" })).toHaveAttribute(
      "href",
      "/instagram/painel",
    );
    // Não existe recurso de assinatura/pagamento no site ainda — não inventar o item no menu.
    expect(screen.queryByRole("menuitem", { name: /assinatura/i })).not.toBeInTheDocument();
  });

  it("usa o e-mail como nome de exibição quando não há nome salvo", () => {
    render(<UserMenu user={{ name: null, email: "sem-nome@exemplo.com", image: null }} />);

    expect(screen.getByRole("button", { name: /sem-nome@exemplo.com/ })).toBeInTheDocument();
  });

  it('clicar em "Sair" chama signOut com o callbackUrl que mostra o aviso de saída na home', async () => {
    signOutMock.mockResolvedValue(undefined);
    render(<UserMenu user={user} />);

    fireEvent.click(screen.getByRole("button", { name: /Ana/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Sair/ }));

    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: "/?saiu=1" });
  });

  it("fecha o menu ao pressionar Escape e devolve o foco ao gatilho", () => {
    render(<UserMenu user={user} />);

    const trigger = screen.getByRole("button", { name: /Ana/ });
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
