import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SymbolPickerTool } from "@/components/tools/symbol-picker/SymbolPickerTool";
import { SYMBOL_CATEGORIES } from "@/lib/data/symbols";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("SymbolPickerTool", () => {
  it("mostra todas as categorias quando não há busca", () => {
    render(<SymbolPickerTool />);
    for (const category of SYMBOL_CATEGORIES) {
      expect(screen.getByText(category)).toBeInTheDocument();
    }
  });

  it("filtra símbolos ao buscar por nome", () => {
    render(<SymbolPickerTool />);
    fireEvent.change(screen.getByPlaceholderText(/buscar símbolo/i), {
      target: { value: "seta para a direita" },
    });

    expect(screen.getByTitle("seta para a direita")).toBeInTheDocument();
    expect(screen.queryByText("Setas")).not.toBeInTheDocument();
  });

  it("mostra mensagem quando a busca não encontra nada", () => {
    render(<SymbolPickerTool />);
    fireEvent.change(screen.getByPlaceholderText(/buscar símbolo/i), {
      target: { value: "xyzxyzxyz-sem-correspondencia" },
    });

    expect(screen.getByText(/nenhum símbolo encontrado/i)).toBeInTheDocument();
  });

  it("copia o símbolo ao clicar nele", async () => {
    const writeText = mockClipboard();
    render(<SymbolPickerTool />);
    fireEvent.click(screen.getByTitle("real (moeda brasileira)"));

    expect(writeText).toHaveBeenCalledWith("R$");
  });
});
