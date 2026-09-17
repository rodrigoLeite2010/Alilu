import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NumeroDoBancoTool } from "@/components/tools/numero-do-banco/NumeroDoBancoTool";
import { BRAZILIAN_BANKS } from "@/lib/data/brazilian-banks";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("NumeroDoBancoTool", () => {
  it("mostra a lista completa de bancos quando não há busca", () => {
    render(<NumeroDoBancoTool />);
    expect(screen.getAllByRole("row")).toHaveLength(BRAZILIAN_BANKS.length + 1); // +1 pelo cabeçalho
  });

  it("filtra bancos ao buscar por nome", () => {
    render(<NumeroDoBancoTool />);
    fireEvent.change(screen.getByPlaceholderText(/buscar por nome ou código/i), {
      target: { value: "nubank" },
    });
    expect(screen.getByText("260")).toBeInTheDocument();
  });

  it("filtra bancos ao buscar por código", () => {
    render(<NumeroDoBancoTool />);
    fireEvent.change(screen.getByPlaceholderText(/buscar por nome ou código/i), {
      target: { value: "341" },
    });
    expect(screen.getByText(/itaú unibanco/i)).toBeInTheDocument();
  });

  it("mostra mensagem quando nada é encontrado", () => {
    render(<NumeroDoBancoTool />);
    fireEvent.change(screen.getByPlaceholderText(/buscar por nome ou código/i), {
      target: { value: "banco-inexistente-xyz" },
    });
    expect(screen.getByText(/nenhum banco encontrado/i)).toBeInTheDocument();
  });

  it("copia o código do banco ao clicar em copiar", async () => {
    const writeText = mockClipboard();
    render(<NumeroDoBancoTool />);
    fireEvent.click(screen.getAllByRole("button", { name: /copiar/i })[0]);
    expect(writeText).toHaveBeenCalledTimes(1);
  });
});
