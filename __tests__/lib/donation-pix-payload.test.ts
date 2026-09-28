// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildPixPayload, crc16CcittFalse, sanitizePixTextField } from "@/lib/donation/pix-payload";

/**
 * Parser TLV minimalista (id de 2 dígitos + tamanho de 2 dígitos + valor),
 * só para os testes — percorre o payload byte a byte na ordem em que ele
 * foi montado, em vez de usar regex/toContain sobre a string inteira
 * (que poderia dar falso positivo/negativo se algum campo coincidir por
 * acaso com outro trecho do payload, como dentro da própria chave Pix).
 */
function parseTlv(payload: string): Map<string, string> {
  const fields = new Map<string, string>();
  let index = 0;
  while (index < payload.length) {
    const id = payload.slice(index, index + 2);
    const length = Number(payload.slice(index + 2, index + 4));
    const value = payload.slice(index + 4, index + 4 + length);
    fields.set(id, value);
    index += 4 + length;
  }
  return fields;
}

describe("crc16CcittFalse", () => {
  it("bate com o valor de referência oficial da família CRC-16/CCITT-FALSE", () => {
    // Valor de conformidade padrão (catálogo reveng CRC): poly 0x1021, init
    // 0xFFFF, sem reflexão, sem XOR final — check("123456789") = 0x29B1.
    expect(crc16CcittFalse("123456789")).toBe("29B1");
  });

  it("sempre devolve 4 dígitos hexadecimais maiúsculos", () => {
    expect(crc16CcittFalse("")).toMatch(/^[0-9A-F]{4}$/);
    expect(crc16CcittFalse("a")).toMatch(/^[0-9A-F]{4}$/);
    expect(crc16CcittFalse("000201")).toMatch(/^[0-9A-F]{4}$/);
  });

  it("é determinístico e sensível a qualquer mudança no conteúdo", () => {
    const a = crc16CcittFalse("payload-de-teste-1");
    const b = crc16CcittFalse("payload-de-teste-1");
    const c = crc16CcittFalse("payload-de-teste-2");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("sanitizePixTextField", () => {
  it("remove acentuação", () => {
    expect(sanitizePixTextField("São Paulo", 15)).toBe("SAO PAULO");
  });

  it("corta no tamanho máximo exigido pelo padrão BR Code", () => {
    expect(sanitizePixTextField("Um nome bem comprido para o recebedor", 25)).toHaveLength(25);
  });

  it("remove caracteres fora do conjunto seguro (emojis, símbolos)", () => {
    expect(sanitizePixTextField("Rodrigo 🚀 Leite!!", 25)).toBe("RODRIGO LEITE");
  });

  it("mantém letras, números, espaço e pontuação comum", () => {
    expect(sanitizePixTextField("Loja do Joao - Filial 2", 25)).toBe("LOJA DO JOAO - FILIAL 2");
  });
});

describe("buildPixPayload — estrutura do BR Code (EMV)", () => {
  const baseInput = {
    pixKey: "a1f773bb-0c82-4547-b195-55a9ac4ee748",
    receiverName: "Rodrigo Soares Leite",
    receiverCity: "SAO PAULO",
  };

  it("o parser TLV consegue percorrer o payload inteiro sem sobrar nem faltar bytes", () => {
    const payload = buildPixPayload(baseInput);
    const fields = parseTlv(payload);
    // Se o parser (id+tamanho+valor, repetido) não fechar exatamente no fim
    // da string, algum campo está com o tamanho declarado errado.
    let index = 0;
    for (const [id, value] of fields) {
      expect(payload.slice(index, index + 2)).toBe(id);
      index += 4 + value.length;
    }
    expect(index).toBe(payload.length);
  });

  it("campo 00 (Payload Format Indicator) = 01, campo 01 (método) = 11 (estático/reutilizável)", () => {
    const fields = parseTlv(buildPixPayload(baseInput));
    expect(fields.get("00")).toBe("01");
    expect(fields.get("01")).toBe("11");
  });

  it("campo 26 (Merchant Account Info) contém o GUI do Pix e a chave, num sub-TLV aninhado", () => {
    const fields = parseTlv(buildPixPayload(baseInput));
    const merchantAccountInfo = fields.get("26");
    expect(merchantAccountInfo).toBeDefined();
    const nested = parseTlv(merchantAccountInfo as string);
    expect(nested.get("00")).toBe("br.gov.bcb.pix");
    expect(nested.get("01")).toBe(baseInput.pixKey);
  });

  it("campo 52 (categoria) = 0000, 53 (moeda) = 986 (BRL), 58 (país) = BR", () => {
    const fields = parseTlv(buildPixPayload(baseInput));
    expect(fields.get("52")).toBe("0000");
    expect(fields.get("53")).toBe("986");
    expect(fields.get("58")).toBe("BR");
  });

  it("NUNCA inclui o campo 54 (valor da transação) — doação sempre de valor livre", () => {
    const fields = parseTlv(buildPixPayload(baseInput));
    expect(fields.has("54")).toBe(false);
  });

  it("campo 59 = nome do recebedor, campo 60 = cidade do recebedor (padronizados em maiúsculas)", () => {
    const fields = parseTlv(buildPixPayload(baseInput));
    expect(fields.get("59")).toBe(baseInput.receiverName.toUpperCase());
    expect(fields.get("60")).toBe(baseInput.receiverCity.toUpperCase());
  });

  it("campo 62 (dados adicionais) contém um txid padrão (***) quando nenhum é informado", () => {
    const fields = parseTlv(buildPixPayload(baseInput));
    const additionalData = parseTlv(fields.get("62") as string);
    expect(additionalData.get("05")).toBe("***");
  });

  it("usa um txid customizado quando informado", () => {
    const fields = parseTlv(buildPixPayload({ ...baseInput, txid: "DOACAO001" }));
    const additionalData = parseTlv(fields.get("62") as string);
    expect(additionalData.get("05")).toBe("DOACAO001");
  });

  it("termina com o campo 63 (CRC16) de 4 dígitos hex, calculado sobre o restante do payload", () => {
    const payload = buildPixPayload(baseInput);
    expect(payload.slice(-8, -4)).toBe("6304");
    const withoutCrc = payload.slice(0, -4);
    expect(payload.slice(-4)).toBe(crc16CcittFalse(withoutCrc));
  });

  it("é determinístico para a mesma entrada (o mesmo QR Code sempre codifica o mesmo payload)", () => {
    expect(buildPixPayload(baseInput)).toBe(buildPixPayload(baseInput));
  });

  it("muda o payload e o CRC se qualquer campo de entrada mudar", () => {
    const payloadA = buildPixPayload(baseInput);
    const payloadB = buildPixPayload({ ...baseInput, receiverCity: "RIO DE JANEIRO" });
    expect(payloadA).not.toBe(payloadB);
    expect(payloadA.slice(-4)).not.toBe(payloadB.slice(-4));
  });

  it("sanitiza nome e cidade com acento antes de montar o TLV", () => {
    const fields = parseTlv(
      buildPixPayload({ ...baseInput, receiverName: "José da Silva Júnior", receiverCity: "São Paulo" }),
    );
    expect(fields.get("59")).toBe("JOSE DA SILVA JUNIOR");
    expect(fields.get("60")).toBe("SAO PAULO");
  });

  it("lança um erro claro se a chave Pix estiver vazia (nunca gera um payload quebrado)", () => {
    expect(() => buildPixPayload({ ...baseInput, pixKey: "" })).toThrow();
    expect(() => buildPixPayload({ ...baseInput, pixKey: "   " })).toThrow();
  });
});
