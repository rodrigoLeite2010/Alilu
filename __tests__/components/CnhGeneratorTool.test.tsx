import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CnhGeneratorTool } from "@/components/tools/cnh-generator/CnhGeneratorTool";
import { isValidCnh } from "@/lib/calculators/cnh-generator";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("CnhGeneratorTool", () => {
  it("gera uma única CNH válida ao clicar em 'Gerar CNH'", () => {
    render(<CnhGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar cnh/i }));

    const highlight = screen.getByText(/^\d{9}-\d{2}$/);
    expect(highlight).toBeInTheDocument();
    expect(isValidCnh(highlight.textContent ?? "")).toBe(true);
  });

  it("mostra o aviso de uso para testes", () => {
    render(<CnhGeneratorTool />);
    expect(
      screen.getByText(/são sintéticos e destinados exclusivamente a testes/i)
    ).toBeInTheDocument();
  });

  it("mostra erro quando a quantidade é maior que o limite", () => {
    render(<CnhGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar cnh/i }));

    expect(screen.getByText(/quantidade não pode ser maior que/i)).toBeInTheDocument();
  });

  it("gera um lote e permite copiar todos", async () => {
    const writeText = mockClipboard();
    render(<CnhGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar cnh/i }));

    const rows = screen.getAllByText(/^\d{9}-\d{2}$/);
    expect(rows).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: /copiar todos/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Todas as CNH copiadas!");
  });
});
