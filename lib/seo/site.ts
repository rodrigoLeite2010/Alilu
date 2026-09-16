/**
 * Constantes de SEO/branding compartilhadas por toda a plataforma.
 * Centralizadas aqui para nunca serem duplicadas em componentes ou páginas.
 */

export const SITE_NAME = "ALILU Utilitários";

/**
 * Lê `NEXT_PUBLIC_SITE_URL` do ambiente, tratando como "não definida" tanto
 * a ausência da variável quanto uma string vazia ou só com espaços.
 *
 * Correção de um bug real de deploy: o build da Vercel falhava com
 * `TypeError: Invalid URL` em `new URL(SITE_URL)` (app/layout.tsx) porque o
 * projeto tinha `NEXT_PUBLIC_SITE_URL` configurada na Vercel como string
 * vazia (""). Como `??` (nullish coalescing) só cai no valor padrão para
 * `null`/`undefined` — nunca para uma string vazia, que é um valor válido,
 * só "falsy" — o resultado era `SITE_URL === ""`, e `new URL("")` lança
 * exceção. Esta função trata explicitamente string vazia/só espaços como
 * equivalente a "não definida", para que o fallback funcione nos dois
 * casos.
 */
function readSiteUrlFromEnv(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return raw ? raw.replace(/\/$/, "") : null;
}

export const SITE_URL = readSiteUrlFromEnv() ?? "https://alilu.com.br";

export const SITE_DESCRIPTION =
  "Caixa de ferramentas online gratuita com calculadoras e utilitários para o seu dia a dia: trabalho, financeiro, empresa e muito mais.";

export const SITE_TITLE_TEMPLATE = `%s | ${SITE_NAME}`;
