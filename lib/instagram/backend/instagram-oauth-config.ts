import { SITE_URL } from "@/lib/seo/site";

/**
 * Configuração central do login do Instagram (Instagram API with Instagram
 * Login / "Business Login for Instagram"). Tudo que precisa ser IGUAL no
 * Alilu e no painel Meta Developers mora aqui — nunca espalhado.
 * Ver docs/meta-instagram-production.md.
 */

export const INSTAGRAM_OAUTH_CALLBACK_PATH = "/api/instagram/oauth/callback";
export const INSTAGRAM_OAUTH_START_PATH = "/api/instagram/oauth/start";
/** Tela amigável de resultado (sucesso, cancelado, erro). */
export const INSTAGRAM_OAUTH_RESULT_PATH = "/instagram/conectado";

/**
 * Permissões pedidas — só o que o Alilu usa (documentação "Business Login
 * for Instagram", escopos novos desde 27/01/2025):
 *  - instagram_business_basic: identificar a conta (id, @usuário, tipo de
 *    conta). Obrigatória para qualquer uso da API.
 *  - instagram_business_content_publish: publicar post de imagem, carrossel,
 *    Reels e Stories (usado pelo Agendador e pelo Piloto Automático).
 * NÃO pedimos mensagens (instagram_business_manage_messages) nem
 * comentários (instagram_business_manage_comments): o Alilu não usa.
 */
export const INSTAGRAM_OAUTH_SCOPES = ["instagram_business_basic", "instagram_business_content_publish"] as const;
export const INSTAGRAM_PUBLISH_SCOPE = "instagram_business_content_publish";

export class InstagramRedirectConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstagramRedirectConfigError";
  }
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname.endsWith(".localhost");
}

/**
 * redirect_uri ÚNICO por ambiente (precisa ser idêntico no início, na troca
 * do código e no painel da Meta):
 *  1. INSTAGRAM_OAUTH_REDIRECT_URI, se definida (ex.: preview com domínio próprio);
 *  2. produção: `${SITE_URL}/api/instagram/oauth/callback` (https://alilu.com.br/…);
 *  3. desenvolvimento local: a origem da própria requisição (http://localhost:3000/…).
 * Em produção, localhost/http são recusados.
 */
export function getInstagramRedirectUri(requestUrl?: string, env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.INSTAGRAM_OAUTH_REDIRECT_URI?.trim();
  const isProduction = env.VERCEL_ENV === "production" || (env.NODE_ENV === "production" && !env.VERCEL_ENV);
  let candidate: string;
  if (explicit) {
    candidate = explicit;
  } else if (isProduction || !requestUrl) {
    candidate = `${SITE_URL.replace(/\/$/, "")}${INSTAGRAM_OAUTH_CALLBACK_PATH}`;
  } else {
    candidate = new URL(INSTAGRAM_OAUTH_CALLBACK_PATH, requestUrl).toString();
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new InstagramRedirectConfigError("INSTAGRAM_OAUTH_REDIRECT_URI inválida.");
  }
  if (isProduction && (url.protocol !== "https:" || isLocalHost(url.hostname))) {
    throw new InstagramRedirectConfigError("Em produção o redirect_uri do Instagram precisa ser https e não pode ser localhost.");
  }
  if (url.search || url.hash) {
    throw new InstagramRedirectConfigError("O redirect_uri do Instagram não pode ter query string nem #.");
  }
  return url.toString();
}

/** Origem (protocolo + host) do redirect_uri — o fluxo inteiro precisa rodar nela por causa do cookie de state. */
export function getInstagramOAuthOrigin(requestUrl?: string, env: NodeJS.ProcessEnv = process.env): string {
  return new URL(getInstagramRedirectUri(requestUrl, env)).origin;
}
