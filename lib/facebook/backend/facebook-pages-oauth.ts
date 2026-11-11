import "server-only";
import { GRAPH_API_VERSION } from "@/lib/instagram/backend/meta-graph-client";
import { SITE_URL } from "@/lib/seo/site";

/**
 * Conexão de PÁGINAS do Facebook para publicação (Pages API).
 *
 * Modalidade: Facebook Login for Business (o MESMO app Meta já usado pelo
 * fluxo "Instagram via Facebook Login"), com uma CONFIGURAÇÃO de login
 * própria — FACEBOOK_PAGES_LOGIN_CONFIG_ID — contendo só as permissões de
 * Páginas abaixo. Separado do fluxo do Instagram:
 *   - callback próprio (/api/facebook/pages/oauth/callback);
 *   - tentativas OAuth com purpose = 'facebook_pages';
 *   - token da Página guardado em facebook_pages (nunca sobrescreve o
 *     token de nenhuma conta do Instagram).
 * O fluxo "Instagram API with Instagram Login" (graph.instagram.com) não
 * é tocado: ele não dá acesso a Páginas.
 */

/**
 *  - pages_show_list: listar as Páginas que a pessoa administra (/me/accounts);
 *  - pages_read_engagement: ler dados da Página, posts publicados (reconciliação
 *    anti-duplicidade) e o estado/direitos autorais dos Reels;
 *  - pages_manage_posts: criar posts, fotos e Reels na Página.
 */
export const FACEBOOK_PAGES_PERMISSIONS = ["pages_show_list", "pages_read_engagement", "pages_manage_posts"] as const;
export const FACEBOOK_PAGES_CALLBACK_PATH = "/api/facebook/pages/oauth/callback";
export const FACEBOOK_PAGES_SELECT_PATH = "/instagram/facebook-paginas";

export function facebookPagesConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.INSTAGRAM_FACEBOOK_APP_ID && env.INSTAGRAM_FACEBOOK_APP_SECRET && env.FACEBOOK_PAGES_LOGIN_CONFIG_ID);
}

export function facebookPagesCredentials(env: NodeJS.ProcessEnv = process.env) {
  const appId = env.INSTAGRAM_FACEBOOK_APP_ID;
  const appSecret = env.INSTAGRAM_FACEBOOK_APP_SECRET;
  const configId = env.FACEBOOK_PAGES_LOGIN_CONFIG_ID;
  if (!appId || !appSecret || !configId) throw new Error("A conexão de Páginas do Facebook ainda não está configurada no servidor.");
  return { appId, appSecret, configId };
}

export function facebookPagesRedirectUri(requestUrl: string, env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.FACEBOOK_PAGES_OAUTH_REDIRECT_URI?.trim();
  const isProduction = env.VERCEL_ENV === "production" || (env.NODE_ENV === "production" && !env.VERCEL_ENV);
  const uri = explicit || (isProduction
    ? `${SITE_URL.replace(/\/$/, "")}${FACEBOOK_PAGES_CALLBACK_PATH}`
    : new URL(FACEBOOK_PAGES_CALLBACK_PATH, requestUrl).toString());
  const parsed = new URL(uri);
  if (parsed.search || parsed.hash) throw new Error("Callback de Páginas do Facebook inválido.");
  if (isProduction && parsed.protocol !== "https:") throw new Error("Em produção o callback de Páginas precisa ser https.");
  return parsed.toString();
}

export function buildFacebookPagesAuthorizeUrl(input: { appId: string; configId: string; redirectUri: string; state: string }): string {
  const url = new URL(`https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", input.appId);
  url.searchParams.set("config_id", input.configId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", input.state);
  return url.toString();
}

export function missingFacebookPagesPermissions(granted: string[]): string[] {
  return FACEBOOK_PAGES_PERMISSIONS.filter((permission) => !granted.includes(permission));
}
