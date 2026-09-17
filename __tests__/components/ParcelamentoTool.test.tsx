import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ParcelamentoTool } from "@/components/tools/parcelamento/ParcelamentoTool";

/**
 * Testes de componente da Calculadora de Parcelamento (auditoria
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
  fireEvent.change(screen.getByLabelText("Valor da compra"), {
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
  fireEvent.click(screen.getByRole("button", { name: /calcular/i }));
}

describe("ParcelamentoTool — validações", () => {
  it("mostra erros quando o formulário está vazio", () => {
    render(<ParcelamentoTool />);
    submit();

    expect(
      screen.getByText("Informe um valor do bem maior que zero.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Valor financiado")).not.toBeInTheDocument();
  });

  it("limpa a mensagem de erro assim que o campo é corrigido (regressão)", () => {
    render(<ParcelamentoTool />);
    submit();

    expect(
      screen.getByText("Informe um valor do bem maior que zero.")
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Valor da compra"), {
      target: { value: "1000000" },
    });

    expect(
      screen.queryByText("Informe um valor do bem maior que zero.")
    ).not.toBeInTheDocument();
  });

  it("aceita taxa zero (parcelamento sem juros)", () => {
    render(<ParcelamentoTool />);
    fillValidFields({ rate: "0" });
    submit();

    expect(
      screen.queryByText("A taxa de juros não pode ser negativa.")
    ).not.toBeInTheDocument();
    expect(screen.getByText("Valor financiado")).toBeInTheDocument();
  });
});

describe("ParcelamentoTool — resultado", () => {
  it("mostra o valor da parcela e o resumo do parcelamento", () => {
    render(<ParcelamentoTool />);
    fillValidFields();
    submit();

    expect(screen.getByText("Valor da parcela")).toBeInTheDocument();
    expect(screen.getByText("Total pago")).toBeInTheDocument();
    expect(screen.getByText("Juros totais")).toBeInTheDocument();
  });
});
