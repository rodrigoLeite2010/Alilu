import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { VehicleGeneratorTool } from "@/components/tools/vehicle-generator/VehicleGeneratorTool";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("VehicleGeneratorTool", () => {
  it("gera um único veículo ao clicar em 'Gerar veículo'", () => {
    render(<VehicleGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar veículo/i }));

    expect(screen.getByText("Veículo gerado")).toBeInTheDocument();
  });

  it("mostra o aviso de dados fictícios", () => {
    render(<VehicleGeneratorTool />);
    expect(screen.getByText(/veículos gerados são fictícios/i)).toBeInTheDocument();
  });

  it("mostra erro quando a quantidade é maior que o limite", () => {
    render(<VehicleGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar veículo/i }));

    expect(screen.getByText(/quantidade não pode ser maior que/i)).toBeInTheDocument();
  });

  it("gera um lote e permite copiar todos", async () => {
    const writeText = mockClipboard();
    render(<VehicleGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar veículo/i }));

    expect(screen.getAllByRole("listitem")).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: /copiar todos/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Todos os dados copiados!");
  });
});
