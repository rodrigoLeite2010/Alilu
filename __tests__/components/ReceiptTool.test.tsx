import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReceiptTool } from "@/components/tools/receipt/ReceiptTool";

// Nota: @testing-library normaliza espaços em branco do DOM (inclusive o
// espaço não-quebrável que Intl.NumberFormat usa em "R$ 850,00") para um
// espaço comum antes de comparar com getByText — por isso os textos abaixo
// usam espaço comum, mesmo a formatação real usando um espaço especial.

/**
 * Testes do Gerador de Recibo (ETAPA 2, seções 23 e 24): validação do
 * formulário e conteúdo da prévia gerada.
 */

function fillRequiredFields({
  amount = "85000",
  payerName = "João da Silva",
  reference = "serviços de manutenção",
  payeeName = "Carlos da Silva",
}: Partial<{
  amount: string;
  payerName: string;
  reference: string;
  payeeName: string;
}> = {}) {
  fireEvent.change(screen.getByLabelText("Valor do recibo"), {
    target: { value: amount },
  });
  fireEvent.change(screen.getByLabelText("Recebi de"), {
    target: { value: payerName },
  });
  fireEvent.change(screen.getByLabelText("Referente a"), {
    target: { value: reference },
  });
  fireEvent.change(screen.getByLabelText("Nome do recebedor"), {
    target: { value: payeeName },
  });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /gerar recibo/i }));
}

describe("ReceiptForm — validações", () => {
  it("não gera o recibo e mostra erros quando os campos obrigatórios estão vazios", () => {
    render(<ReceiptTool />);
    submit();

    expect(screen.getByText("Informe o valor do recibo.")).toBeInTheDocument();
    expect(
      screen.getByText("Informe quem efetuou o pagamento.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Informe a que se refere o pagamento.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Informe quem está recebendo o pagamento.")
    ).toBeInTheDocument();

    // Não deve ter avançado para a prévia.
    expect(screen.queryByText("RECIBO")).not.toBeInTheDocument();
  });

  it("mostra erro quando o valor é zero", () => {
    render(<ReceiptTool />);
    fillRequiredFields({ amount: "0" });
    submit();

    expect(
      screen.getByText("O valor deve ser maior que zero.")
    ).toBeInTheDocument();
  });

  it("mostra erro para CPF do pagador matematicamente inválido", () => {
    render(<ReceiptTool />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText("CPF/CNPJ do pagador"), {
      target: { value: "111.444.777-34" }, // dígito verificador errado
    });
    submit();

    expect(screen.getAllByText("CPF ou CNPJ inválido.").length).toBeGreaterThan(
      0
    );
    expect(screen.queryByText("RECIBO")).not.toBeInTheDocument();
  });

  it("mostra erro para CNPJ do recebedor matematicamente inválido", () => {
    render(<ReceiptTool />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText("CPF/CNPJ do recebedor"), {
      target: { value: "11.222.333/0001-82" }, // dígito verificador errado
    });
    submit();

    expect(screen.getAllByText("CPF ou CNPJ inválido.").length).toBeGreaterThan(
      0
    );
    expect(screen.queryByText("RECIBO")).not.toBeInTheDocument();
  });

  it("aceita CPF e CNPJ válidos", () => {
    render(<ReceiptTool />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText("CPF/CNPJ do pagador"), {
      target: { value: "11144477735" },
    });
    fireEvent.change(screen.getByLabelText("CPF/CNPJ do recebedor"), {
      target: { value: "11222333000181" },
    });
    submit();

    expect(screen.getByText("RECIBO")).toBeInTheDocument();
  });
});

describe("ReceiptTool — prévia e novo recibo", () => {
  it("gera a prévia com valor formatado, por extenso, pagador, referência e recebedor", () => {
    render(<ReceiptTool />);
    fillRequiredFields();
    submit();

    expect(screen.getByText("R$ 850,00")).toBeInTheDocument();
    expect(screen.getByText(/oitocentos e cinquenta reais/)).toBeInTheDocument();
    expect(screen.getByText(/Recebi de João da Silva,/)).toBeInTheDocument();
    expect(
      screen.getByText(/referente a serviços de manutenção\./)
    ).toBeInTheDocument();
    expect(screen.getByText("Carlos da Silva")).toBeInTheDocument();
  });

  it("não mostra forma de pagamento nem CPF/CNPJ quando não informados", () => {
    render(<ReceiptTool />);
    fillRequiredFields();
    submit();

    expect(screen.queryByText(/Forma de pagamento:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^CPF:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^CNPJ:/)).not.toBeInTheDocument();
  });

  it("mostra forma de pagamento quando informada", () => {
    render(<ReceiptTool />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText("Forma de pagamento"), {
      target: { value: "pix" },
    });
    submit();

    expect(screen.getByText("Forma de pagamento: Pix.")).toBeInTheDocument();
  });

  it('volta ao formulário ao clicar em "Novo recibo"', () => {
    render(<ReceiptTool />);
    fillRequiredFields();
    submit();
    expect(screen.getByText("RECIBO")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /novo recibo/i }));

    expect(screen.queryByText("RECIBO")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Valor do recibo")).toBeInTheDocument();
    expect(screen.getByLabelText("Valor do recibo")).toHaveValue("");
  });
});
