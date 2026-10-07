import "server-only";
import { getDb } from "@/lib/db/client";
import {
  isCarouselStatus,
  isHookStyle,
  isVisualKind,
  type CarouselProjectStatus,
  type CarouselSourceKind,
  type HookStyle,
  type VisualKind,
} from "../domain";

type Row = Record<string, unknown>;

function toDate(value: unknown): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(String(value));
}
const str = (value: unknown): string | null => (typeof value === "string" && value.length > 0 ? value : null);

// ---------------------------------------------------------------------------
// Perfil de marca
// ---------------------------------------------------------------------------
export interface CarouselBrandProfile {
  userId: string;
  brandName: string | null;
  handle: string | null;
  niche: string | null;
  audience: string | null;
  objective: string | null;
  tone: string | null;
  accentColor: string | null;
  secondaryColor: string | null;
  fontId: string | null;
  defaultTemplateId: string | null;
  logoUrl: string | null;
}

function toBrand(row: Row): CarouselBrandProfile {
  return {
    userId: row.user_id as string,
    brandName: str(row.brand_name),
    handle: str(row.handle),
    niche: str(row.niche),
    audience: str(row.audience),
    objective: str(row.objective),
    tone: str(row.tone),
    accentColor: str(row.accent_color),
    secondaryColor: str(row.secondary_color),
    fontId: str(row.font_id),
    defaultTemplateId: str(row.default_template_id),
    logoUrl: str(row.logo_url),
  };
}

export async function getCarouselBrand(userId: string): Promise<CarouselBrandProfile | null> {
  const rows = await getDb()`select * from carousel_brand_profiles where user_id = ${userId}`;
  return rows[0] ? toBrand(rows[0] as Row) : null;
}

export async function saveCarouselBrand(userId: string, brand: Omit<CarouselBrandProfile, "userId">): Promise<CarouselBrandProfile> {
  const rows = await getDb()`
    insert into carousel_brand_profiles
      (user_id, brand_name, handle, niche, audience, objective, tone, accent_color, secondary_color, font_id, default_template_id, logo_url)
    values
      (${userId}, ${brand.brandName}, ${brand.handle}, ${brand.niche}, ${brand.audience}, ${brand.objective}, ${brand.tone},
       ${brand.accentColor}, ${brand.secondaryColor}, ${brand.fontId}, ${brand.defaultTemplateId}, ${brand.logoUrl})
    on conflict (user_id) do update set
      brand_name = excluded.brand_name, handle = excluded.handle, niche = excluded.niche, audience = excluded.audience,
      objective = excluded.objective, tone = excluded.tone, accent_color = excluded.accent_color,
      secondary_color = excluded.secondary_color, font_id = excluded.font_id,
      default_template_id = excluded.default_template_id, logo_url = excluded.logo_url, updated_at = now()
    returning *
  `;
  return toBrand(rows[0] as Row);
}

// ---------------------------------------------------------------------------
// Projetos
// ---------------------------------------------------------------------------
export interface CarouselProjectRecord {
  id: string;
  userId: string;
  instagramAccountId: string | null;
  topicId: string | null;
  title: string;
  topic: string;
  sourceKind: CarouselSourceKind;
  sourceRef: string | null;
  niche: string | null;
  status: CarouselProjectStatus;
  slideCount: number;
  templateId: string | null;
  chosenHookId: string | null;
  caption: string;
  hashtags: string[];
  includeEndMedia: boolean;
  instagramPostId: string | null;
  error: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function toProject(row: Row): CarouselProjectRecord {
  const hashtags = Array.isArray(row.hashtags) ? (row.hashtags as unknown[]).filter((tag): tag is string => typeof tag === "string") : [];
  return {
    id: row.id as string,
    userId: row.user_id as string,
    instagramAccountId: str(row.instagram_account_id),
    topicId: str(row.topic_id),
    title: (row.title as string) ?? "",
    topic: row.topic as string,
    sourceKind: row.source_kind as CarouselSourceKind,
    sourceRef: str(row.source_ref),
    niche: str(row.niche),
    status: isCarouselStatus(row.status) ? row.status : "DRAFT",
    slideCount: Number(row.slide_count),
    templateId: str(row.template_id),
    chosenHookId: str(row.chosen_hook_id),
    caption: (row.caption as string) ?? "",
    hashtags,
    includeEndMedia: row.include_end_media !== false,
    instagramPostId: str(row.instagram_post_id),
    error: str(row.error),
    completedAt: toDate(row.completed_at),
    createdAt: toDate(row.created_at) ?? new Date(),
    updatedAt: toDate(row.updated_at) ?? new Date(),
  };
}

export interface InsertProjectInput {
  userId: string;
  instagramAccountId: string | null;
  topicId: string | null;
  title: string;
  topic: string;
  sourceKind: CarouselSourceKind;
  sourceRef: string | null;
  niche: string | null;
  slideCount: number;
  templateId: string | null;
  includeEndMedia: boolean;
  brandSnapshot: Record<string, unknown>;
}

export async function insertProject(input: InsertProjectInput): Promise<CarouselProjectRecord> {
  const rows = await getDb()`
    insert into carousel_projects
      (user_id, instagram_account_id, topic_id, title, topic, source_kind, source_ref, niche, slide_count, template_id, include_end_media, brand_snapshot)
    values
      (${input.userId}, ${input.instagramAccountId}, ${input.topicId}, ${input.title}, ${input.topic}, ${input.sourceKind}, ${input.sourceRef},
       ${input.niche}, ${input.slideCount}, ${input.templateId}, ${input.includeEndMedia}, ${JSON.stringify(input.brandSnapshot)}::jsonb)
    returning *
  `;
  return toProject(rows[0] as Row);
}

export async function getProject(userId: string, projectId: string): Promise<CarouselProjectRecord | null> {
  const rows = await getDb()`select * from carousel_projects where id = ${projectId} and user_id = ${userId}`;
  return rows[0] ? toProject(rows[0] as Row) : null;
}

export async function listProjects(userId: string, status?: CarouselProjectStatus): Promise<CarouselProjectRecord[]> {
  const db = getDb();
  const rows = status
    ? await db`select * from carousel_projects where user_id = ${userId} and status = ${status} order by updated_at desc limit 200`
    : await db`select * from carousel_projects where user_id = ${userId} order by updated_at desc limit 200`;
  return rows.map((row) => toProject(row as Row));
}

export async function updateProjectFields(
  userId: string,
  projectId: string,
  patch: { title?: string; caption?: string; hashtags?: string[]; templateId?: string | null; includeEndMedia?: boolean; slideCount?: number; instagramAccountId?: string | null },
): Promise<CarouselProjectRecord | null> {
  const rows = await getDb()`
    update carousel_projects set
      title = coalesce(${patch.title ?? null}, title),
      caption = coalesce(${patch.caption ?? null}, caption),
      hashtags = coalesce(${patch.hashtags ? JSON.stringify(patch.hashtags) : null}::jsonb, hashtags),
      template_id = case when ${patch.templateId !== undefined} then ${patch.templateId ?? null} else template_id end,
      include_end_media = coalesce(${patch.includeEndMedia ?? null}, include_end_media),
      slide_count = coalesce(${patch.slideCount ?? null}, slide_count),
      instagram_account_id = case when ${patch.instagramAccountId !== undefined} then ${patch.instagramAccountId ?? null}::uuid else instagram_account_id end,
      updated_at = now()
    where id = ${projectId} and user_id = ${userId}
    returning *
  `;
  return rows[0] ? toProject(rows[0] as Row) : null;
}

export async function setProjectStatus(
  userId: string,
  projectId: string,
  status: CarouselProjectStatus,
  extra: { error?: string | null; instagramPostId?: string | null } = {},
): Promise<CarouselProjectRecord | null> {
  const rows = await getDb()`
    update carousel_projects set
      status = ${status},
      error = ${extra.error ?? null},
      instagram_post_id = coalesce(${extra.instagramPostId ?? null}::uuid, instagram_post_id),
      updated_at = now()
    where id = ${projectId} and user_id = ${userId}
    returning *
  `;
  return rows[0] ? toProject(rows[0] as Row) : null;
}

/** Marca o projeto como concluído UMA vez (idempotente: só atualiza se ainda não concluído). */
export async function markProjectCompleted(userId: string, projectId: string): Promise<boolean> {
  const rows = await getDb()`
    update carousel_projects set completed_at = now(), status = 'READY', error = null, updated_at = now()
    where id = ${projectId} and user_id = ${userId} and completed_at is null
    returning id
  `;
  return rows.length > 0;
}

export async function deleteProject(userId: string, projectId: string): Promise<boolean> {
  const rows = await getDb()`delete from carousel_projects where id = ${projectId} and user_id = ${userId} returning id`;
  return rows.length > 0;
}

/** Perfis (contas Instagram) distintos em que o usuário já tem projetos — base do limite por plano. */
export async function listProfilesInUse(userId: string): Promise<string[]> {
  const rows = await getDb()`
    select distinct instagram_account_id from carousel_projects where user_id = ${userId} and instagram_account_id is not null
  `;
  return rows.map((row) => (row as Row).instagram_account_id as string);
}

export async function userOwnsInstagramAccount(userId: string, accountId: string): Promise<boolean> {
  const rows = await getDb()`select 1 from instagram_accounts where id = ${accountId} and user_id = ${userId}`;
  return rows.length > 0;
}

export async function getUserEmail(userId: string): Promise<string | null> {
  const rows = await getDb()`select email from users where id = ${userId}`;
  return rows[0] ? ((rows[0] as Row).email as string | null) ?? null : null;
}

// ---------------------------------------------------------------------------
// Slides
// ---------------------------------------------------------------------------
export interface CarouselSlideRecord {
  id: string;
  projectId: string;
  position: number;
  role: string;
  headline: string;
  body: string;
  cta: string;
  visualKind: VisualKind;
  imageQuery: string | null;
  imageMediaId: string | null;
  renderedMediaId: string | null;
  templateId: string | null;
  style: Record<string, unknown>;
}

function toSlide(row: Row): CarouselSlideRecord {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    position: Number(row.position),
    role: row.role as string,
    headline: (row.headline as string) ?? "",
    body: (row.body as string) ?? "",
    cta: (row.cta as string) ?? "",
    visualKind: isVisualKind(row.visual_kind) ? row.visual_kind : "GRAPHIC",
    imageQuery: str(row.image_query),
    imageMediaId: str(row.image_media_id),
    renderedMediaId: str(row.rendered_media_id),
    templateId: str(row.template_id),
    style: typeof row.style === "object" && row.style !== null ? (row.style as Record<string, unknown>) : {},
  };
}

export async function listSlides(projectId: string): Promise<CarouselSlideRecord[]> {
  const rows = await getDb()`select * from carousel_slides where project_id = ${projectId} order by position`;
  return rows.map((row) => toSlide(row as Row));
}

export interface UpsertSlideInput {
  position: number;
  role: string;
  headline: string;
  body: string;
  cta: string;
  visualKind: VisualKind;
  imageQuery: string | null;
  templateId?: string | null;
  style?: Record<string, unknown>;
}

/** Grava/atualiza o slide da posição (um comando atômico por slide). Não toca nas imagens já associadas. */
export async function upsertSlide(projectId: string, slide: UpsertSlideInput): Promise<CarouselSlideRecord> {
  const rows = await getDb()`
    insert into carousel_slides (project_id, position, role, headline, body, cta, visual_kind, image_query, template_id, style)
    values (${projectId}, ${slide.position}, ${slide.role}, ${slide.headline}, ${slide.body}, ${slide.cta}, ${slide.visualKind},
            ${slide.imageQuery}, ${slide.templateId ?? null}, ${JSON.stringify(slide.style ?? {})}::jsonb)
    on conflict (project_id, position) do update set
      role = excluded.role, headline = excluded.headline, body = excluded.body, cta = excluded.cta,
      visual_kind = excluded.visual_kind, image_query = excluded.image_query,
      template_id = excluded.template_id, style = excluded.style, updated_at = now()
    returning *
  `;
  return toSlide(rows[0] as Row);
}

/** Remove slides além de `count` (ao diminuir a quantidade). */
export async function deleteSlidesAfter(projectId: string, count: number): Promise<void> {
  await getDb()`delete from carousel_slides where project_id = ${projectId} and position > ${count}`;
}

export async function setSlideMedia(projectId: string, position: number, media: { imageMediaId?: string | null; renderedMediaId?: string | null }): Promise<void> {
  await getDb()`
    update carousel_slides set
      image_media_id = case when ${media.imageMediaId !== undefined} then ${media.imageMediaId ?? null}::uuid else image_media_id end,
      rendered_media_id = case when ${media.renderedMediaId !== undefined} then ${media.renderedMediaId ?? null}::uuid else rendered_media_id end,
      updated_at = now()
    where project_id = ${projectId} and position = ${position}
  `;
}

// ---------------------------------------------------------------------------
// Ganchos
// ---------------------------------------------------------------------------
export interface CarouselHookRecord {
  id: string;
  projectId: string;
  style: HookStyle;
  headline: string;
  subtitle: string | null;
  objective: string | null;
  chosen: boolean;
}

function toHook(row: Row): CarouselHookRecord {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    style: isHookStyle(row.style) ? row.style : "CUSTOM",
    headline: row.headline as string,
    subtitle: str(row.subtitle),
    objective: str(row.objective),
    chosen: row.chosen === true,
  };
}

export async function insertHook(projectId: string, hook: { style: HookStyle; headline: string; subtitle?: string | null; objective?: string | null }): Promise<CarouselHookRecord> {
  const rows = await getDb()`
    insert into carousel_hooks (project_id, style, headline, subtitle, objective)
    values (${projectId}, ${hook.style}, ${hook.headline}, ${hook.subtitle ?? null}, ${hook.objective ?? null})
    returning *
  `;
  return toHook(rows[0] as Row);
}

export async function listHooks(projectId: string): Promise<CarouselHookRecord[]> {
  const rows = await getDb()`select * from carousel_hooks where project_id = ${projectId} order by created_at, id`;
  return rows.map((row) => toHook(row as Row));
}

/** Escolhe UM gancho do projeto (desmarca os outros) e guarda o id no projeto. */
export async function chooseHook(userId: string, projectId: string, hookId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    with proj as (select id from carousel_projects where id = ${projectId} and user_id = ${userId}),
    hk as (select id from carousel_hooks where id = ${hookId} and project_id in (select id from proj)),
    clear as (update carousel_hooks set chosen = false where project_id in (select id from proj) and exists (select 1 from hk) returning 1),
    pick as (update carousel_hooks set chosen = true where id in (select id from hk) returning id)
    update carousel_projects set chosen_hook_id = (select id from pick), updated_at = now()
    where id in (select id from proj) and exists (select 1 from pick)
    returning id
  `;
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Pautas, fontes e análises
// ---------------------------------------------------------------------------
export interface CarouselTopicRecord {
  id: string;
  userId: string;
  weekKey: string;
  niche: string;
  title: string;
  summary: string;
  category: string | null;
  relevanceReason: string | null;
  narrativeAngle: string | null;
  informativeAngle: string | null;
  engagementPotential: "LOW" | "MEDIUM" | "HIGH";
  status: "NEW" | "USED" | "DISMISSED";
  suggestedAt: Date;
}

function toTopic(row: Row): CarouselTopicRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    weekKey: row.week_key as string,
    niche: row.niche as string,
    title: row.title as string,
    summary: (row.summary as string) ?? "",
    category: str(row.category),
    relevanceReason: str(row.relevance_reason),
    narrativeAngle: str(row.narrative_angle),
    informativeAngle: str(row.informative_angle),
    engagementPotential: row.engagement_potential === "HIGH" ? "HIGH" : row.engagement_potential === "LOW" ? "LOW" : "MEDIUM",
    status: row.status === "USED" ? "USED" : row.status === "DISMISSED" ? "DISMISSED" : "NEW",
    suggestedAt: toDate(row.suggested_at) ?? new Date(),
  };
}

export interface InsertTopicInput {
  userId: string;
  weekKey: string;
  niche: string;
  title: string;
  summary: string;
  category?: string | null;
  relevanceReason?: string | null;
  narrativeAngle?: string | null;
  informativeAngle?: string | null;
  engagementPotential?: "LOW" | "MEDIUM" | "HIGH";
}

export async function insertTopic(input: InsertTopicInput): Promise<CarouselTopicRecord> {
  const rows = await getDb()`
    insert into carousel_topics
      (user_id, week_key, niche, title, summary, category, relevance_reason, narrative_angle, informative_angle, engagement_potential)
    values
      (${input.userId}, ${input.weekKey}, ${input.niche}, ${input.title}, ${input.summary}, ${input.category ?? null},
       ${input.relevanceReason ?? null}, ${input.narrativeAngle ?? null}, ${input.informativeAngle ?? null}, ${input.engagementPotential ?? "MEDIUM"})
    returning *
  `;
  return toTopic(rows[0] as Row);
}

export async function listTopics(userId: string, weekKey?: string): Promise<CarouselTopicRecord[]> {
  const db = getDb();
  const rows = weekKey
    ? await db`select * from carousel_topics where user_id = ${userId} and week_key = ${weekKey} and status <> 'DISMISSED' order by created_at, id`
    : await db`select * from carousel_topics where user_id = ${userId} and status <> 'DISMISSED' order by suggested_at desc limit 100`;
  return rows.map((row) => toTopic(row as Row));
}

export async function countTopicsForWeek(userId: string, weekKey: string): Promise<number> {
  const rows = await getDb()`select count(*) as total from carousel_topics where user_id = ${userId} and week_key = ${weekKey}`;
  return Number((rows[0] as Row)?.total ?? 0);
}

export async function setTopicStatus(userId: string, topicId: string, status: "NEW" | "USED" | "DISMISSED"): Promise<boolean> {
  const rows = await getDb()`update carousel_topics set status = ${status} where id = ${topicId} and user_id = ${userId} returning id`;
  return rows.length > 0;
}

export interface CarouselSourceRecord {
  id: string;
  kind: "WEB" | "URL" | "PROFILE";
  title: string;
  url: string | null;
  publisher: string | null;
  publishedAt: Date | null;
}

export async function insertSource(
  scope: { projectId?: string; topicId?: string },
  source: { kind: "WEB" | "URL" | "PROFILE"; title: string; url?: string | null; publisher?: string | null; publishedAt?: Date | null },
): Promise<void> {
  await getDb()`
    insert into carousel_sources (project_id, topic_id, kind, title, url, publisher, published_at)
    values (${scope.projectId ?? null}, ${scope.topicId ?? null}, ${source.kind}, ${source.title}, ${source.url ?? null},
            ${source.publisher ?? null}, ${source.publishedAt ? source.publishedAt.toISOString() : null})
  `;
}

export async function listSources(projectId: string): Promise<CarouselSourceRecord[]> {
  const rows = await getDb()`select * from carousel_sources where project_id = ${projectId} order by retrieved_at, id`;
  return rows.map((row) => {
    const r = row as Row;
    return {
      id: r.id as string,
      kind: r.kind as CarouselSourceRecord["kind"],
      title: r.title as string,
      url: str(r.url),
      publisher: str(r.publisher),
      publishedAt: toDate(r.published_at),
    };
  });
}

export async function insertProfileAnalysis(userId: string, target: string, patterns: Record<string, unknown>): Promise<string> {
  const rows = await getDb()`
    insert into carousel_profile_analyses (user_id, target, patterns)
    values (${userId}, ${target}, ${JSON.stringify(patterns)}::jsonb)
    returning id
  `;
  return (rows[0] as Row).id as string;
}
