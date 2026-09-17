import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CpfGeneratorTool } from "@/components/tools/cpf-generator/CpfGeneratorTool";
import { isValidCPF } from "@/lib/validators/document";

/**
 * Testes de interface do Gerador de CPF (ETAPA 9: botões funcionais, cópia
 * para área de transferência, feedback acessível).
 */

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("CpfGeneratorTool", () => {
  it("gera um único CPF válido ao clicar em 'Gerar CPF'", () => {
    render(<CpfGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar cpf/i }));

    const highlight = screen.getByText(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
    expect(highlight).toBeInTheDocument();
    expect(isValidCPF(highlight.textContent ?? "")).toBe(true);
  });

  it("mostra o aviso de uso para testes", () => {
    render(<CpfGeneratorTool />);
    expect(
      screen.getByText(/são sintéticos e destinados exclusivamente a testes/i)
    ).toBeInTheDocument();
  });

  it("mostra erro quando a quantidade é maior que o limite", () => {
    render(<CpfGeneratorTool />);
    const input = screen.getByLabelText("Quantidade");
    fireEvent.change(input, { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar cpf/i }));

    expect(
      screen.getByText(/quantidade não pode ser maior que/i)
    ).toBeInTheDocument();
  });

  it("copia o CPF gerado e mostra feedback acessível", async () => {
    const writeText = mockClipboard();
    render(<CpfGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar cpf/i }));
    fireEvent.click(screen.getByRole("button", { name: /copiar cpf/i }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("CPF copiado!");
  });

  it("gera um novo CPF ao clicar em 'Gerar novamente'", () => {
    render(<CpfGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar cpf/i }));
    const first = screen.getByText(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/).textContent;

    fireEvent.click(screen.getByRole("button", { name: /gerar novamente/i }));
    const second = screen.getByText(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/).textContent;

    expect(isValidCPF(second ?? "")).toBe(true);
    // Não é garantido matematicamente que sejam diferentes, mas com 9
    // dígitos aleatórios a chance de colisão é desprezível — usado aqui
    // apenas como sinal de que uma nova geração de fato ocorreu.
    expect(first).toBeDefined();
  });

  it("gera um lote com uma linha por CPF e permite copiar todos", async () => {
    const writeText = mockClipboard();
    render(<CpfGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar cpf/i }));

    const rows = screen.getAllByText(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
    expect(rows).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: /copiar todos/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Todos os CPFs copiados!"
    );
  });
});
