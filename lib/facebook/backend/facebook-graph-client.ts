import "server-only";
import { GRAPH_API_VERSION } from "@/lib/instagram/backend/meta-graph-client";

/**
 * Cliente cru da Graph API para PÁGINAS do Facebook (Pages API + Reels
 * Publishing API). Só HTTP + parsing defensivo; nenhuma regra de negócio,
 * nenhum acesso a banco. Usa a MESMA versão da Graph API do restante do
 * projeto (GRAPH_API_VERSION) e sempre o host graph.facebook.com — nunca
 * graph.instagram.com (são modalidades diferentes e não se misturam).
 *
 * Endpoints (documentação oficial da Meta, developers.facebook.com):
 *   GET  /me/accounts                          → Páginas + Page Access Token + tasks
 *   POST /{page-id}/photos                     → foto (published=true) ou foto não publicada (published=false)
 *   POST /{page-id}/feed  attached_media[]     → um único post com várias fotos
 *   GET  /{page-id}/published_posts            → reconciliação após resultado desconhecido
 *   POST /{page-id}/video_reels upload_phase=start|finish
 *   POST https://rupload.facebook.com/video-upload/{version}/{video-id}  (header file_url)
 *   GET  /{video-id}?fields=status             → estado de upload/processamento/publicação
 *
 * Tokens: o Page Access Token vai SEMPRE no corpo (POST) ou no header
 * (rupload) — nunca é registrado em log e nunca faz parte de `details`.
 */

const GRAPH_HOST = "graph.facebook.com";
const RUPLOAD_HOST = "rupload.facebook.com";
const REQUEST_TIMEOUT_MS = 25_000;

export class FacebookGraphApiError extends Error {
  /** Corpo de erro da Meta (`{ error: { code, error_subcode, ... } }`) — nunca contém o token. */
  readonly details: unknown;
  /** true quando não sabemos se a Meta executou o pedido (timeout / rede caiu após o envio). */
  readonly unknownOutcome: boolean;

  constructor(message: string, details?: unknown, unknownOutcome = false) {
    super(message);
    this.name = "FacebookGraphApiError";
    this.details = details;
    this.unknownOutcome = unknownOutcome;
  }
}

function graphUrl(path: string): URL {
  return new URL(`https://${GRAPH_HOST}/${GRAPH_API_VERSION}/${path.replace(/^\//, "")}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Remove qualquer access_token que a Meta eventualmente ecoe (paginação, mensagens). */
export function redactTokens(value: unknown): unknown {
  if (typeof value === "string") return value.replace(/access_token=[^&\s"]+/g, "access_token=[redacted]");
  if (Array.isArray(value)) return value.map(redactTokens);
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = key === "access_token" ? "[redacted]" : redactTokens(item);
    }
    return out;
  }
  return value;
}

interface RequestOptions {
  method: "GET" | "POST" | "DELETE";
  url: URL;
  form?: Record<string, string>;
  headers?: Record<string, string>;
  /** POST não idempotente: timeout/rede após envio = resultado desconhecido. */
  nonIdempotent?: boolean;
  errorMessage: string;
}

async function request(options: RequestOptions): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(options.url, {
      method: options.method,
      headers: options.headers,
      body: options.form ? new URLSearchParams(options.form) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    // Rede/timeout: num POST não idempotente não dá para saber se a Meta
    // recebeu e executou o pedido — quem chama precisa reconciliar.
    throw new FacebookGraphApiError(`${options.errorMessage} (sem resposta da Meta)`, null, Boolean(options.nonIdempotent));
  }
  const payload = await readJson(response);
  if (!response.ok || !isRecord(payload) || isRecord(payload.error)) {
    // 5xx com corpo ilegível num POST não idempotente também é resultado desconhecido.
    const unknown = Boolean(options.nonIdempotent) && response.status >= 500 && !isRecord((payload as Record<string, unknown> | null)?.error);
    throw new FacebookGraphApiError(options.errorMessage, redactTokens(payload), unknown);
  }
  return payload;
}

function requireString(payload: Record<string, unknown>, key: string, message: string): string {
  const value = payload[key];
  if (typeof value === "string" && value) return value;
  if (typeof value === "number") return String(value);
  throw new FacebookGraphApiError(message, redactTokens(payload));
}

// ---------------------------------------------------------------------------
// Páginas administradas
// ---------------------------------------------------------------------------

export interface ManagedFacebookPage {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  tasks: string[];
  /** true quando a pessoa pode criar conteúdo na Página (CREATE_CONTENT ou MANAGE). */
  canPublish: boolean;
  linkedIgUserId: string | null;
  linkedIgUsername: string | null;
}

/** Todas as Páginas que o usuário autorizou para o app (paginado, com trava de host/versão). */
export async function listManagedFacebookPages(userToken: string): Promise<ManagedFacebookPage[]> {
  const pages: ManagedFacebookPage[] = [];
  const first = graphUrl("me/accounts");
  first.searchParams.set("fields", "id,name,access_token,tasks,instagram_business_account{id,username}");
  first.searchParams.set("limit", "100");
  first.searchParams.set("access_token", userToken);
  let next: URL | null = first;
  for (let pageNumber = 0; next && pageNumber < 10; pageNumber++) {
    if (next.protocol !== "https:" || next.hostname !== GRAPH_HOST || !next.pathname.startsWith(`/${GRAPH_API_VERSION}/`)) {
      throw new FacebookGraphApiError("A Meta retornou uma URL de paginação inválida.");
    }
    const body = await request({ method: "GET", url: next, errorMessage: "Não foi possível consultar as Páginas do Facebook." });
    const data = Array.isArray(body.data) ? body.data : [];
    for (const raw of data) {
      if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.name !== "string") continue;
      const tasks = Array.isArray(raw.tasks) ? raw.tasks.filter((task): task is string => typeof task === "string") : [];
      const ig = isRecord(raw.instagram_business_account) ? raw.instagram_business_account : null;
      pages.push({
        pageId: raw.id,
        pageName: raw.name,
        pageAccessToken: typeof raw.access_token === "string" ? raw.access_token : "",
        tasks,
        canPublish: tasks.includes("CREATE_CONTENT") || tasks.includes("MANAGE"),
        linkedIgUserId: ig && typeof ig.id === "string" ? ig.id : null,
        linkedIgUsername: ig && typeof ig.username === "string" ? ig.username : null,
      });
    }
    const paging = isRecord(body.paging) ? body.paging : null;
    next = paging && typeof paging.next === "string" ? new URL(paging.next) : null;
  }
  return pages;
}

export interface PageTokenCheck {
  pageId: string;
  pageName: string;
  linkedIgUserId: string | null;
  linkedIgUsername: string | null;
}

/** Valida o Page Access Token consultando a própria Página (erro 190 = token inválido/expirado). */
export async function getPageWithToken(pageId: string, pageToken: string): Promise<PageTokenCheck> {
  const url = graphUrl(encodeURIComponent(pageId));
  url.searchParams.set("fields", "id,name,instagram_business_account{id,username}");
  url.searchParams.set("access_token", pageToken);
  const body = await request({ method: "GET", url, errorMessage: "Não foi possível validar a conexão com a Página." });
  const ig = isRecord(body.instagram_business_account) ? body.instagram_business_account : null;
  return {
    pageId: requireString(body, "id", "Resposta inesperada da Meta ao validar a Página."),
    pageName: typeof body.name === "string" ? body.name : "",
    linkedIgUserId: ig && typeof ig.id === "string" ? ig.id : null,
    linkedIgUsername: ig && typeof ig.username === "string" ? ig.username : null,
  };
}

// ---------------------------------------------------------------------------
// Fotos e posts com várias fotos
// ---------------------------------------------------------------------------

export interface PagePhotoResult {
  photoId: string;
  /** Id do post da Página (formato {page-id}_{post-id}) quando a foto foi publicada. */
  postId: string | null;
}

/** Publica UMA foto na Página (vira um post). NÃO idempotente. */
export async function publishPagePhoto(input: { pageId: string; pageToken: string; imageUrl: string; message: string }): Promise<PagePhotoResult> {
  const body = await request({
    method: "POST",
    url: graphUrl(`${encodeURIComponent(input.pageId)}/photos`),
    form: { url: input.imageUrl, message: input.message, published: "true", access_token: input.pageToken },
    nonIdempotent: true,
    errorMessage: "O Facebook recusou a foto.",
  });
  return {
    photoId: requireString(body, "id", "Resposta inesperada da Meta ao publicar a foto."),
    postId: typeof body.post_id === "string" ? body.post_id : null,
  };
}

/** Envia uma foto NÃO publicada (invisível) para depois anexar a um post com várias fotos. */
export async function uploadUnpublishedPagePhoto(input: { pageId: string; pageToken: string; imageUrl: string }): Promise<string> {
  const body = await request({
    method: "POST",
    url: graphUrl(`${encodeURIComponent(input.pageId)}/photos`),
    form: { url: input.imageUrl, published: "false", access_token: input.pageToken },
    errorMessage: "O Facebook recusou uma das fotos.",
  });
  return requireString(body, "id", "Resposta inesperada da Meta ao enviar a foto.");
}

/** Cria UM post no feed da Página com as fotos já enviadas, na ordem dada. NÃO idempotente. */
export async function createPageMultiPhotoPost(input: { pageId: string; pageToken: string; message: string; photoIds: string[] }): Promise<string> {
  const form: Record<string, string> = { message: input.message, access_token: input.pageToken };
  input.photoIds.forEach((photoId, index) => {
    form[`attached_media[${index}]`] = JSON.stringify({ media_fbid: photoId });
  });
  const body = await request({
    method: "POST",
    url: graphUrl(`${encodeURIComponent(input.pageId)}/feed`),
    form,
    nonIdempotent: true,
    errorMessage: "O Facebook não criou o post com várias fotos.",
  });
  return requireString(body, "id", "Resposta inesperada da Meta ao criar o post.");
}

/** Remove um objeto criado pelo app (ex.: foto não publicada órfã). Melhor esforço. */
export async function deletePageObject(objectId: string, pageToken: string): Promise<void> {
  const url = graphUrl(encodeURIComponent(objectId));
  url.searchParams.set("access_token", pageToken);
  await request({ method: "DELETE", url, errorMessage: "Falha ao remover mídia temporária." });
}

export interface PagePostSummary {
  id: string;
  message: string;
  createdTime: Date | null;
  permalinkUrl: string | null;
}

/** Posts publicados da Página desde `since` — usado para reconciliar um POST com resultado desconhecido. */
export async function listRecentPagePosts(input: { pageId: string; pageToken: string; since: Date }): Promise<PagePostSummary[]> {
  const url = graphUrl(`${encodeURIComponent(input.pageId)}/published_posts`);
  url.searchParams.set("fields", "id,message,created_time,permalink_url");
  url.searchParams.set("since", String(Math.floor(input.since.getTime() / 1000)));
  url.searchParams.set("limit", "50");
  url.searchParams.set("access_token", input.pageToken);
  const body = await request({ method: "GET", url, errorMessage: "Não foi possível consultar os posts da Página." });
  const data = Array.isArray(body.data) ? body.data : [];
  return data.filter(isRecord).filter((row) => typeof row.id === "string").map((row) => ({
    id: row.id as string,
    message: typeof row.message === "string" ? row.message : "",
    createdTime: typeof row.created_time === "string" ? new Date(row.created_time) : null,
    permalinkUrl: typeof row.permalink_url === "string" ? row.permalink_url : null,
  }));
}

/** Link público do post (melhor esforço — sem link, o histórico só não mostra "Ver publicação"). */
export async function getPagePostPermalink(postId: string, pageToken: string): Promise<string | null> {
  try {
    const url = graphUrl(encodeURIComponent(postId));
    url.searchParams.set("fields", "permalink_url");
    url.searchParams.set("access_token", pageToken);
    const body = await request({ method: "GET", url, errorMessage: "permalink" });
    return typeof body.permalink_url === "string" ? body.permalink_url : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Reels (upload em fases)
// ---------------------------------------------------------------------------

/** Fase 1: reserva um video_id. Idempotente na prática: só é chamada quando ainda não há video_id salvo. */
export async function startPageReelUpload(input: { pageId: string; pageToken: string }): Promise<string> {
  const body = await request({
    method: "POST",
    url: graphUrl(`${encodeURIComponent(input.pageId)}/video_reels`),
    form: { upload_phase: "start", access_token: input.pageToken },
    errorMessage: "O Facebook não iniciou o envio do Reel.",
  });
  return requireString(body, "video_id", "Resposta inesperada da Meta ao iniciar o Reel.");
}

/** Fase 2: a Meta baixa o vídeo da URL pública (Vercel Blob). Repetir para o mesmo video_id é seguro. */
export async function uploadPageReelFromUrl(input: { videoId: string; pageToken: string; fileUrl: string }): Promise<void> {
  const url = new URL(`https://${RUPLOAD_HOST}/video-upload/${GRAPH_API_VERSION}/${encodeURIComponent(input.videoId)}`);
  const body = await request({
    method: "POST",
    url,
    headers: { Authorization: `OAuth ${input.pageToken}`, file_url: input.fileUrl },
    errorMessage: "O Facebook não recebeu o vídeo do Reel.",
  });
  if (body.success !== true) throw new FacebookGraphApiError("O Facebook não confirmou o envio do vídeo.", redactTokens(body));
}

/** Fase 3: pede a publicação do Reel. Atrelado ao video_id — nunca cria um segundo Reel. */
export async function finishPageReel(input: { pageId: string; pageToken: string; videoId: string; description: string }): Promise<void> {
  const body = await request({
    method: "POST",
    url: graphUrl(`${encodeURIComponent(input.pageId)}/video_reels`),
    form: {
      upload_phase: "finish",
      video_id: input.videoId,
      video_state: "PUBLISHED",
      description: input.description,
      access_token: input.pageToken,
    },
    errorMessage: "O Facebook não aceitou a publicação do Reel.",
  });
  if (body.success !== true) throw new FacebookGraphApiError("O Facebook não confirmou a publicação do Reel.", redactTokens(body));
}

export interface ReelStatus {
  videoStatus: string | null;
  uploadingStatus: string | null;
  processingStatus: string | null;
  publishingStatus: string | null;
  /** publish_status do publishing_phase, quando a Meta informar (ex.: "published"). */
  publishStatus: string | null;
  errorMessage: string | null;
}

function phase(status: Record<string, unknown>, key: string): Record<string, unknown> | null {
  return isRecord(status[key]) ? (status[key] as Record<string, unknown>) : null;
}

/** Interpreta `GET /{video-id}?fields=status` (função pura, exportada para teste). */
export function parseReelStatus(payload: unknown): ReelStatus {
  const status = isRecord(payload) && isRecord(payload.status) ? payload.status : {};
  const uploading = phase(status, "uploading_phase");
  const processing = phase(status, "processing_phase");
  const publishing = phase(status, "publishing_phase");
  const errorOf = (item: Record<string, unknown> | null) =>
    item && isRecord(item.error) && typeof item.error.message === "string" ? item.error.message : null;
  const str = (value: unknown) => (typeof value === "string" ? value.toLowerCase() : null);
  return {
    videoStatus: str(status.video_status),
    uploadingStatus: str(uploading?.status),
    processingStatus: str(processing?.status),
    publishingStatus: str(publishing?.status),
    publishStatus: str(publishing?.publish_status),
    errorMessage: errorOf(processing) ?? errorOf(uploading) ?? errorOf(publishing),
  };
}

export async function getReelStatus(videoId: string, pageToken: string): Promise<ReelStatus> {
  const url = graphUrl(encodeURIComponent(videoId));
  url.searchParams.set("fields", "status");
  url.searchParams.set("access_token", pageToken);
  const body = await request({ method: "GET", url, errorMessage: "Não foi possível consultar o Reel no Facebook." });
  return parseReelStatus(body);
}

export interface ReelCopyrightInfo {
  checkComplete: boolean;
  matchesFound: boolean;
  blocked: boolean;
}

/** Verificação de direitos autorais do Reel (requer pages_read_engagement). Melhor esforço. */
export async function getReelCopyrightInfo(videoId: string, pageToken: string): Promise<ReelCopyrightInfo | null> {
  try {
    const url = graphUrl(encodeURIComponent(videoId));
    url.searchParams.set("fields", "copyright_check_information");
    url.searchParams.set("access_token", pageToken);
    const body = await request({ method: "GET", url, errorMessage: "copyright" });
    const info = isRecord(body.copyright_check_information) ? body.copyright_check_information : null;
    if (!info) return null;
    const status = isRecord(info.status) ? info.status : {};
    const matches = Array.isArray(info.copyright_matches) ? info.copyright_matches : [];
    const blocked = matches.some((match) => {
      const policy = isRecord(match) && isRecord(match.owner_copyright_policy) ? match.owner_copyright_policy : null;
      const actions = policy && Array.isArray(policy.actions) ? policy.actions : [];
      return actions.some((action) => isRecord(action) && typeof action.action === "string" && action.action.toUpperCase() === "BLOCK");
    });
    return {
      checkComplete: typeof status.status === "string" && status.status.toLowerCase() === "complete",
      matchesFound: status.matches_found === true || matches.length > 0,
      blocked,
    };
  } catch {
    return null;
  }
}
