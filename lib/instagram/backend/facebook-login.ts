import "server-only";
import { GRAPH_API_VERSION } from "./meta-graph-client";
import { SITE_URL } from "@/lib/seo/site";

export const FACEBOOK_LOGIN_PERMISSIONS = ["pages_show_list", "pages_read_engagement", "instagram_basic", "instagram_content_publish"] as const;

export function facebookAppCredentials() {
  const appId = process.env.INSTAGRAM_FACEBOOK_APP_ID;
  const appSecret = process.env.INSTAGRAM_FACEBOOK_APP_SECRET;
  const configId = process.env.INSTAGRAM_FACEBOOK_LOGIN_CONFIG_ID;
  if (!appId || !appSecret || !configId) throw new Error("Facebook Login ainda não está configurado no servidor.");
  return { appId, appSecret, configId };
}

export function facebookRedirectUri(requestUrl: string) {
  const explicit = process.env.INSTAGRAM_FACEBOOK_OAUTH_REDIRECT_URI?.trim();
  const isProduction = process.env.VERCEL_ENV === "production" || (process.env.NODE_ENV === "production" && !process.env.VERCEL_ENV);
  const uri = explicit || (isProduction
    ? `${SITE_URL.replace(/\/$/, "")}/api/instagram/facebook-oauth/callback`
    : new URL("/api/instagram/facebook-oauth/callback", requestUrl).toString());
  const parsed = new URL(uri);
  if (parsed.search || parsed.hash || (process.env.VERCEL_ENV === "production" && parsed.protocol !== "https:")) {
    throw new Error("Callback Facebook Login inválido.");
  }
  return parsed.toString();
}

export function buildFacebookAuthorizeUrl(input: { appId: string; configId: string; redirectUri: string; state: string }) {
  const url = new URL(`https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", input.appId);
  // Facebook Login for Business accepts a saved configuration ID; Meta
  // rejects classic `scope` parameters for this login product.
  url.searchParams.set("config_id", input.configId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", input.state);
  return url.toString();
}

async function graph<T>(path: string, params: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json().catch(() => null) as T & { error?: { message?: string } } | null;
  if (!response.ok || !body) throw new Error(body?.error?.message ?? "A Meta não concluiu a solicitação.");
  return body;
}

export async function exchangeFacebookCode(code: string, redirectUri: string) {
  const { appId, appSecret } = facebookAppCredentials();
  const short = await graph<{ access_token: string; expires_in?: number }>("oauth/access_token", {
    client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code,
  });
  const long = await graph<{ access_token: string; expires_in?: number }>("oauth/access_token", {
    grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret, fb_exchange_token: short.access_token,
  });
  const profile = await graph<{ id: string }>("me", { fields: "id", access_token: long.access_token });
  const expiresInSeconds = long.expires_in ?? 60 * 24 * 60 * 60;
  return { accessToken: long.access_token, facebookUserId: profile.id, expiresAt: new Date(Date.now() + expiresInSeconds * 1000) };
}

export async function refreshFacebookUserToken(userToken: string) {
  const { appId, appSecret } = facebookAppCredentials();
  const result = await graph<{ access_token: string; expires_in?: number }>("oauth/access_token", {
    grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret, fb_exchange_token: userToken,
  });
  return { accessToken: result.access_token, expiresAt: new Date(Date.now() + (result.expires_in ?? 60 * 24 * 60 * 60) * 1000) };
}

export interface ManagedInstagramAccount { pageId: string; pageName: string; pageAccessToken: string; igUserId: string; username: string | null; }

export async function listManagedInstagramAccounts(userToken: string): Promise<ManagedInstagramAccount[]> {
  const accounts: ManagedInstagramAccount[] = [];
  let next: string | null = `https://graph.facebook.com/${GRAPH_API_VERSION}/me/accounts?fields=id,name,access_token,tasks,instagram_business_account{id,username}&limit=100&access_token=${encodeURIComponent(userToken)}`;
  for (let pageNumber = 0; next && pageNumber < 10; pageNumber++) {
    const nextUrl = new URL(next);
    if (nextUrl.protocol !== "https:" || nextUrl.hostname !== "graph.facebook.com" || !nextUrl.pathname.startsWith(`/${GRAPH_API_VERSION}/`)) {
      throw new Error("A Meta retornou uma URL de paginação inválida.");
    }
    const response = await fetch(nextUrl, { cache: "no-store" });
    const body = await response.json().catch(() => null) as { data?: Array<{ id: string; name: string; access_token: string; tasks?: string[]; instagram_business_account?: { id: string; username?: string } }>; paging?: { next?: string }; error?: { message?: string } } | null;
    if (!response.ok || !body) throw new Error(body?.error?.message ?? "Não foi possível consultar as contas gerenciadas.");
    for (const page of body.data ?? []) {
      const ig = page.instagram_business_account;
      const canPublish = page.tasks?.some((task) => task === "CREATE_CONTENT" || task === "MANAGE") ?? false;
      if (ig?.id && page.access_token && canPublish) accounts.push({ pageId: page.id, pageName: page.name, pageAccessToken: page.access_token, igUserId: ig.id, username: ig.username ?? null });
    }
    next = body.paging?.next ?? null;
  }
  return accounts;
}

export async function getGrantedFacebookPermissions(userToken: string): Promise<string[]> {
  const result = await graph<{ data?: Array<{ permission: string; status: string }> }>("me/permissions", { access_token: userToken });
  return (result.data ?? []).filter((item) => item.status === "granted").map((item) => item.permission);
}
