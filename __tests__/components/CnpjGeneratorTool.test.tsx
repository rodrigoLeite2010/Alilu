import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CnpjGeneratorTool } from "@/components/tools/cnpj-generator/CnpjGeneratorTool";
import { isValidCNPJ } from "@/lib/validators/document";

/**
 * Testes de interface do Gerador de CNPJ (ETAPA 9: botões funcionais, cópia
 * para área de transferência, feedback acessível, alternância numérico ↔
 * alfanumérico).
 */

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("CnpjGeneratorTool", () => {
  it("gera um único CNPJ numérico válido por padrão", () => {
    render(<CnpjGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar cnpj/i }));

    const highlight = screen.getByText(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
    expect(highlight).toBeInTheDocument();
    expect(isValidCNPJ((highlight.textContent ?? "").replace(/\D/g, ""))).toBe(true);
  });

  it("gera um CNPJ alfanumérico ao escolher o tipo alfanumérico", () => {
    render(<CnpjGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Tipo de CNPJ"), {
      target: { value: "alphanumeric" },
    });
    fireEvent.click(screen.getByRole("button", { name: /gerar cnpj/i }));

    const highlight = screen.getByText(
      /^[0-9A-Z]{2}\.[0-9A-Z]{3}\.[0-9A-Z]{3}\/[0-9A-Z]{4}-\d{2}$/
    );
    expect(highlight).toBeInTheDocument();
  });

  it("mostra o aviso de uso para testes", () => {
    render(<CnpjGeneratorTool />);
    expect(
      screen.getByText(/CNPJ gerado apenas para testes/i)
    ).toBeInTheDocument();
  });

  it("mostra erro quando a quantidade é maior que o limite", () => {
    render(<CnpjGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar cnpj/i }));

    expect(
      screen.getByText(/quantidade não pode ser maior que/i)
    ).toBeInTheDocument();
  });

  it("copia o CNPJ gerado e mostra feedback acessível", async () => {
    const writeText = mockClipboard();
    render(<CnpjGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar cnpj/i }));
    fireEvent.click(screen.getByRole("button", { name: /copiar cnpj/i }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("CNPJ copiado!");
  });

  it("gera um lote com uma linha por CNPJ e permite copiar todos", async () => {
    const writeText = mockClipboard();
    render(<CnpjGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar cnpj/i }));

    const rows = screen.getAllByText(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
    expect(rows).toHaveLength(4);

    fireEvent.click(screen.getByRole("button", { name: /copiar todos/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Todos os CNPJs copiados!"
    );
  });
});
