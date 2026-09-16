import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FinancingTool } from "@/components/tools/financing/FinancingTool";

/**
 * Testes do Simulador de Financiamento SAC x Price (ETAPA 4, seção
 * "TESTES" — "Testar também: ... renderização; tabela mobile quando
 * aplicável"): validação do formulário e conteúdo do resultado exibido
 * após a simulação.
 */

function fillValidFields({
  assetValue = "1000000", // dígitos de centavos -> R$ 10.000,00
  downPayment = "",
  rate = "2",
  installments = "12",
}: Partial<{
  assetValue: string;
  downPayment: string;
  rate: string;
  installments: string;
}> = {}) {
  fireEvent.change(screen.getByLabelText("Valor do bem"), {
    target: { value: assetValue },
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

describe("FinancingForm — validações", () => {
  it("mostra erros quando o formulário está vazio (valor do bem, taxa e parcelas)", () => {
    render(<FinancingTool />);
    submit();

    expect(
      screen.getByText("Informe um valor do bem maior que zero.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("A taxa de juros não pode ser negativa.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Informe um número de parcelas válido: um número inteiro maior que zero."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("Valor financiado")).not.toBeInTheDocument();
  });

  it("rejeita entrada maior ou igual ao valor do bem", () => {
    render(<FinancingTool />);
    fillValidFields({ assetValue: "500000", downPayment: "500000" });
    submit();

    expect(
      screen.getByText("A entrada deve ser menor que o valor do bem.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Valor financiado")).not.toBeInTheDocument();
  });

  it("aceita taxa zero (não é um valor inválido)", () => {
    render(<FinancingTool />);
    fillValidFields({ rate: "0" });
    submit();

    expect(
      screen.queryByText("A taxa de juros não pode ser negativa.")
    ).not.toBeInTheDocument();
    expect(screen.getByText("Valor financiado")).toBeInTheDocument();
  });

  it("rejeita número de parcelas não inteiro", () => {
    render(<FinancingTool />);
    fillValidFields({ installments: "2.5" });
    submit();

    expect(
      screen.getByText(
        "Informe um número de parcelas válido: um número inteiro maior que zero."
      )
    ).toBeInTheDocument();
  });
});

describe("FinancingTool — renderização do resultado", () => {
  it("com 'Comparar os dois' (padrão), mostra Price e SAC lado a lado com tabelas e gráfico", () => {
    render(<FinancingTool />);
    fillValidFields();
    submit();

    expect(screen.getByText("Valor financiado")).toBeInTheDocument();
    expect(screen.getByText("Tabela Price")).toBeInTheDocument();
    expect(screen.getByText("SAC", { selector: "h3" })).toBeInTheDocument();
    expect(screen.getByText("Evolução do saldo devedor")).toBeInTheDocument();
    expect(
      screen.getByText("Tabela de amortização — Price")
    ).toBeInTheDocument();
    expect(screen.getByText("Tabela de amortização — SAC")).toBeInTheDocument();

    // Aviso de simulação (não indica um sistema como sempre melhor).
    expect(
      screen.getByText(/simulação matemática dos sistemas SAC e Price/)
    ).toBeInTheDocument();

    // 12 parcelas em cada tabela de amortização.
    const rows = screen.getAllByRole("row");
    // 2 cabeçalhos + 12 linhas de cada uma das 2 tabelas = 2 + 24
    expect(rows.length).toBe(2 + 24);
  });

  it("mostra somente o sistema selecionado quando não é 'Comparar os dois'", () => {
    render(<FinancingTool />);
    fireEvent.change(screen.getByLabelText("Sistema"), {
      target: { value: "price" },
    });
    fillValidFields();
    submit();

    expect(screen.getByText("Tabela Price")).toBeInTheDocument();
    expect(screen.queryByText("SAC", { selector: "h3" })).not.toBeInTheDocument();
    expect(
      screen.queryByText("Tabela de amortização — SAC")
    ).not.toBeInTheDocument();
  });

  it("recalcula ao simular novamente com valores diferentes", () => {
    render(<FinancingTool />);
    fireEvent.change(screen.getByLabelText("Sistema"), {
      target: { value: "sac" },
    });
    fillValidFields({ installments: "6" });
    submit();

    let rows = screen.getAllByRole("row").slice(1); // remove cabeçalho
    expect(rows).toHaveLength(6);

    fillValidFields({ installments: "3" });
    submit();

    rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
  });
});
