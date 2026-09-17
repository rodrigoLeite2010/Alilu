import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PisPasepGeneratorTool } from "@/components/tools/pis-pasep-generator/PisPasepGeneratorTool";
import { isValidPisPasep } from "@/lib/calculators/pis-pasep-generator";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("PisPasepGeneratorTool", () => {
  it("gera um único PIS/PASEP válido ao clicar em 'Gerar PIS/PASEP'", () => {
    render(<PisPasepGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar pis\/pasep/i }));

    const highlight = screen.getByText(/^\d{3}\.\d{5}\.\d{2}-\d$/);
    expect(highlight).toBeInTheDocument();
    expect(isValidPisPasep(highlight.textContent ?? "")).toBe(true);
  });

  it("mostra o aviso de uso para testes", () => {
    render(<PisPasepGeneratorTool />);
    expect(
      screen.getByText(/são sintéticos e destinados exclusivamente a testes/i)
    ).toBeInTheDocument();
  });

  it("mostra erro quando a quantidade é maior que o limite", () => {
    render(<PisPasepGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar pis\/pasep/i }));

    expect(screen.getByText(/quantidade não pode ser maior que/i)).toBeInTheDocument();
  });

  it("gera um lote e permite copiar todos", async () => {
    const writeText = mockClipboard();
    render(<PisPasepGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar pis\/pasep/i }));

    const rows = screen.getAllByText(/^\d{3}\.\d{5}\.\d{2}-\d$/);
    expect(rows).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: /copiar todos/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Todos os PIS/PASEP copiados!");
  });
});
