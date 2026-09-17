import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StateTaxIdGeneratorTool } from "@/components/tools/state-tax-id-generator/StateTaxIdGeneratorTool";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("StateTaxIdGeneratorTool", () => {
  it("gera uma única Inscrição Estadual de 9 dígitos", () => {
    render(<StateTaxIdGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar inscrição estadual/i }));

    expect(screen.getByText(/^\d{9}$/)).toBeInTheDocument();
  });

  it("mostra o aviso de limitação por UF", () => {
    render(<StateTaxIdGeneratorTool />);
    expect(screen.getByText(/cada estado brasileiro define seu próprio formato/i)).toBeInTheDocument();
  });

  it("usa a UF escolhida quando informada explicitamente", () => {
    render(<StateTaxIdGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Estado (UF)"), { target: { value: "SP" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar inscrição estadual/i }));

    expect(screen.getByText(/Inscrição Estadual gerada \(SP\)/i)).toBeInTheDocument();
  });

  it("mostra erro quando a quantidade é maior que o limite", () => {
    render(<StateTaxIdGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar inscrição estadual/i }));

    expect(screen.getByText(/quantidade não pode ser maior que/i)).toBeInTheDocument();
  });

  it("gera um lote e permite copiar todos", async () => {
    const writeText = mockClipboard();
    render(<StateTaxIdGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar inscrição estadual/i }));

    expect(screen.getAllByRole("listitem")).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: /copiar todos/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Todos os números copiados!");
  });
});
