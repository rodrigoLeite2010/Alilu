import { describe, expect, it } from "vitest";
import { parseNfeXml } from "@/lib/nfe/parse-nfe-xml";

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
      <det nItem="2">
        <prod>
          <cProd>002</cProd>
          <xProd>Segundo Produto</xProd>
          <qCom>1.0000</qCom>
          <uCom>UN</uCom>
          <vUnCom>25.50</vUnCom>
          <vProd>25.50</vProd>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vProd>125.50</vProd>
          <vICMS>10.00</vICMS>
          <vIPI>0.00</vIPI>
          <vNF>125.50</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>`;

describe("parseNfeXml — XML válido", () => {
  it("extrai identificação, emitente, destinatário, produtos e totais corretamente", () => {
    const result = parseNfeXml(VALID_NFE_XML);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.accessKey).toBe("35260112345678000199550010000012345678901234");
    expect(result.data.number).toBe("1234");
    expect(result.data.series).toBe("1");
    expect(result.data.issueDate).toBe("2026-09-10T10:00:00-03:00");

    expect(result.data.issuer).toEqual({
      name: "Empresa Emitente Ltda",
      document: "12345678000199",
    });
    expect(result.data.recipient).toEqual({
      name: "Cliente Destinatario",
      document: "11122233344",
    });

    expect(result.data.products).toHaveLength(2);
    expect(result.data.products[0]).toEqual({
      code: "001",
      description: "Produto Teste",
      quantity: 2,
      unit: "UN",
      unitValue: 50,
      totalValue: 100,
    });

    expect(result.data.totals).toEqual({
      productsValue: 125.5,
      icmsValue: 10,
      ipiValue: 0,
      invoiceValue: 125.5,
    });
  });

  it("quantidade × valor unitário bate com o valor total do produto (consistência aritmética do exemplo)", () => {
    const result = parseNfeXml(VALID_NFE_XML);
    if (!result.ok) throw new Error("esperava sucesso");
    for (const product of result.data.products) {
      if (product.quantity !== null && product.unitValue !== null && product.totalValue !== null) {
        expect(product.quantity * product.unitValue).toBeCloseTo(product.totalValue, 6);
      }
    }
  });
});

describe("parseNfeXml — casos inválidos", () => {
  it("string vazia retorna erro 'empty'", () => {
    const result = parseNfeXml("");
    expect(result).toEqual({ ok: false, error: "empty" });
  });

  it("apenas espaços em branco retorna erro 'empty'", () => {
    const result = parseNfeXml("   \n  ");
    expect(result).toEqual({ ok: false, error: "empty" });
  });

  it("XML malformado (tag não fechada) retorna erro 'invalid-xml'", () => {
    const result = parseNfeXml("<nfeProc><NFe><infNFe>");
    expect(result).toEqual({ ok: false, error: "invalid-xml" });
  });

  it("texto que não é XML retorna erro 'invalid-xml'", () => {
    const result = parseNfeXml("isto não é um XML");
    expect(result.ok).toBe(false);
  });

  it("XML válido mas que não é uma NF-e (sem infNFe) retorna erro 'not-nfe'", () => {
    const result = parseNfeXml("<root><algumaCoisa>valor</algumaCoisa></root>");
    expect(result).toEqual({ ok: false, error: "not-nfe" });
  });
});

describe("parseNfeXml — campos ausentes", () => {
  it("NF-e sem alguns campos retorna null nesses campos, sem lançar erro", () => {
    const minimalXml = `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
      <NFe>
        <infNFe Id="NFe12345678901234567890123456789012345678901234">
          <ide><nNF>1</nNF></ide>
          <emit><xNome>Só o nome</xNome></emit>
        </infNFe>
      </NFe>
    </nfeProc>`;

    const result = parseNfeXml(minimalXml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.number).toBe("1");
    expect(result.data.series).toBeNull();
    expect(result.data.issuer.name).toBe("Só o nome");
    expect(result.data.issuer.document).toBeNull();
    expect(result.data.recipient).toEqual({ name: null, document: null });
    expect(result.data.products).toEqual([]);
    expect(result.data.totals.invoiceValue).toBeNull();
  });
});
