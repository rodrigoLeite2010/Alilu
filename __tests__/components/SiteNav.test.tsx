import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { SiteSidebar, MobileNavigation } from "@/components/navigation/SiteNav";
import type { HeaderAuthState } from "@/components/layout/auth-state";

const signedOut: HeaderAuthState = { status: "signed-out" };

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("SiteSidebar (desktop) — ordem das categorias", () => {
  it('a categoria "Instagram e Redes Sociais" aparece primeiro na lista de categorias', () => {
    render(<SiteSidebar />);

    const categoriesHeading = screen.getByText("Categorias");
    const list = categoriesHeading.parentElement!.querySelector("ul:last-of-type") ?? categoriesHeading.nextElementSibling;
    const links = within(list as HTMLElement).getAllByRole("link");

    expect(links[0]).toHaveTextContent("Instagram");
    expect(links[0]).toHaveAttribute("href", "/instagram");
  });
});

describe("MobileNavigation — ordem das categorias e correção do bug de abertura no celular", () => {
  it('a categoria "Instagram e Redes Sociais" aparece primeiro na lista de categorias', () => {
    render(<MobileNavigation auth={signedOut} />);

    fireEvent.click(screen.getByRole("button", { name: /abrir menu de navegação/i }));

    const dialog = screen.getByRole("dialog", { name: /navegação principal/i });
    const categoriesHeading = within(dialog).getByText("Categorias");
    const list = categoriesHeading.nextElementSibling as HTMLElement;
    const links = within(list).getAllByRole("link");

    expect(links[0]).toHaveTextContent("Instagram");
    expect(links[0]).toHaveAttribute("href", "/instagram");
  });

  it(
    "o painel é renderizado via portal direto no body, fora do container do componente " +
      "(bug: o header usa backdrop-blur, que cria um novo containing block para " +
      "elementos position:fixed — sem o portal, o painel ficava preso à altura do " +
      "header e as categorias pareciam não abrir no celular)",
    () => {
      const { container } = render(<MobileNavigation auth={signedOut} />);

      fireEvent.click(screen.getByRole("button", { name: /abrir menu de navegação/i }));

      const dialog = screen.getByRole("dialog", { name: /navegação principal/i });
      expect(container.contains(dialog)).toBe(false);
      expect(document.body.contains(dialog)).toBe(true);
    },
  );

  it("fechar o menu remove o painel do body (sem vazar entre testes)", () => {
    render(<MobileNavigation auth={signedOut} />);

    fireEvent.click(screen.getByRole("button", { name: /abrir menu de navegação/i }));
    const dialog = screen.getByRole("dialog");

    // O botão de fechar dentro do painel (o "X") tem o mesmo nome acessível
    // do botão de fundo (backdrop) que também fecha o menu — busca só o de
    // dentro do dialog para não ambiguar.
    fireEvent.click(within(dialog).getByRole("button", { name: /fechar menu de navegação/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("clicar em um link da categoria fecha o menu (permite navegar de fato no celular)", () => {
    render(<MobileNavigation auth={signedOut} />);

    fireEvent.click(screen.getByRole("button", { name: /abrir menu de navegação/i }));
    const dialog = screen.getByRole("dialog");
    const instagramLink = within(dialog)
      .getAllByRole("link")
      .find((link) => link.getAttribute("href") === "/instagram");
    expect(instagramLink).toBeDefined();

    fireEvent.click(instagramLink!);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("Menu Instagram em categorias (Manual / Automatizado)", () => {
  function openAll() {
    render(<SiteSidebar />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir opções do Instagram" }));
  }

  it("começa fechado: só o link Instagram, sem sublinks", () => {
    render(<SiteSidebar />);
    expect(screen.getByRole("button", { name: "Abrir opções do Instagram" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Criar post" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Piloto Automático" })).not.toBeInTheDocument();
  });

  it("ao abrir mostra os grupos Manual e Automatizado, ainda fechados", () => {
    openAll();
    expect(screen.getByRole("button", { name: "Manual" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Automatizado" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("link", { name: "Importar do Instagram" })).toHaveAttribute("href", "/videos/importar-instagram");
  });

  it("Manual: post, carrossel, reels e legendas — sem 'Posts Virais'", () => {
    openAll();
    fireEvent.click(screen.getByRole("button", { name: "Manual" }));
    const group = screen.getByRole("group", { name: "Manual" });
    expect(within(group).getAllByRole("link").map((link) => link.textContent)).toEqual(["Criar post", "Carrossel", "Reels", "Legendas"]);
    expect(screen.queryByRole("link", { name: /Posts Virais/ })).not.toBeInTheDocument();
  });

  it("Automatizado: agendar e publicar, Carrossel Inteligente e Piloto Automático", () => {
    openAll();
    fireEvent.click(screen.getByRole("button", { name: "Automatizado" }));
    const links = within(screen.getByRole("group", { name: "Automatizado" })).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Agendar e publicar", "/instagram/painel/calendario"],
      ["Carrossel Inteligente", "/instagram/carrossel-inteligente"],
      ["Piloto Automático", "/instagram/piloto-automatico"],
    ]);
  });

  it("o botão fecha de novo", () => {
    openAll();
    fireEvent.click(screen.getByRole("button", { name: "Fechar opções do Instagram" }));
    expect(screen.queryByRole("button", { name: "Manual" })).not.toBeInTheDocument();
  });
});
