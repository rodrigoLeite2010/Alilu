import { describe, expect, it } from "vitest";
import {
  buildQrCodeContent,
  isLikelyValidUrl,
  isQrCodeInputValid,
  normalizeUrl,
  validateQrCodeInput,
  type QrCodeInput,
} from "@/lib/calculators/qr-code";

describe("isLikelyValidUrl", () => {
  it("aceita URLs completas com esquema", () => {
    expect(isLikelyValidUrl("https://alilu.com.br")).toBe(true);
    expect(isLikelyValidUrl("http://exemplo.com/pagina")).toBe(true);
  });

  it("aceita domínios sem esquema (forma comum de digitar)", () => {
    expect(isLikelyValidUrl("alilu.com.br")).toBe(true);
    expect(isLikelyValidUrl("www.exemplo.com")).toBe(true);
  });

  it("rejeita texto sem ponto (não parece um domínio)", () => {
    expect(isLikelyValidUrl("nãoéumaurl")).toBe(false);
  });

  it("rejeita string vazia ou só espaços", () => {
    expect(isLikelyValidUrl("")).toBe(false);
    expect(isLikelyValidUrl("   ")).toBe(false);
  });

  it("rejeita texto com espaços no meio", () => {
    expect(isLikelyValidUrl("isto não é uma url.com")).toBe(false);
  });
});

describe("normalizeUrl", () => {
  it("mantém o esquema quando já informado", () => {
    expect(normalizeUrl("http://exemplo.com")).toBe("http://exemplo.com");
  });

  it("adiciona https:// quando não há esquema", () => {
    expect(normalizeUrl("alilu.com.br")).toBe("https://alilu.com.br");
  });
});

describe("validateQrCodeInput / buildQrCodeContent", () => {
  const urlInput = (value: string): QrCodeInput => ({ mode: "url", value });
  const textInput = (value: string): QrCodeInput => ({ mode: "text", value });

  it("modo texto aceita qualquer texto não vazio", () => {
    expect(isQrCodeInputValid(textInput("Olá, mundo!"))).toBe(true);
  });

  it("modo texto rejeita texto vazio", () => {
    expect(validateQrCodeInput(textInput("")).value).toBeDefined();
  });

  it("modo url rejeita valor inválido", () => {
    expect(validateQrCodeInput(urlInput("não é url")).value).toBeDefined();
  });

  it("modo url aceita e normaliza domínio sem esquema", () => {
    expect(isQrCodeInputValid(urlInput("alilu.com.br"))).toBe(true);
    expect(buildQrCodeContent(urlInput("alilu.com.br"))).toBe("https://alilu.com.br");
  });

  it("modo texto preserva o texto exatamente como digitado (só remove espaços nas pontas)", () => {
    expect(buildQrCodeContent(textInput("  Texto qualquer  "))).toBe("Texto qualquer");
  });
});
