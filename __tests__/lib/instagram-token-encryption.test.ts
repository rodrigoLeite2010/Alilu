// @vitest-environment node
//
// Roda em ambiente "node", não "jsdom" (o padrão do projeto): o pacote
// "server-only" lança erro se `window` existir, e o jsdom sempre define
// `window`. Todo teste de um módulo "server-only" precisa dessa diretiva.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret } from "@/lib/instagram/backend/encryption";

const ORIGINAL_KEY = process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY;

describe("encryptSecret / decryptSecret (AES-256-GCM)", () => {
  beforeEach(() => {
    process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  });

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) {
      delete process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY;
    } else {
      process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY = ORIGINAL_KEY;
    }
  });

  it("decripta de volta exatamente o texto original", () => {
    const original = "IGAAR3z...token-de-exemplo...";
    const encrypted = encryptSecret(original);

    expect(decryptSecret(encrypted)).toBe(original);
  });

  it("o texto cifrado nunca contém o texto original em claro", () => {
    const original = "segredo-super-sensivel-do-instagram";
    const encrypted = encryptSecret(original);

    expect(encrypted).not.toContain(original);
  });

  it("duas cifragens do mesmo texto produzem saídas diferentes (IV aleatório)", () => {
    const original = "mesmo-texto";
    const first = encryptSecret(original);
    const second = encryptSecret(original);

    expect(first).not.toBe(second);
    expect(decryptSecret(first)).toBe(original);
    expect(decryptSecret(second)).toBe(original);
  });

  it("detecta adulteração do texto cifrado (autenticação do GCM)", () => {
    const encrypted = encryptSecret("texto-original");
    const parts = encrypted.split(".");
    const tamperedCiphertext = Buffer.from(parts[2], "base64");
    tamperedCiphertext[0] = tamperedCiphertext[0] ^ 0xff;
    const tampered = [parts[0], parts[1], tamperedCiphertext.toString("base64")].join(".");

    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("lança um erro claro quando a chave de criptografia não está configurada", () => {
    delete process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY;

    expect(() => encryptSecret("qualquer coisa")).toThrow(/INSTAGRAM_TOKEN_ENCRYPTION_KEY/);
  });

  it("lança um erro claro quando a chave configurada não tem o tamanho certo", () => {
    process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY = Buffer.from("chave-curta-demais").toString(
      "base64",
    );

    expect(() => encryptSecret("qualquer coisa")).toThrow(/32 bytes/);
  });
});
