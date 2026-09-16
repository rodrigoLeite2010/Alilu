/**
 * Constantes de SEO/branding compartilhadas por toda a plataforma.
 * Centralizadas aqui para nunca serem duplicadas em componentes ou páginas.
 */

export const SITE_NAME = "ALILU Utilitários";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://alilu.com.br";

export const SITE_DESCRIPTION =
  "Caixa de ferramentas online gratuita com calculadoras e utilitários para o seu dia a dia: trabalho, financeiro, empresa e muito mais.";

export const SITE_TITLE_TEMPLATE = `%s | ${SITE_NAME}`;
