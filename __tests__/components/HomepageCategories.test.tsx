import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import HomePage from "@/app/page";

describe("HomePage — ordem das categorias", () => {
  it('o card da categoria "Instagram e Redes Sociais" aparece primeiro na grade de categorias', () => {
    render(<HomePage />);

    const heading = screen.getByRole("heading", { name: "Categorias" });
    // <SectionHeading> renderiza título+descrição dentro de um único <div>;
    // a grade de cards é o próximo irmão direto desse wrapper.
    const grid = heading.closest("div")!.nextElementSibling as HTMLElement;
    const categoryLinks = within(grid).getAllByRole("link");

    expect(categoryLinks.length).toBeGreaterThan(1);
    expect(categoryLinks[0]).toHaveAttribute("href", "/instagram");
    expect(categoryLinks[0]).toHaveTextContent("Instagram e Redes Sociais");
  });
});
