import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CompoundInterestTool } from "@/components/tools/compound-interest/CompoundInterestTool";

/**
 * Testes da Calculadora de Juros Compostos (ETAPA 3, seção "TESTES" —
 * "Testar também: ... renderização do resultado"): validação do formulário
 * e conteúdo do resultado exibido após o cálculo.
 */

function fillValidFields({
  initialAmount = "100000", // dígitos de centavos -> R$ 1.000,00
  contribution = "",
  rate = "1",
  period = "12",
}: Partial<{
  initialAmount: string;
  contribution: string;
  rate: string;
  period: string;
}> = {}) {
  fireEvent.change(screen.getByLabelText("Valor inicial"), {
    target: { value: initialAmount },
  });
  if (contribution) {
    fireEvent.change(screen.getByLabelText("Aporte mensal"), {
      target: { value: contribution },
    });
  }
  fireEvent.change(screen.getByLabelText("Taxa de juros"), {
    target: { value: rate },
  });
  fireEvent.change(screen.getByLabelText("Período"), {
    target: { value: period },
  });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /calcular/i }));
}

describe("CompoundInterestForm — validações", () => {
  it("mostra erros quando o formulário está vazio (valor inicial/aporte, taxa e período)", () => {
    render(<CompoundInterestTool />);
    submit();

    expect(
      screen.getByText("Informe um valor inicial ou um aporte mensal maior que zero.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("A taxa de juros não pode ser negativa.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Informe um período válido: um número inteiro maior que zero.")
    ).toBeInTheDocument();

    // Não deve ter calculado nada.
    expect(screen.queryByText("Valor final")).not.toBeInTheDocument();
  });

  it("aceita valor inicial zero quando há aporte mensal positivo", () => {
    render(<CompoundInterestTool />);
    fillValidFields({ initialAmount: "", contribution: "10000", rate: "1", period: "12" });
    submit();

    expect(
      screen.queryByText("Informe um valor inicial ou um aporte mensal maior que zero.")
    ).not.toBeInTheDocument();
    expect(screen.getByText("Valor final")).toBeInTheDocument();
  });

  it("rejeita taxa negativa", () => {
    render(<CompoundInterestTool />);
    fillValidFields();
    fireEvent.change(screen.getByLabelText("Taxa de juros"), {
      target: { value: "-1" },
    });
    submit();

    expect(
      screen.getByText("A taxa de juros não pode ser negativa.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Valor final")).not.toBeInTheDocument();
  });

  it("rejeita período não inteiro ou zero", () => {
    render(<CompoundInterestTool />);
    fillValidFields({ period: "0" });
    submit();
    expect(
      screen.getByText("Informe um período válido: um número inteiro maior que zero.")
    ).toBeInTheDocument();
  });

  it("aceita taxa zero (não é um valor inválido)", () => {
    render(<CompoundInterestTool />);
    fillValidFields({ rate: "0" });
    submit();

    expect(screen.queryByText("A taxa de juros não pode ser negativa.")).not.toBeInTheDocument();
    expect(screen.getByText("Valor final")).toBeInTheDocument();
  });
});

describe("CompoundInterestTool — renderização do resultado", () => {
  it("exibe o resultado com valor final, detalhamento, gráfico e tabela mês a mês", () => {
    render(<CompoundInterestTool />);
    fillValidFields({ initialAmount: "100000", rate: "1", period: "12" });
    submit();

    // Destaque do valor final.
    expect(screen.getByText("Valor final")).toBeInTheDocument();

    // Detalhamento: os quatro rótulos exigidos pela ETAPA 3.
    // ("Valor inicial" também é o rótulo do campo do formulário, por isso o
    // texto do detalhamento é buscado especificamente no elemento <dt>.)
    expect(screen.getByText("Valor inicial", { selector: "dt" })).toBeInTheDocument();
    expect(screen.getByText("Total aportado")).toBeInTheDocument();
    expect(screen.getByText("Total investido")).toBeInTheDocument();
    expect(screen.getByText("Juros acumulados")).toBeInTheDocument();

    // Aviso de simulação (não é promessa de rentabilidade).
    expect(
      screen.getByText(/não constituem promessa de rentabilidade/)
    ).toBeInTheDocument();

    // Gráfico de evolução do saldo (SVG decorativo, com equivalente acessível na tabela).
    expect(screen.getByText("Evolução do saldo")).toBeInTheDocument();

    // Tabela mês a mês: cabeçalhos e uma linha por mês (12 meses).
    expect(screen.getByText("Detalhamento mês a mês")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Mês" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Saldo inicial" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Juros" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Aporte" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Saldo final" })).toBeInTheDocument();

    const dataRows = screen.getAllByRole("row").slice(1); // remove a linha de cabeçalho
    expect(dataRows).toHaveLength(12);
  });

  it("recalcula ao enviar o formulário novamente com valores diferentes", () => {
    render(<CompoundInterestTool />);
    fillValidFields({ initialAmount: "100000", rate: "1", period: "1" });
    submit();

    let dataRows = screen.getAllByRole("row").slice(1);
    expect(dataRows).toHaveLength(1);

    fillValidFields({ initialAmount: "100000", rate: "1", period: "6" });
    submit();

    dataRows = screen.getAllByRole("row").slice(1);
    expect(dataRows).toHaveLength(6);
  });
});
