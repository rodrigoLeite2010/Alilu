import "server-only";

/**
 * Cliente cru da API da Meta usada pelo Instagram API with Instagram Login
 * (o produto "novo", baseado em login direto do Instagram — NÃO o antigo
 * Instagram Basic Display nem o fluxo via Facebook Login). Só HTTP + parsing
 * defensivo aqui; nenhuma regra de negócio (isso fica em
 * instagram-oauth-service.ts) e nenhum acesso a banco.
 *
 * Endpoints e formatos abaixo foram verificados na documentação oficial da
 * Meta (developers.facebook.com) antes de escrever este arquivo — nunca
 * inventados. Onde a documentação foi ambígua (ver comentário em
 * fetchInstagramProfile), o código trata os dois formatos possíveis em vez
 * de assumir um só.
 */

export const GRAPH_API_VERSION = "v25.0";

export const AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
export const CODE_EXCHANGE_URL = "https://api.instagram.com/oauth/access_token";
export const LONG_LIVED_EXCHANGE_URL = "https://graph.instagram.com/access_token";
export const REFRESH_URL = "https://graph.instagram.com/refresh_access_token";

/**
 * Escopos exigidos para conectar a conta e futuramente publicar. Confirmado
 * na documentação do "Instagram API with Instagram Login": distintos dos
 * escopos do antigo Instagram Basic Display.
 */
export const INSTAGRAM_OAUTH_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
];

export class InstagramGraphApiError extends Error {
  readonly details: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "InstagramGraphApiError";
    this.details = details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * A resposta da troca de código e (segundo a documentação) a de outros
 * endpoints do produto vêm envelopadas como `{ data: [ { ... } ] }`.
 * Extrai o primeiro elemento de `data`, ou `null` se o formato não bater.
 */
function extractFirstDataEntry(payload: unknown): Record<string, unknown> | null {
  if (isRecord(payload) && Array.isArray(payload.data) && payload.data.length > 0) {
    const first = payload.data[0];
    if (isRecord(first)) return first;
  }
  return null;
}

/**
 * `permissions` foi observado na documentação tanto como string separada
 * por vírgulas quanto (potencialmente) como array — tratamos os dois casos
 * em vez de assumir um só formato.
 */
function parsePermissions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
}

export interface BuildAuthorizeUrlInput {
  appId: string;
  redirectUri: string;
  state: string;
}

/** Monta a URL para onde o usuário é redirecionado para autorizar o app no Instagram. */
export function buildInstagramAuthorizeUrl(input: BuildAuthorizeUrlInput): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", input.appId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", INSTAGRAM_OAUTH_SCOPES.join(","));
  url.searchParams.set("state", input.state);
  return url.toString();
}

export interface ExchangeCodeInput {
  appId: string;
  appSecret: string;
  redirectUri: string;
  code: string;
}

export interface ShortLivedTokenResult {
  accessToken: string;
  igUserId: string;
  permissions: string[];
}

/**
 * Troca o código de autorização (válido por 1 hora, uso único) por um
 * token de curta duração. A documentação descreve a resposta como
 * `{ data: [ { access_token, user_id, permissions } ] }`, mas na prática
 * (confirmado em produção, 22/09/2026) a Meta pode devolver a resposta
 * "achatada" (`{ access_token, user_id, permissions }` direto, sem o
 * envelope `data`) — mesma ambiguidade de formato já vista em
 * fetchInstagramProfile. Tratamos os dois formatos defensivamente.
 */
export async function exchangeCodeForShortLivedToken(
  input: ExchangeCodeInput,
): Promise<ShortLivedTokenResult> {
  const body = new URLSearchParams();
  body.set("client_id", input.appId);
  body.set("client_secret", input.appSecret);
  body.set("grant_type", "authorization_code");
  body.set("redirect_uri", input.redirectUri);
  body.set("code", input.code);

  const response = await fetch(CODE_EXCHANGE_URL, { method: "POST", body });
  const text = await response.text();
  const payload = safeParseJson(text);

  if (!response.ok) {
    throw new InstagramGraphApiError(
      "Falha ao trocar o código de autorização por um token de acesso.",
      payload ?? text,
    );
  }

  const entry = extractFirstDataEntry(payload) ?? (isRecord(payload) ? payload : null);
  const accessToken = entry?.access_token;
  const userId = entry?.user_id;
  if (typeof accessToken !== "string" || (typeof userId !== "string" && typeof userId !== "number")) {
    throw new InstagramGraphApiError(
      "Resposta inesperada da Meta ao trocar o código de autorização.",
      payload,
    );
  }

  return {
    accessToken,
    igUserId: String(userId),
    permissions: parsePermissions(entry?.permissions),
  };
}

interface LongLivedTokenResult {
  accessToken: string;
  expiresInSeconds: number;
}

async function parseLongLivedTokenResponse(
  response: Response,
  errorMessage: string,
): Promise<LongLivedTokenResult> {
  const text = await response.text();
  const payload = safeParseJson(text);

  if (!response.ok) {
    throw new InstagramGraphApiError(errorMessage, payload ?? text);
  }
  if (!isRecord(payload) || typeof payload.access_token !== "string" || typeof payload.expires_in !== "number") {
    throw new InstagramGraphApiError(`${errorMessage} (formato de resposta inesperado)`, payload);
  }

  return { accessToken: payload.access_token, expiresInSeconds: payload.expires_in };
}

export interface ExchangeLongLivedInput {
  appSecret: string;
  shortLivedAccessToken: string;
}

/** Troca o token de curta duração por um de longa duração (60 dias), confirmado na documentação. */
export async function exchangeForLongLivedToken(
  input: ExchangeLongLivedInput,
): Promise<LongLivedTokenResult> {
  const url = new URL(LONG_LIVED_EXCHANGE_URL);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", input.appSecret);
  url.searchParams.set("access_token", input.shortLivedAccessToken);

  const response = await fetch(url.toString());
  return parseLongLivedTokenResponse(response, "Falha ao obter o token de longa duração.");
}

/** Renova um token de longa duração ainda válido (mesmo formato de resposta da troca inicial). */
export async function refreshLongLivedToken(accessToken: string): Promise<LongLivedTokenResult> {
  const url = new URL(REFRESH_URL);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url.toString());
  return parseLongLivedTokenResponse(response, "Falha ao renovar o token de longa duração.");
}

export interface InstagramProfile {
  igUserId: string;
  username: string | null;
}

/**
 * Busca o perfil (user_id, username) associado ao token. A documentação da
 * Meta não deixou claro, em duas consultas independentes, se a resposta de
 * `/me` vem "achatada" (`{ user_id, username }`) ou envolvida em
 * `{ data: [...] }` como os demais endpoints — em vez de assumir um só
 * formato, tratamos os dois defensivamente.
 */
export async function fetchInstagramProfile(accessToken: string): Promise<InstagramProfile> {
  const url = new URL(`https://graph.instagram.com/${GRAPH_API_VERSION}/me`);
  url.searchParams.set("fields", "user_id,username");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url.toString());
  const text = await response.text();
  const payload = safeParseJson(text);

  if (!response.ok) {
    throw new InstagramGraphApiError("Falha ao buscar o perfil do Instagram.", payload ?? text);
  }

  const entry = extractFirstDataEntry(payload) ?? (isRecord(payload) ? payload : null);
  const userId = entry?.user_id;
  if (!entry || (typeof userId !== "string" && typeof userId !== "number")) {
    throw new InstagramGraphApiError(
      "Resposta inesperada da Meta ao buscar o perfil do Instagram.",
      payload,
    );
  }

  return {
    igUserId: String(userId),
    username: typeof entry.username === "string" ? entry.username : null,
  };
}

export type MediaContainerStatus = "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";

const MEDIA_CONTAINER_STATUSES: readonly MediaContainerStatus[] = [
  "EXPIRED",
  "ERROR",
  "FINISHED",
  "IN_PROGRESS",
  "PUBLISHED",
];

export interface CreateImageMediaContainerInput {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
}

/**
 * Cria o container de mídia para um post de imagem única — primeiro passo
 * da Content Publishing API do "Instagram API with Instagram Login".
 * Endpoint, host (graph.instagram.com, igual ao já usado em
 * fetchInstagramProfile) e parâmetros confirmados na documentação oficial
 * (developers.facebook.com/docs/instagram-platform/content-publishing,
 * consultada em 22/09/2026) antes de implementar: `image_url` precisa ser
 * uma URL pública — por isso o módulo de mídia sempre grava no Vercel Blob
 * antes de chegar aqui, nunca envia base64 direto. Retorna só o id do
 * container: ele ainda PRECISA ser consultado (status_code) até
 * `FINISHED` antes de publicar — ver getMediaContainerStatus.
 */
export async function createImageMediaContainer(
  input: CreateImageMediaContainerInput,
): Promise<string> {
  const url = new URL(`https://graph.instagram.com/${GRAPH_API_VERSION}/${input.igUserId}/media`);
  const body = new URLSearchParams();
  body.set("image_url", input.imageUrl);
  if (input.caption) body.set("caption", input.caption);
  body.set("access_token", input.accessToken);

  const response = await fetch(url.toString(), { method: "POST", body });
  const text = await response.text();
  const payload = safeParseJson(text);

  if (!response.ok) {
    throw new InstagramGraphApiError(
      "Falha ao criar o container de mídia para publicação.",
      payload ?? text,
    );
  }
  if (!isRecord(payload) || typeof payload.id !== "string") {
    throw new InstagramGraphApiError(
      "Resposta inesperada da Meta ao criar o container de mídia.",
      payload,
    );
  }
  return payload.id;
}

export interface GetMediaContainerStatusInput {
  containerId: string;
  accessToken: string;
}

/**
 * Consulta o status de processamento de um container de mídia
 * (`status_code`: EXPIRED | ERROR | FINISHED | IN_PROGRESS | PUBLISHED,
 * confirmados na mesma documentação). A Meta recomenda consultar no máximo
 * uma vez por minuto, por até 5 minutos — este cliente faz só UMA consulta
 * por chamada; toda a orquestração do polling (intervalo, quantas
 * tentativas, o que fazer se não terminar a tempo dentro de uma Vercel
 * Function) fica em instagram-publish-service.ts, nunca aqui.
 */
export async function getMediaContainerStatus(
  input: GetMediaContainerStatusInput,
): Promise<MediaContainerStatus> {
  const url = new URL(`https://graph.instagram.com/${GRAPH_API_VERSION}/${input.containerId}`);
  url.searchParams.set("fields", "status_code");
  url.searchParams.set("access_token", input.accessToken);

  const response = await fetch(url.toString());
  const text = await response.text();
  const payload = safeParseJson(text);

  if (!response.ok) {
    throw new InstagramGraphApiError(
      "Falha ao consultar o status do container de mídia.",
      payload ?? text,
    );
  }
  const status = isRecord(payload) ? payload.status_code : null;
  if (typeof status !== "string" || !MEDIA_CONTAINER_STATUSES.includes(status as MediaContainerStatus)) {
    throw new InstagramGraphApiError(
      "Resposta inesperada da Meta ao consultar o status do container de mídia.",
      payload,
    );
  }
  return status as MediaContainerStatus;
}

export interface PublishMediaContainerInput {
  igUserId: string;
  accessToken: string;
  containerId: string;
}

/**
 * Publica de fato um container de mídia — último passo, só deve ser
 * chamado depois que getMediaContainerStatus confirmar `FINISHED`
 * (publicar um container ainda IN_PROGRESS falha na Meta; a garantia disso
 * é responsabilidade de quem chama, não deste cliente cru).
 */
export async function publishMediaContainer(
  input: PublishMediaContainerInput,
): Promise<string> {
  const url = new URL(`https://graph.instagram.com/${GRAPH_API_VERSION}/${input.igUserId}/media_publish`);
  const body = new URLSearchParams();
  body.set("creation_id", input.containerId);
  body.set("access_token", input.accessToken);

  const response = await fetch(url.toString(), { method: "POST", body });
  const text = await response.text();
  const payload = safeParseJson(text);

  if (!response.ok) {
    throw new InstagramGraphApiError(
      "Falha ao publicar o container de mídia.",
      payload ?? text,
    );
  }
  if (!isRecord(payload) || typeof payload.id !== "string") {
    throw new InstagramGraphApiError(
      "Resposta inesperada da Meta ao publicar o container de mídia.",
      payload,
    );
  }
  return payload.id;
}

export interface CreateCarouselItemContainerInput {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
}

/**
 * Cria o container de UM item de carrossel — mesmo endpoint de
 * createImageMediaContainer, mas com `is_carousel_item=true` e SEM
 * `caption` (a legenda só é aceita no container PAI do carrossel —
 * confirmado na documentação oficial da Meta,
 * developers.facebook.com/docs/instagram-platform/content-publishing e
 * .../instagram-graph-api/reference/ig-user/media, consultadas em
 * 22/09/2026, antes de escrever esta função). Assim como o container de
 * imagem única, processa de forma assíncrona — mas a documentação não
 * exige (nem recomenda) consultar o status de cada item antes de criar o
 * container pai; só o container pai (CAROUSEL) precisa chegar a FINISHED
 * antes do media_publish — ver createCarouselContainer.
 */
export async function createCarouselItemContainer(
  input: CreateCarouselItemContainerInput,
): Promise<string> {
  const url = new URL(`https://graph.instagram.com/${GRAPH_API_VERSION}/${input.igUserId}/media`);
  const body = new URLSearchParams();
  body.set("image_url", input.imageUrl);
  body.set("is_carousel_item", "true");
  body.set("access_token", input.accessToken);

  const response = await fetch(url.toString(), { method: "POST", body });
  const text = await response.text();
  const payload = safeParseJson(text);

  if (!response.ok) {
    throw new InstagramGraphApiError(
      "Falha ao criar o container de um item do carrossel.",
      payload ?? text,
    );
  }
  if (!isRecord(payload) || typeof payload.id !== "string") {
    throw new InstagramGraphApiError(
      "Resposta inesperada da Meta ao criar o container de um item do carrossel.",
      payload,
    );
  }
  return payload.id;
}

export interface CreateCarouselContainerInput {
  igUserId: string;
  accessToken: string;
  /** IDs dos containers de item já criados (createCarouselItemContainer), na ordem de exibição — de 2 a 10 (limite da própria Meta para carrossel). */
  childrenContainerIds: string[];
  caption: string;
}

/**
 * Cria o container PAI do carrossel — segundo passo da Content Publishing
 * API para carrossel (confirmado na documentação oficial): `media_type`
 * CAROUSEL + `children` (lista dos IDs dos containers de item, separada
 * por vírgula, na ordem desejada) + a legenda (que só existe aqui, nunca
 * nos itens — ver createCarouselItemContainer). Assim como o container de
 * imagem única, PRECISA ser consultado (status_code) até FINISHED antes
 * de publicar — ver getMediaContainerStatus.
 */
export async function createCarouselContainer(
  input: CreateCarouselContainerInput,
): Promise<string> {
  const url = new URL(`https://graph.instagram.com/${GRAPH_API_VERSION}/${input.igUserId}/media`);
  const body = new URLSearchParams();
  body.set("media_type", "CAROUSEL");
  body.set("children", input.childrenContainerIds.join(","));
  if (input.caption) body.set("caption", input.caption);
  body.set("access_token", input.accessToken);

  const response = await fetch(url.toString(), { method: "POST", body });
  const text = await response.text();
  const payload = safeParseJson(text);

  if (!response.ok) {
    throw new InstagramGraphApiError(
      "Falha ao criar o container do carrossel.",
      payload ?? text,
    );
  }
  if (!isRecord(payload) || typeof payload.id !== "string") {
    throw new InstagramGraphApiError(
      "Resposta inesperada da Meta ao criar o container do carrossel.",
      payload,
    );
  }
  return payload.id;
}

export interface CreateReelMediaContainerInput {
  igUserId: string;
  accessToken: string;
  videoUrl: string;
  caption: string;
  shareToFeed?: boolean;
}

/**
 * Cria o container de um Reel usando o fluxo de Content Publishing da
 * Instagram API with Instagram Login. O vídeo precisa estar disponível por
 * URL HTTPS para a Meta buscar; por isso usamos Vercel Blob público para a
 * mídia, sem colocar credenciais na URL.
 */
export async function createReelMediaContainer(
  input: CreateReelMediaContainerInput,
): Promise<string> {
  const url = new URL(`https://graph.instagram.com/${GRAPH_API_VERSION}/${input.igUserId}/media`);
  const body = new URLSearchParams();
  body.set("media_type", "REELS");
  body.set("video_url", input.videoUrl);
  if (input.caption) body.set("caption", input.caption);
  if (input.shareToFeed !== undefined) body.set("share_to_feed", input.shareToFeed ? "true" : "false");
  body.set("access_token", input.accessToken);

  const response = await fetch(url.toString(), { method: "POST", body });
  const text = await response.text();
  const payload = safeParseJson(text);

  if (!response.ok) {
    throw new InstagramGraphApiError(
      "Falha ao criar o container do Reel.",
      payload ?? text,
    );
  }
  if (!isRecord(payload) || typeof payload.id !== "string") {
    throw new InstagramGraphApiError(
      "Resposta inesperada da Meta ao criar o container do Reel.",
      payload,
    );
  }
  return payload.id;
}
