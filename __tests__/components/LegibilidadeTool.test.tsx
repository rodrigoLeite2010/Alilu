import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { LegibilidadeTool } from "@/components/tools/legibilidade/LegibilidadeTool";

function typeText(value: string) {
  fireEvent.change(screen.getByLabelText(/cole ou escreva seu texto/i), { target: { value } });
}

describe("LegibilidadeTool", () => {
  it("texto vazio: mensagem amigável, sem resultado", () => {
    render(<LegibilidadeTool />);
    fireEvent.click(screen.getByRole("button", { name: "Analisar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Digite um texto para analisar.");
    expect(screen.queryByTestId("readability-result")).not.toBeInTheDocument();
  });

  it("contador em tempo real e análise com nota, índices, destaques e sugestão de troca", () => {
    render(<LegibilidadeTool />);
    typeText("Precisamos utilizar o sistema hoje. Depois a gente conversa.");
    expect(screen.getByText(/caracteres · 9 palavras/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Analisar" }));

    expect(screen.getByTestId("readability-score")).toHaveTextContent("/ 100");
    for (const key of ["flesch", "gulpease", "fleschKincaid", "gunningFog", "ari", "colemanLiau"]) {
      expect(screen.getByTestId(`index-${key}`)).toBeInTheDocument();
    }
    const highlight = screen.getByTestId("readability-highlight");
    fireEvent.click(within(highlight).getByRole("button", { name: "utilizar" }));
    expect(screen.getByText(/Possível substituição:/)).toHaveTextContent("usar");
    // O texto original aparece inteiro e intacto.
    expect(highlight.textContent).toBe("Precisamos utilizar o sistema hoje. Depois a gente conversa.");
  });

  it("acima de 20.000 caracteres: avisa claramente e não analisa", () => {
    render(<LegibilidadeTool />);
    typeText("a".repeat(20_001));
    expect(screen.getByText(/Limite de 20\.000 caracteres excedido/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analisar" })).toBeDisabled();
  });

  it("copiar e limpar", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<LegibilidadeTool />);
    typeText("Olá mundo.");
    fireEvent.click(screen.getByRole("button", { name: "Copiar texto" }));
    expect(await screen.findByText("Texto copiado.")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith("Olá mundo.");
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(screen.getByLabelText(/cole ou escreva seu texto/i)).toHaveValue("");
  });
});
