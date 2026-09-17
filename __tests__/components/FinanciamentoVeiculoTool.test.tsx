import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FinanciamentoVeiculoTool } from "@/components/tools/financiamento-veiculo/FinanciamentoVeiculoTool";

/**
 * Testes de componente da Calculadora de Financiamento de Veículo (auditoria
 * pré-AdSense — cobertura que faltava para este componente, que reaproveita
 * lib/calculators/financing.ts com system: "price" fixo).
 */

function fillValidFields({
  price = "1000000", // dígitos de centavos -> R$ 10.000,00
  downPayment = "",
  rate = "2",
  installments = "12",
}: Partial<{
  price: string;
  downPayment: string;
  rate: string;
  installments: string;
}> = {}) {
  fireEvent.change(screen.getByLabelText("Preço do veículo"), {
    target: { value: price },
  });
  if (downPayment) {
    fireEvent.change(screen.getByLabelText("Entrada"), {
      target: { value: downPayment },
    });
  }
  fireEvent.change(screen.getByLabelText("Taxa de juros"), {
    target: { value: rate },
  });
  fireEvent.change(screen.getByLabelText("Número de parcelas"), {
    target: { value: installments },
  });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /simular/i }));
}

describe("FinanciamentoVeiculoTool — validações", () => {
  it("mostra erros quando o formulário está vazio", () => {
    render(<FinanciamentoVeiculoTool />);
    submit();

    expect(
      screen.getByText("Informe um valor do bem maior que zero.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Valor financiado")).not.toBeInTheDocument();
  });

  it("limpa a mensagem de erro assim que o campo é corrigido (regressão)", () => {
    render(<FinanciamentoVeiculoTool />);
    submit();

    expect(
      screen.getByText("Informe um valor do bem maior que zero.")
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Preço do veículo"), {
      target: { value: "1000000" },
    });

    expect(
      screen.queryByText("Informe um valor do bem maior que zero.")
    ).not.toBeInTheDocument();
  });

  it("rejeita entrada maior ou igual ao preço do veículo", () => {
    render(<FinanciamentoVeiculoTool />);
    fillValidFields({ price: "500000", downPayment: "500000" });
    submit();

    expect(
      screen.getByText("A entrada deve ser menor que o valor do bem.")
    ).toBeInTheDocument();
  });
});

describe("FinanciamentoVeiculoTool — resultado", () => {
  it("mostra o valor da parcela e o resumo do financiamento", () => {
    render(<FinanciamentoVeiculoTool />);
    fillValidFields();
    submit();

    expect(screen.getByText("Valor da parcela")).toBeInTheDocument();
    expect(screen.getByText("Valor financiado")).toBeInTheDocument();
    expect(screen.getByText("Evolução do saldo devedor")).toBeInTheDocument();
  });
});
