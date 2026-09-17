import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FancyTextGeneratorTool } from "@/components/tools/fancy-text-generator/FancyTextGeneratorTool";
import { FANCY_TEXT_STYLES } from "@/lib/calculators/fancy-text-generator";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("FancyTextGeneratorTool", () => {
  it("mostra uma mensagem quando nenhum texto foi digitado", () => {
    render(<FancyTextGeneratorTool />);
    expect(screen.getByText(/digite um texto acima/i)).toBeInTheDocument();
  });

  it("mostra todos os estilos ao digitar um texto", () => {
    render(<FancyTextGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Digite o texto"), { target: { value: "Olá" } });

    for (const style of FANCY_TEXT_STYLES) {
      expect(screen.getByText(style.label)).toBeInTheDocument();
    }
  });

  it("permite copiar um estilo gerado", async () => {
    const writeText = mockClipboard();
    render(<FancyTextGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Digite o texto"), { target: { value: "Olá" } });

    fireEvent.click(screen.getAllByRole("button", { name: /copiar/i })[0]);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Copiado!")).toBeInTheDocument();
  });
});
