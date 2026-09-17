import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CompanyGeneratorTool } from "@/components/tools/company-generator/CompanyGeneratorTool";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("CompanyGeneratorTool", () => {
  it("gera uma empresa com nome fantasia e campos (cnpj, e-mail...) ao clicar em 'Gerar empresa'", () => {
    render(<CompanyGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar empresa/i }));

    expect(screen.getByText("Empresa gerada")).toBeInTheDocument();
    expect(screen.getByText("CNPJ")).toBeInTheDocument();
    expect(screen.getByText("E-mail")).toBeInTheDocument();
  });

  it("mostra o aviso de perfil fictício", () => {
    render(<CompanyGeneratorTool />);
    expect(screen.getByText(/perfis fictícios/i)).toBeInTheDocument();
  });

  it("mostra erro quando a quantidade é maior que o limite", () => {
    render(<CompanyGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar empresa/i }));

    expect(screen.getByText(/quantidade não pode ser maior que/i)).toBeInTheDocument();
  });

  it("gera um lote e permite copiar todos", async () => {
    const writeText = mockClipboard();
    render(<CompanyGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar empresa/i }));

    fireEvent.click(screen.getByRole("button", { name: /copiar todos/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Todos os dados copiados!");
  });
});
