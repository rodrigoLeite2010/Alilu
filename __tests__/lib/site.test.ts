import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Testes de `lib/seo/site.ts` — em especial a correção de um bug real de
 * deploy: o build de produção (Vercel) falhava com
 * `TypeError [ERR_INVALID_URL]: Invalid URL` em `new URL(SITE_URL)`
 * (app/layout.tsx) porque a variável de ambiente `NEXT_PUBLIC_SITE_URL`
 * estava configurada na Vercel como string vazia (""), e o código original
 * usava `??`, que só cai no valor padrão para `null`/`undefined` — nunca
 * para uma string vazia. `SITE_URL` é uma constante calculada na
 * importação do módulo, então cada teste reimporta o módulo (com
 * `vi.resetModules()`) depois de ajustar a variável de ambiente.
 */

const ENV_KEY = "NEXT_PUBLIC_SITE_URL";
const originalValue = process.env[ENV_KEY];

async function importSiteModule() {
  vi.resetModules();
  return import("@/lib/seo/site");
}

describe("SITE_URL", () => {
  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = originalValue;
    }
  });

  it("usa o valor padrão quando a variável não está definida", async () => {
    delete process.env[ENV_KEY];
    const { SITE_URL } = await importSiteModule();
    expect(SITE_URL).toBe("https://alilu.com.br");
    expect(() => new URL(SITE_URL)).not.toThrow();
  });

  it("usa o valor padrão quando a variável está definida como string vazia (bug real de deploy)", async () => {
    process.env[ENV_KEY] = "";
    const { SITE_URL } = await importSiteModule();
    expect(SITE_URL).toBe("https://alilu.com.br");
    expect(() => new URL(SITE_URL)).not.toThrow();
  });

  it("usa o valor padrão quando a variável contém só espaços em branco", async () => {
    process.env[ENV_KEY] = "   ";
    const { SITE_URL } = await importSiteModule();
    expect(SITE_URL).toBe("https://alilu.com.br");
    expect(() => new URL(SITE_URL)).not.toThrow();
  });

  it("usa o valor customizado quando definido, removendo a barra final", async () => {
    process.env[ENV_KEY] = "https://exemplo.com.br/";
    const { SITE_URL } = await importSiteModule();
    expect(SITE_URL).toBe("https://exemplo.com.br");
  });

  it("mantém o valor customizado sem barra final inalterado", async () => {
    process.env[ENV_KEY] = "https://exemplo.com.br";
    const { SITE_URL } = await importSiteModule();
    expect(SITE_URL).toBe("https://exemplo.com.br");
  });

  it("normaliza HTTP, www e caminhos para uma única origem HTTPS", async () => {
    process.env[ENV_KEY] = "http://www.exemplo.com.br/catalogo?origem=teste";
    const { SITE_URL } = await importSiteModule();
    expect(SITE_URL).toBe("https://exemplo.com.br");
  });

  it("usa o valor padrão para uma URL inválida ou com esquema inseguro", async () => {
    process.env[ENV_KEY] = "ftp://alilu.com.br";
    const { SITE_URL } = await importSiteModule();
    expect(SITE_URL).toBe("https://alilu.com.br");
  });
});
