import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CepGeneratorTool } from "@/components/tools/cep-generator/CepGeneratorTool";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("CepGeneratorTool", () => {
  it("gera um único CEP formatado ao clicar em 'Gerar CEP'", () => {
    render(<CepGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar cep/i }));

    expect(screen.getByText(/^\d{5}-\d{3}$/)).toBeInTheDocument();
  });

  it("mostra o aviso de CEP sintético", () => {
    render(<CepGeneratorTool />);
    expect(screen.getByText(/CEPs gerados são sintéticos/i)).toBeInTheDocument();
  });

  it("mostra erro quando a quantidade é maior que o limite", () => {
    render(<CepGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar cep/i }));

    expect(screen.getByText(/quantidade não pode ser maior que/i)).toBeInTheDocument();
  });

  it("gera um lote e permite copiar todos", async () => {
    const writeText = mockClipboard();
    render(<CepGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar cep/i }));

    const rows = screen.getAllByText(/^\d{5}-\d{3}$/);
    expect(rows).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: /copiar todos/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Todos os CEPs copiados!");
  });
});
