import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { SiteSidebar, MobileNavigation } from "@/components/navigation/SiteNav";

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
    render(<MobileNavigation />);

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
      const { container } = render(<MobileNavigation />);

      fireEvent.click(screen.getByRole("button", { name: /abrir menu de navegação/i }));

      const dialog = screen.getByRole("dialog", { name: /navegação principal/i });
      expect(container.contains(dialog)).toBe(false);
      expect(document.body.contains(dialog)).toBe(true);
    },
  );

  it("fechar o menu remove o painel do body (sem vazar entre testes)", () => {
    render(<MobileNavigation />);

    fireEvent.click(screen.getByRole("button", { name: /abrir menu de navegação/i }));
    const dialog = screen.getByRole("dialog");

    // O botão de fechar dentro do painel (o "X") tem o mesmo nome acessível
    // do botão de fundo (backdrop) que também fecha o menu — busca só o de
    // dentro do dialog para não ambiguar.
    fireEvent.click(within(dialog).getByRole("button", { name: /fechar menu de navegação/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("clicar em um link da categoria fecha o menu (permite navegar de fato no celular)", () => {
    render(<MobileNavigation />);

    fireEvent.click(screen.getByRole("button", { name: /abrir menu de navegação/i }));
    const dialog = screen.getByRole("dialog");
    const instagramLink = within(dialog).getAllByRole("link")[2];
    expect(instagramLink).toHaveAttribute("href", "/instagram");

    fireEvent.click(instagramLink);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
