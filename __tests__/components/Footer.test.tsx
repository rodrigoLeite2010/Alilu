import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Footer } from "@/components/layout/Footer";

describe("Footer — ordem das categorias", () => {
  it('o link "Instagram e Redes Sociais" aparece primeiro na coluna de categorias', () => {
    render(<Footer />);

    const heading = screen.getByText("Categorias");
    const list = heading.nextElementSibling as HTMLElement;
    const links = within(list).getAllByRole("link");

    expect(links[0]).toHaveTextContent("Instagram e Redes Sociais");
    expect(links[0]).toHaveAttribute("href", "/instagram");
  });
});
