import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CreditCardGeneratorTool } from "@/components/tools/credit-card-generator/CreditCardGeneratorTool";
import { isValidLuhn, OFFICIAL_TEST_CARDS } from "@/lib/calculators/credit-card-generator";

/**
 * Testes de interface do Gerador de Cartão de Crédito de Teste (ETAPA 9:
 * botões funcionais, cópia para área de transferência, feedback acessível,
 * e a restrição de segurança de nunca gerar validade/CVV).
 */

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("CreditCardGeneratorTool", () => {
  it("gera, no modo padrão (Teste oficial), um dos números documentados", () => {
    render(<CreditCardGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar cartão/i }));

    const knownNumbers = OFFICIAL_TEST_CARDS.map((card) =>
      card.number.match(/.{1,4}/g)?.join(" ") ?? card.number
    );
    const highlight = screen.getByText((_, el) =>
      knownNumbers.includes(el?.textContent?.replace(/\s+/g, " ").trim() ?? "")
    );
    expect(highlight).toBeInTheDocument();
  });

  it("gera um número sintético Luhn-válido no modo sintético", () => {
    render(<CreditCardGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Origem do número"), {
      target: { value: "synthetic" },
    });
    fireEvent.click(screen.getByRole("button", { name: /gerar cartão/i }));

    const highlight = screen.getByText(/^[\d\s]+$/);
    const digitsOnly = (highlight.textContent ?? "").replace(/\s/g, "");
    expect(isValidLuhn(digitsOnly)).toBe(true);
  });

  it("mostra o aviso de segurança e nunca exibe campos de validade ou CVV", () => {
    render(<CreditCardGeneratorTool />);
    expect(
      screen.getByText(/exclusivamente para testes de formulários e validação/i)
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/cvv/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/validade/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cvv/i)).not.toBeInTheDocument();
  });

  it("mostra erro quando a quantidade é maior que o limite", () => {
    render(<CreditCardGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar cartão/i }));

    expect(
      screen.getByText(/quantidade não pode ser maior que/i)
    ).toBeInTheDocument();
  });

  it("copia o número gerado e mostra feedback acessível", async () => {
    const writeText = mockClipboard();
    render(<CreditCardGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar cartão/i }));
    fireEvent.click(screen.getByRole("button", { name: /copiar número/i }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Número copiado!");
  });

  it("gera um lote e permite copiar todos", async () => {
    const writeText = mockClipboard();
    render(<CreditCardGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar cartão/i }));

    fireEvent.click(screen.getByRole("button", { name: /copiar todos/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Todos os números copiados!"
    );
  });
});
