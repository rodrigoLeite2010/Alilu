import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlansLink } from "@/components/carousel/PlansLink";

describe("PlansLink", () => {
  it("mostra o botão 'Ver planos' para a mensagem de carrossel grátis usado", () => {
    render(<PlansLink message="Seu carrossel grátis já foi usado. Assine um plano do Carrossel Inteligente para continuar criando." />);
    expect(screen.getByRole("link", { name: "Ver planos" })).toHaveAttribute("href", "/instagram/carrossel-inteligente/planos");
  });
  it("não aparece em erros comuns", () => {
    render(<PlansLink message="Informe o tema do carrossel." />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("force mostra sempre", () => {
    render(<PlansLink message={null} force />);
    expect(screen.getByRole("link", { name: "Ver planos" })).toBeInTheDocument();
  });
});
