import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RenavamGeneratorTool } from "@/components/tools/renavam-generator/RenavamGeneratorTool";
import { isValidRenavam } from "@/lib/calculators/renavam-generator";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("RenavamGeneratorTool", () => {
  it("gera um único RENAVAM válido ao clicar em 'Gerar RENAVAM'", () => {
    render(<RenavamGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar renavam/i }));

    const highlight = screen.getByText(/^\d{10}-\d$/);
    expect(highlight).toBeInTheDocument();
    expect(isValidRenavam(highlight.textContent ?? "")).toBe(true);
  });

  it("mostra o aviso de uso para testes", () => {
    render(<RenavamGeneratorTool />);
    expect(
      screen.getByText(/são sintéticos e destinados exclusivamente a testes/i)
    ).toBeInTheDocument();
  });

  it("mostra erro quando a quantidade é maior que o limite", () => {
    render(<RenavamGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar renavam/i }));

    expect(screen.getByText(/quantidade não pode ser maior que/i)).toBeInTheDocument();
  });

  it("gera um lote e permite copiar todos", async () => {
    const writeText = mockClipboard();
    render(<RenavamGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar renavam/i }));

    const rows = screen.getAllByText(/^\d{10}-\d$/);
    expect(rows).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: /copiar todos/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Todos os RENAVAM copiados!");
  });
});
