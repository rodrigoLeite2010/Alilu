// @vitest-environment node
//
// getDonationConfig() lê process.env a cada chamada (não é uma constante
// calculada na importação do módulo, ao contrário de lib/seo/site.ts) —
// então não precisa de vi.resetModules() entre os testes, só ajustar as
// variáveis antes de cada chamada.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDonationConfig } from "@/lib/donation/config";

const ENV_KEYS = [
  "NEXT_PUBLIC_PIX_KEY",
  "NEXT_PUBLIC_PIX_RECEIVER_NAME",
  "NEXT_PUBLIC_PIX_RECEIVER_CITY",
  "NEXT_PUBLIC_DONATION_ENABLED",
] as const;

const originalValues = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

beforeEach(clearEnv);

afterEach(() => {
  for (const key of ENV_KEYS) {
    const original = originalValues[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
});

describe("getDonationConfig", () => {
  it("fica desabilitada quando nenhuma variável está definida (estado padrão sem configuração)", () => {
    const config = getDonationConfig();
    expect(config.enabled).toBe(false);
    expect(config.pixKey).toBe("");
  });

  it("fica habilitada quando todos os dados essenciais estão presentes e a flag não é 'false'", () => {
    process.env.NEXT_PUBLIC_PIX_KEY = "a1f773bb-0c82-4547-b195-55a9ac4ee748";
    process.env.NEXT_PUBLIC_PIX_RECEIVER_NAME = "Rodrigo Soares Leite";
    process.env.NEXT_PUBLIC_PIX_RECEIVER_CITY = "SAO PAULO";

    const config = getDonationConfig();

    expect(config.enabled).toBe(true);
    expect(config.pixKey).toBe("a1f773bb-0c82-4547-b195-55a9ac4ee748");
    expect(config.receiverName).toBe("Rodrigo Soares Leite");
    expect(config.receiverCity).toBe("SAO PAULO");
  });

  it("NEXT_PUBLIC_DONATION_ENABLED=false desliga mesmo com todos os dados presentes", () => {
    process.env.NEXT_PUBLIC_PIX_KEY = "a1f773bb-0c82-4547-b195-55a9ac4ee748";
    process.env.NEXT_PUBLIC_PIX_RECEIVER_NAME = "Rodrigo Soares Leite";
    process.env.NEXT_PUBLIC_PIX_RECEIVER_CITY = "SAO PAULO";
    process.env.NEXT_PUBLIC_DONATION_ENABLED = "false";

    expect(getDonationConfig().enabled).toBe(false);
  });

  it("uma chave Pix ausente desliga a doação mesmo com a flag ligada", () => {
    process.env.NEXT_PUBLIC_PIX_RECEIVER_NAME = "Rodrigo Soares Leite";
    process.env.NEXT_PUBLIC_PIX_RECEIVER_CITY = "SAO PAULO";
    process.env.NEXT_PUBLIC_DONATION_ENABLED = "true";

    expect(getDonationConfig().enabled).toBe(false);
  });

  it("nome ou cidade ausentes desligam a doação (payload Pix exige os dois)", () => {
    process.env.NEXT_PUBLIC_PIX_KEY = "a1f773bb-0c82-4547-b195-55a9ac4ee748";
    process.env.NEXT_PUBLIC_PIX_RECEIVER_NAME = "Rodrigo Soares Leite";
    // cidade ausente
    expect(getDonationConfig().enabled).toBe(false);
  });

  it("string vazia ou só espaços conta como ausente (mesmo cuidado do bug real em SITE_URL)", () => {
    process.env.NEXT_PUBLIC_PIX_KEY = "   ";
    process.env.NEXT_PUBLIC_PIX_RECEIVER_NAME = "Rodrigo Soares Leite";
    process.env.NEXT_PUBLIC_PIX_RECEIVER_CITY = "SAO PAULO";

    expect(getDonationConfig().enabled).toBe(false);
    expect(getDonationConfig().pixKey).toBe("");
  });
});
