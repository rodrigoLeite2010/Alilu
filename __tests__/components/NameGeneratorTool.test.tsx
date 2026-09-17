import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NameGeneratorTool } from "@/components/tools/name-generator/NameGeneratorTool";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("NameGeneratorTool", () => {
  it("gera um único nome ao clicar em 'Gerar nome'", () => {
    render(<NameGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar nome/i }));

    expect(screen.getByText("Nome gerado")).toBeInTheDocument();
  });

  it("mostra o aviso de nomes fictícios", () => {
    render(<NameGeneratorTool />);
    expect(screen.getByText(/combinações fictícias de nomes e sobrenomes/i)).toBeInTheDocument();
  });

  it("mostra erro quando a quantidade é maior que o limite", () => {
    render(<NameGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar nome/i }));

    expect(screen.getByText(/quantidade não pode ser maior que/i)).toBeInTheDocument();
  });

  it("gera um lote e permite copiar todos", async () => {
    const writeText = mockClipboard();
    render(<NameGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar nome/i }));

    expect(screen.getAllByRole("listitem")).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: /copiar todos/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Todos os nomes copiados!");
  });

  it("desabilita o seletor de sobrenomes quando o tipo é 'Somente primeiro nome'", () => {
    render(<NameGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "primeiro-nome" } });
    expect(screen.getByLabelText("Sobrenomes")).toBeDisabled();
  });
});
