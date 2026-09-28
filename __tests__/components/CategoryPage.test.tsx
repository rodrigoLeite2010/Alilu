import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import CategoryPage from "@/app/utilitarios/[categoria]/page";
import { categoryContent } from "@/components/categories/category-content";

/**
 * Cobre o conteúdo novo do hub de categoria (introdução + destaques) —
 * componente async, chamado diretamente como função (mesmo padrão usado
 * para as páginas async de app/financeiro/(privado)/*), já que renderizar
 * um Server Component async como tag JSX aninhada não funciona fora do
 * pipeline real do Next.js.
 */
describe("CategoryPage — introdução e destaques do hub", () => {
  it("mostra o texto introdutório e os cards de destaque da categoria Financeiro", async () => {
    const jsx = await CategoryPage({ params: Promise.resolve({ categoria: "financeiro" }) });
    render(jsx);

    expect(screen.getByText(categoryContent.financeiro.intro)).toBeInTheDocument();

    const highlightLinks = screen.getAllByRole("link", { name: /Juros Compostos/ });
    const highlightLink = highlightLinks.find(
      (link) => link.getAttribute("href") === "/utilitarios/financeiro/juros-compostos"
    );
    expect(highlightLink).toBeDefined();
    expect(screen.getByText(/projeta o crescimento de um valor investido/)).toBeInTheDocument();
  });

  it("mostra o texto introdutório da categoria Conversor Base64, ao lado do conversor unificado", async () => {
    const jsx = await CategoryPage({ params: Promise.resolve({ categoria: "conversor-base64" }) });
    render(jsx);

    expect(screen.getByText(categoryContent["conversor-base64"].intro)).toBeInTheDocument();
  });
});
