import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LicensePlateGeneratorTool } from "@/components/tools/license-plate-generator/LicensePlateGeneratorTool";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("LicensePlateGeneratorTool", () => {
  it("gera uma placa no formato Mercosul por padrão", () => {
    render(<LicensePlateGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar placa/i }));

    expect(screen.getByText(/^[A-Z]{3}\d[A-Z]\d{2}$/)).toBeInTheDocument();
  });

  it("gera uma placa no formato antigo quando selecionado", () => {
    render(<LicensePlateGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Formato da placa"), { target: { value: "antiga" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar placa/i }));

    expect(screen.getByText(/^[A-Z]{3}-\d{4}$/)).toBeInTheDocument();
  });

  it("mostra o aviso de placa fictícia", () => {
    render(<LicensePlateGeneratorTool />);
    expect(screen.getByText(/placas geradas são fictícias/i)).toBeInTheDocument();
  });

  it("gera um lote e permite copiar todas", async () => {
    const writeText = mockClipboard();
    render(<LicensePlateGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar placa/i }));

    const rows = screen.getAllByText(/^[A-Z]{3}\d[A-Z]\d{2}$/);
    expect(rows).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: /copiar todas/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Todas as placas copiadas!");
  });
});
