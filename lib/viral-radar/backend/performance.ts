import "server-only";
import { getDb } from "@/lib/db/client";
import { decryptSecret } from "@/lib/instagram/backend/encryption";
import { getFacebookPageTokenForUser } from "@/lib/facebook/backend/facebook-page-repository";
import { insertPostMetrics, listPublishedForMonitoring, type PublishedForMonitoring } from "./radar-repository";

/**
 * Monitoramento das publicações PRÓPRIAS geradas pelo radar, só com APIs e
 * permissões que a conta já tem:
 *   - Instagram (instagram_business_basic / instagram_basic): like_count e
 *     comments_count da mídia publicada. Visualizações, alcance,
 *     salvamentos e compartilhamentos exigem a permissão de insights
 *     (instagram_business_manage_insights / instagram_manage_insights) —
 *     consultados só se a conta tiver o escopo; caso contrário ficam
 *     registrados como INDISPONÍVEIS (nunca estimados).
 *   - Facebook (pages_read_engagement): curtidas e comentários do Reel.
 *     Visualizações exigem read_insights → indisponível.
 */

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
const GRAPH_VERSION = "v25.0";
const INSIGHT_SCOPES = ["instagram_business_manage_insights", "instagram_manage_insights"];

interface AccountRow {
  igUserId: string;
  token: string;
  host: string;
  scopes: string[];
}

async function loadAccount(userId: string, accountId: string): Promise<AccountRow | null> {
  const db = getDb();
  const rows = await db`
    select ig_user_id, access_token_encrypted, auth_provider, scopes, status from instagram_accounts where id = ${accountId} and user_id = ${userId}
  `;
  const row = rows[0];
  if (!row || row.status !== "connected" || !row.access_token_encrypted) return null;
  return {
    igUserId: row.ig_user_id as string,
    token: decryptSecret(row.access_token_encrypted as string),
    host: row.auth_provider === "facebook_login" ? "graph.facebook.com" : "graph.instagram.com",
    scopes: String(row.scopes ?? "").split(",").map((scope) => scope.trim()).filter(Boolean),
  };
}

async function getJson(fetchImpl: FetchLike, url: URL): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetchImpl(url.toString(), { signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

export interface MonitorResult {
  checked: number;
  saved: number;
}

async function monitorInstagram(entry: PublishedForMonitoring, fetchImpl: FetchLike): Promise<number> {
  if (!entry.igMediaId) return 0;
  const account = await loadAccount(entry.userId, entry.instagramAccountId);
  if (!account) return 0;
  const unavailable: string[] = [];
  const base = new URL(`https://${account.host}/${GRAPH_VERSION}/${entry.igMediaId}`);
  base.searchParams.set("fields", "like_count,comments_count");
  base.searchParams.set("access_token", account.token);
  const basic = await getJson(fetchImpl, base);
  if (!basic) return 0;
  let views: number | null = null;
  let reach: number | null = null;
  let saves: number | null = null;
  let shares: number | null = null;
  if (account.scopes.some((scope) => INSIGHT_SCOPES.includes(scope))) {
    const insights = new URL(`https://${account.host}/${GRAPH_VERSION}/${entry.igMediaId}/insights`);
    insights.searchParams.set("metric", "views,reach,saved,shares");
    insights.searchParams.set("access_token", account.token);
    const body = await getJson(fetchImpl, insights);
    const data = Array.isArray(body?.data) ? (body!.data as Array<{ name?: string; values?: Array<{ value?: number }>; total_value?: { value?: number } }>) : [];
    const metric = (name: string) => {
      const item = data.find((entryItem) => entryItem.name === name);
      return num(item?.total_value?.value ?? item?.values?.[0]?.value);
    };
    views = metric("views");
    reach = metric("reach");
    saves = metric("saved");
    shares = metric("shares");
  }
  if (views === null) unavailable.push("views");
  if (reach === null) unavailable.push("reach");
  if (saves === null) unavailable.push("saves");
  if (shares === null) unavailable.push("shares");
  const likes = num(basic.like_count);
  const comments = num(basic.comments_count);
  if (likes === null) unavailable.push("likes");
  if (comments === null) unavailable.push("comments");
  await insertPostMetrics({
    userId: entry.userId,
    radarId: entry.radarId,
    queueItemId: entry.queueItemId,
    postId: entry.postId,
    platform: "instagram",
    externalId: entry.igMediaId,
    views,
    reach,
    likes,
    comments,
    shares,
    saves,
    unavailable,
  });
  return 1;
}

async function monitorFacebook(entry: PublishedForMonitoring, fetchImpl: FetchLike): Promise<number> {
  let saved = 0;
  for (const destination of entry.facebook) {
    if (!destination.pageRef || !destination.externalId) continue;
    const page = await getFacebookPageTokenForUser(destination.pageRef, entry.userId);
    if (!page?.tokenEncrypted || page.page.status !== "connected") continue;
    const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${destination.externalId}`);
    url.searchParams.set("fields", "likes.summary(true).limit(0),comments.summary(true).limit(0)");
    url.searchParams.set("access_token", decryptSecret(page.tokenEncrypted));
    const body = await getJson(fetchImpl, url);
    if (!body) continue;
    const summary = (key: string) => num(((body[key] as Record<string, unknown> | undefined)?.summary as Record<string, unknown> | undefined)?.total_count);
    const likes = summary("likes");
    const comments = summary("comments");
    const unavailable = ["views", "reach", "shares", "saves"];
    if (likes === null) unavailable.push("likes");
    if (comments === null) unavailable.push("comments");
    await insertPostMetrics({
      userId: entry.userId,
      radarId: entry.radarId,
      queueItemId: entry.queueItemId,
      postId: entry.postId,
      platform: "facebook",
      externalId: destination.externalId,
      views: null,
      reach: null,
      likes,
      comments,
      shares: null,
      saves: null,
      unavailable,
    });
    saved += 1;
  }
  return saved;
}

/** Coleta métricas de até `limit` publicações (no máximo uma vez a cada `minHours` por publicação). */
export async function monitorPublishedPosts(options: { limit?: number; minHours?: number; fetchImpl?: FetchLike; deadline?: number } = {}): Promise<MonitorResult> {
  const fetchImpl = options.fetchImpl ?? ((input: string, init?: RequestInit) => fetch(input, init));
  const entries = await listPublishedForMonitoring(options.minHours ?? 6, options.limit ?? 20);
  let saved = 0;
  let checked = 0;
  for (const entry of entries) {
    if (options.deadline && Date.now() > options.deadline) break;
    checked += 1;
    try {
      saved += await monitorInstagram(entry, fetchImpl);
      saved += await monitorFacebook(entry, fetchImpl);
    } catch (error) {
      console.error(JSON.stringify({ scope: "viral-radar", event: "monitor.failed", queueItemId: entry.queueItemId, message: (error as Error)?.message?.slice(0, 200) }));
    }
  }
  return { checked, saved };
}
