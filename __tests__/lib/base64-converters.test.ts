import { describe, expect, it } from "vitest";
import {
  Base64ConversionError,
  assertValidBase64,
  base64ToAscii,
  base64ToBytes,
  base64ToHex,
  base64ToUtf8,
  buildDataUri,
  buildDownloadFileName,
  bytesToBase64,
  bytesToBase64Async,
  bytesToHex,
  decodeBasicAuth,
  detectMimeFromBytes,
  estimateBase64Length,
  extractBase64,
  hexToBase64,
  hexToBytes,
  isValidBase64,
  parseDataUri,
  sanitizeDownloadFileName,
  utf8ToBase64,
} from "@/lib/base64/converters";

describe("texto UTF-8 <-> Base64", () => {
  const samples: Array<[string, string]> = [
    ["Alilu", "QWxpbHU="],
    ["São José dos Campos", "U8OjbyBKb3PDqSBkb3MgQ2FtcG9z"],
    ["Olá, mundo!", "T2zDoSwgbXVuZG8h"],
    ["🚀 Alilu", "8J+agCBBbGlsdQ=="],
    ["https://alilu.com.br", "aHR0cHM6Ly9hbGlsdS5jb20uYnI="],
  ];

  it.each(samples)("codifica %s", (text, base64) => {
    expect(utf8ToBase64(text)).toBe(base64);
  });

  it.each(samples)("decodifica de volta %s", (text, base64) => {
    expect(base64ToUtf8(base64)).toBe(text);
  });

  it("faz ida e volta com Unicode variado", () => {
    const text = "ção ñ ü 日本語 👩‍💻 ∑ €";
    expect(base64ToUtf8(utf8ToBase64(text))).toBe(text);
  });

  it("aceita espaços, quebras de linha, padding ausente e variante URL-safe", () => {
    expect(base64ToUtf8(" QWxp\nbHU ")).toBe("Alilu");
    expect(base64ToUtf8("QWxpbHU")).toBe("Alilu");
    expect(base64ToUtf8("8J-agCBBbGlsdQ")).toBe("🚀 Alilu");
  });

  it("rejeita UTF-8 inválido com mensagem amigável", () => {
    expect(() => base64ToUtf8("/w==")).toThrow(/UTF-8/);
  });
});

describe("validação de Base64", () => {
  it.each(["QWx!bHU=", "Q", "QWxpbHU===", "=QWx"])("rejeita %s", (value) => {
    expect(isValidBase64(value)).toBe(false);
    expect(() => base64ToBytes(value)).toThrow(Base64ConversionError);
    expect(() => base64ToBytes(value)).toThrow("Base64 inválido.");
  });

  it("pede conteúdo quando vazio", () => {
    expect(() => assertValidBase64("   ")).toThrow("Informe um conteúdo em Base64.");
  });
});

describe("Data URI", () => {
  it("extrai MIME e Base64", () => {
    expect(parseDataUri("data:image/png;base64,iVBORw0KGgo=")).toEqual({ mimeType: "image/png", base64: "iVBORw0KGgo=" });
  });

  it("aceita parâmetros como charset", () => {
    expect(parseDataUri("data:text/html;charset=utf-8;base64,PGgxPg==")).toEqual({ mimeType: "text/html", base64: "PGgxPg==" });
  });

  it("retorna null para texto que não é Data URI", () => {
    expect(parseDataUri("QWxpbHU=")).toBeNull();
    expect(parseDataUri("data:text/plain,Alilu")).toBeNull();
  });

  it("extractBase64 remove o prefixo", () => {
    expect(extractBase64("data:application/pdf;base64,JVBERi0=")).toBe("JVBERi0=");
  });

  it("buildDataUri monta o formato padrão", () => {
    expect(buildDataUri("text/css", "Ym9keXt9")).toBe("data:text/css;base64,Ym9keXt9");
  });
});

describe("hexadecimal <-> Base64", () => {
  it("converte hex para Base64 ignorando espaços, 0x e caixa", () => {
    expect(hexToBase64("416c696c75")).toBe("QWxpbHU=");
    expect(hexToBase64("41 6C 69 6C 75")).toBe("QWxpbHU=");
    expect(hexToBase64("0x41:0x6c:0x69:0x6c:0x75")).toBe("QWxpbHU=");
  });

  it("converte Base64 para hex em minúsculas e maiúsculas", () => {
    expect(base64ToHex("QWxpbHU=")).toBe("416c696c75");
    expect(base64ToHex("QWxpbHU=", true)).toBe("416C696C75");
  });

  it("rejeita hex com caracteres inválidos ou tamanho ímpar", () => {
    expect(() => hexToBytes("zz")).toThrow(/0-9 e A-F/);
    expect(() => hexToBytes("abc")).toThrow(/par/);
    expect(() => hexToBytes("")).toThrow(/Informe/);
  });

  it("bytesToHex cobre todos os valores de byte", () => {
    const all = Uint8Array.from({ length: 256 }, (_, index) => index);
    expect(hexToBytes(bytesToHex(all))).toEqual(all);
  });
});

describe("bytes <-> Base64 em arquivos grandes", () => {
  const big = Uint8Array.from({ length: 300_001 }, (_, index) => (index * 31) % 256);

  it("não estoura a pilha e bate com o Buffer do Node", () => {
    expect(bytesToBase64(big)).toBe(Buffer.from(big).toString("base64"));
  });

  it("a versão assíncrona gera o mesmo resultado e informa progresso", async () => {
    const progress: number[] = [];
    const result = await bytesToBase64Async(big, (value) => progress.push(value));
    expect(result).toBe(Buffer.from(big).toString("base64"));
    expect(progress.at(-1)).toBe(1);
  });

  it("faz ida e volta dos bytes", () => {
    expect(base64ToBytes(bytesToBase64(big))).toEqual(big);
  });

  it("estima o tamanho do Base64 (~33% maior)", () => {
    expect(estimateBase64Length(3)).toBe(4);
    expect(estimateBase64Length(4)).toBe(8);
    expect(estimateBase64Length(big.length)).toBe(bytesToBase64(big).length);
  });
});

describe("ASCII e Basic Auth", () => {
  it("decodifica ASCII e conta bytes fora da tabela", () => {
    expect(base64ToAscii("QWxpbHU=")).toEqual({ text: "Alilu", nonAsciiBytes: 0 });
    expect(base64ToAscii(utf8ToBase64("Olá")).nonAsciiBytes).toBe(2);
  });

  it("decodifica Basic Auth com ou sem prefixo", () => {
    const expected = { user: "user", password: "password", full: "user:password" };
    expect(decodeBasicAuth("Basic dXNlcjpwYXNzd29yZA==")).toEqual(expected);
    expect(decodeBasicAuth("dXNlcjpwYXNzd29yZA==")).toEqual(expected);
    expect(decodeBasicAuth("Authorization: Basic dXNlcjpwYXNzd29yZA==")).toEqual(expected);
  });

  it("mantém dois-pontos dentro da senha", () => {
    expect(decodeBasicAuth(utf8ToBase64("joão:se:nha")).password).toBe("se:nha");
  });

  it("avisa quando não há separador usuário:senha", () => {
    expect(() => decodeBasicAuth("QWxpbHU=")).toThrow(/usuário:senha/);
  });
});

describe("detecção de MIME", () => {
  const b64 = (value: string) => base64ToBytes(value);

  it("reconhece assinaturas comuns", () => {
    expect(detectMimeFromBytes(b64("JVBERi0xLjcK"))).toBe("application/pdf");
    expect(detectMimeFromBytes(b64("iVBORw0KGgoAAAANSUhEUg=="))).toBe("image/png");
    expect(detectMimeFromBytes(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectMimeFromBytes(new TextEncoder().encode("GIF89a...."))).toBe("image/gif");
    expect(detectMimeFromBytes(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(detectMimeFromBytes(new TextEncoder().encode("RIFF\0\0\0\0WAVEfmt "))).toBe("audio/wav");
    expect(detectMimeFromBytes(new TextEncoder().encode("ID3\u0004\0\0"))).toBe("audio/mpeg");
    expect(detectMimeFromBytes(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe("image/svg+xml");
  });

  it("usa a preferência para containers de áudio e vídeo", () => {
    const mp4 = new TextEncoder().encode("\0\0\0\u0018ftypisom");
    const webm = Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0]);
    const ogg = new TextEncoder().encode("OggS\0\0");
    expect(detectMimeFromBytes(mp4)).toBe("video/mp4");
    expect(detectMimeFromBytes(mp4, "", "audio")).toBe("audio/mp4");
    expect(detectMimeFromBytes(webm, "", "audio")).toBe("audio/webm");
    expect(detectMimeFromBytes(webm, "", "video")).toBe("video/webm");
    expect(detectMimeFromBytes(ogg, "", "video")).toBe("video/ogg");
    expect(detectMimeFromBytes(ogg)).toBe("audio/ogg");
  });

  it("devolve o fallback quando não reconhece", () => {
    expect(detectMimeFromBytes(new TextEncoder().encode("abc"), "x/y")).toBe("x/y");
  });
});

describe("nomes de arquivo para download", () => {
  it("remove caracteres inválidos e pontos iniciais", () => {
    expect(sanitizeDownloadFileName('../re:la*tó?rio<1>.pdf')).toBe("-re-la-tó-rio-1-.pdf");
    expect(sanitizeDownloadFileName("   ")).toBe("arquivo");
  });

  it("adiciona extensão pelo MIME quando falta", () => {
    expect(buildDownloadFileName("nota", "application/pdf")).toBe("nota.pdf");
    expect(buildDownloadFileName("foto.jpeg", "image/png")).toBe("foto.jpeg");
    expect(buildDownloadFileName("", "image/png")).toBe("arquivo-convertido.png");
  });
});
