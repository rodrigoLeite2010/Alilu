import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RgGeneratorTool } from "@/components/tools/rg-generator/RgGeneratorTool";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("RgGeneratorTool", () => {
  it("gera um único RG formatado ao clicar em 'Gerar RG'", () => {
    render(<RgGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar rg/i }));

    expect(screen.getByText(/^\d{2}\.\d{3}\.\d{3}-[0-9X]$/)).toBeInTheDocument();
  });

  it("mostra o aviso de formato ilustrativo", () => {
    render(<RgGeneratorTool />);
    expect(screen.getByText(/formato ilustrativo/i)).toBeInTheDocument();
  });

  it("mostra erro quando a quantidade é maior que o limite", () => {
    render(<RgGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar rg/i }));

    expect(screen.getByText(/quantidade não pode ser maior que/i)).toBeInTheDocument();
  });

  it("gera um lote e permite copiar todos", async () => {
    const writeText = mockClipboard();
    render(<RgGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar rg/i }));

    const rows = screen.getAllByText(/^\d{2}\.\d{3}\.\d{3}-[0-9X]$/);
    expect(rows).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: /copiar todos/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Todos os RGs copiados!");
  });
});
