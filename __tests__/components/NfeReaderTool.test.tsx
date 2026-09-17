import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NfeReaderTool } from "@/components/tools/nfe-reader/NfeReaderTool";

const VALID_NFE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe35260112345678000199550010000012345678901234" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <nNF>1234</nNF>
        <serie>1</serie>
        <dhEmi>2026-09-10T10:00:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>12345678000199</CNPJ>
        <xNome>Empresa Emitente Ltda</xNome>
      </emit>
      <dest>
        <CPF>11122233344</CPF>
        <xNome>Cliente Destinatario</xNome>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>001</cProd>
          <xProd>Produto Teste</xProd>
          <qCom>2.0000</qCom>
          <uCom>UN</uCom>
          <vUnCom>50.00</vUnCom>
          <vProd>100.00</vProd>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vProd>100.00</vProd>
          <vICMS>10.00</vICMS>
          <vIPI>0.00</vIPI>
          <vNF>100.00</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>`;

function selectFile(file: File) {
  const input = screen.getByLabelText(/selecione o arquivo xml da nf-e/i) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
  return input;
}

/**
 * Testes do Leitor de XML de NF-e — foco no limite de tamanho de arquivo
 * verificado ANTES de `FileReader.readAsText` (auditoria geral, item
 * "XML NF-e"), além do caminho feliz com um XML válido pequeno.
 */
describe("NfeReaderTool — limite de tamanho de arquivo", () => {
  it("rejeita um arquivo acima do limite com mensagem acessível, sem tentar processá-lo", async () => {
    render(<NfeReaderTool />);

    // 6 MB de conteúdo — acima do limite de 5 MB, sem precisar ser um XML válido.
    const oversized = new File([new Uint8Array(6 * 1024 * 1024)], "nota-gigante.xml", {
      type: "text/xml",
    });
    const input = selectFile(oversized);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/acima do limite/i);
    expect(alert.textContent).toMatch(/6,0 MB/);

    // O input é limpo e nenhum dado de NF-e é exibido.
    expect(input.value).toBe("");
    expect(screen.queryByText("Número / Série")).not.toBeInTheDocument();
  });

  it("aceita normalmente um arquivo XML válido dentro do limite", async () => {
    render(<NfeReaderTool />);

    const file = new File([VALID_NFE_XML], "nota-valida.xml", { type: "text/xml" });
    selectFile(file);

    await waitFor(() => {
      expect(screen.getByText("Número / Série")).toBeInTheDocument();
    });
    expect(screen.getByText("Produto Teste")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
