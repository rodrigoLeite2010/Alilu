/**
 * Constantes de SEO/branding compartilhadas por toda a plataforma.
 * Centralizadas aqui para nunca serem duplicadas em componentes ou páginas.
 */

export const SITE_NAME = "ALILU Utilitários";

export const DEFAULT_SITE_URL = "https://alilu.com.br";

/**
 * Normaliza a origem pública usada em sitemap, canonical e Open Graph.
 * Entradas vazias, inválidas ou com esquema não HTTP(S) voltam ao domínio
 * canônico; `http` e `www` nunca chegam aos metadados publicados.
 */
function readSiteUrlFromEnv(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) {
    return null;
  }

  try {
    const url = new URL(raw);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password
    ) {
      return null;
    }

    url.protocol = "https:";
    url.hostname = url.hostname.replace(/^www\./i, "");
    url.port = "";
    return url.origin;
  } catch {
    return null;
  }
}

export const SITE_URL = readSiteUrlFromEnv() ?? DEFAULT_SITE_URL;

export const SITE_DESCRIPTION =
  "Caixa de ferramentas online gratuita com calculadoras e utilitários para o seu dia a dia: trabalho, financeiro, empresa e muito mais.";

export const SITE_TITLE_TEMPLATE = `%s | ${SITE_NAME}`;
