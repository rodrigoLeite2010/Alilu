import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BankAccountGeneratorTool } from "@/components/tools/bank-account-generator/BankAccountGeneratorTool";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("BankAccountGeneratorTool", () => {
  it("gera uma única conta ao clicar em 'Gerar conta bancária'", () => {
    render(<BankAccountGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar conta bancária/i }));

    expect(screen.getByText(/^Ag\. \d{4} \/ Conta \d{7}-\d$/)).toBeInTheDocument();
  });

  it("mostra o aviso de dados sintéticos", () => {
    render(<BankAccountGeneratorTool />);
    expect(screen.getByText(/não reproduzem o algoritmo real de nenhum banco/i)).toBeInTheDocument();
  });

  it("permite escolher um banco específico", () => {
    render(<BankAccountGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Banco"), { target: { value: "341" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar conta bancária/i }));

    expect(screen.getByText(/Conta gerada \(Itaú Unibanco\)/i)).toBeInTheDocument();
  });

  it("mostra erro quando a quantidade é maior que o limite", () => {
    render(<BankAccountGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar conta bancária/i }));

    expect(screen.getByText(/quantidade não pode ser maior que/i)).toBeInTheDocument();
  });

  it("gera um lote e permite copiar todos", async () => {
    const writeText = mockClipboard();
    render(<BankAccountGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar conta bancária/i }));

    expect(screen.getAllByRole("listitem")).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: /copiar todos/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Todos os dados copiados!");
  });
});
