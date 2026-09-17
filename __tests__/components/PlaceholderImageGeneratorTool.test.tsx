import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlaceholderImageGeneratorTool } from "@/components/tools/placeholder-image-generator/PlaceholderImageGeneratorTool";

describe("PlaceholderImageGeneratorTool", () => {
  it("gera a imagem (mostra o canvas) ao clicar em 'Gerar imagem'", () => {
    render(<PlaceholderImageGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar imagem/i }));

    expect(screen.getByTestId("placeholder-image-canvas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /baixar imagem/i })).toBeInTheDocument();
  });

  it("mostra erro quando a largura está fora do intervalo permitido", () => {
    render(<PlaceholderImageGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Largura (px)"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar imagem/i }));

    expect(screen.getByText(/a largura deve ser um número inteiro entre/i)).toBeInTheDocument();
  });

  it("mostra erro quando a cor de fundo é inválida", () => {
    render(<PlaceholderImageGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Cor de fundo"), { target: { value: "azul" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar imagem/i }));

    expect(screen.getByText(/informe uma cor hexadecimal válida.*ex\.: #CBD5E1/i)).toBeInTheDocument();
  });
});
