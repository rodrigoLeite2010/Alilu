import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PersonGeneratorTool } from "@/components/tools/person-generator/PersonGeneratorTool";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("PersonGeneratorTool", () => {
  it("gera uma pessoa com nome e campos (cpf, rg, e-mail...) ao clicar em 'Gerar pessoa'", () => {
    render(<PersonGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar pessoa/i }));

    expect(screen.getByText("Pessoa gerada")).toBeInTheDocument();
    expect(screen.getByText("CPF")).toBeInTheDocument();
    expect(screen.getByText("E-mail")).toBeInTheDocument();
  });

  it("mostra o aviso de perfil fictício", () => {
    render(<PersonGeneratorTool />);
    expect(screen.getByText(/perfis fictícios/i)).toBeInTheDocument();
  });

  it("mostra erro quando a quantidade é maior que o limite", () => {
    render(<PersonGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar pessoa/i }));

    expect(screen.getByText(/quantidade não pode ser maior que/i)).toBeInTheDocument();
  });

  it("gera um lote e permite copiar todos", async () => {
    const writeText = mockClipboard();
    render(<PersonGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar pessoa/i }));

    fireEvent.click(screen.getByRole("button", { name: /copiar todos/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Todos os dados copiados!");
  });
});
