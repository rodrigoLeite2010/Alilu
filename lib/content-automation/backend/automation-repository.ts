import "server-only";
import { getDb } from "@/lib/db/client";
import {
  DAYS_OF_WEEK,
  type AutomationContentMode,
  type AutomationContentType,
  type AutomationDayRecord,
  type AutomationRecord,
  type AutomationStatus,
  type AutomationWithDays,
  type DayOfWeek,
  type ImageMode,
  type VideoSelection,
} from "./automation-types";

/**
 * Acesso ao banco do Piloto Automático de Conteúdo (content_automations +
 * content_automation_days). Só gravação/consulta, sempre restrita ao dono
 * (`user_id = userId`) — a validação de posse de conta/mídia associadas
 * fica em automation-service.ts, igual ao padrão já usado em
 * instagram-post-repository.ts / instagram-post-service.ts.
 *
 * Cada automação nasce SEMPRE com as 7 linhas de dia (todas desabilitadas
 * por padrão) — a tela edita com UPDATE, nunca insert/delete de dia
 * individual, o que casa com a constraint única (automation_id,
 * day_of_week) e evita qualquer automação "incompleta" faltando um dia.
 *
 * Padrão de UPDATE parcial: igual a updatePostContent em
 * instagram-post-repository.ts — lê a linha atual, resolve em JS o que
 * "undefined = mantém" significa para cada campo, e grava um UPDATE só
 * com valores já resolvidos (nunca SQL dinâmico/CASE condicionado a
 * parâmetro).
 */

function mapAutomationRow(row: Record<string, unknown>): AutomationRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    instagramAccountId: row.instagram_account_id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? "",
    status: row.status as AutomationStatus,
    timezone: row.timezone as string,
    brandContext: (row.brand_context as string | null) ?? "",
    autoPublish: Boolean(row.auto_publish),
    requireApproval: Boolean(row.require_approval),
    generationLeadMinutes: Number(row.generation_lead_minutes),
    imageMode: row.image_mode as ImageMode,
    fixedImageMediaId: (row.fixed_image_media_id as string | null) ?? null,
    videoSelection: row.video_selection as VideoSelection,
    fixedVideoMediaId: (row.fixed_video_media_id as string | null) ?? null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    lastRunAt: row.last_run_at ? new Date(row.last_run_at as string) : null,
    nextRunAt: row.next_run_at ? new Date(row.next_run_at as string) : null,
  };
}

function mapDayRow(row: Record<string, unknown>): AutomationDayRecord {
  let styleConfig: Record<string, unknown> | null = null;
  const raw = row.style_config;
  if (raw && typeof raw === "object") {
    styleConfig = raw as Record<string, unknown>;
  } else if (typeof raw === "string" && raw.length > 0) {
    try {
      styleConfig = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      styleConfig = null;
    }
  }
  return {
    id: row.id as string,
    automationId: row.automation_id as string,
    dayOfWeek: row.day_of_week as DayOfWeek,
    enabled: Boolean(row.enabled),
    contentType: row.content_type as AutomationContentType,
    contentMode: (row.content_mode as AutomationContentMode | null) ?? "AI",
    prompt: (row.prompt as string | null) ?? "",
    manualCaption: (row.manual_caption as string | null) ?? null,
    visualText: (row.visual_text as string | null) ?? null,
    publishTime: row.publish_time as string,
    templateId: (row.template_id as string | null) ?? null,
    styleConfig,
    imageMediaId: (row.image_media_id as string | null) ?? null,
    videoMediaId: (row.video_media_id as string | null) ?? null,
  };
}

export interface CreateAutomationInput {
  userId: string;
  instagramAccountId: string;
  name: string;
  description: string;
  timezone: string;
  brandContext: string;
  autoPublish: boolean;
  requireApproval: boolean;
  generationLeadMinutes: number;
  imageMode: ImageMode;
  fixedImageMediaId: string | null;
  videoSelection: VideoSelection;
  fixedVideoMediaId: string | null;
}

/** Cria a automação PAUSADA (o usuário ativa explicitamente depois de revisar) e as 7 linhas de dia. */
export async function createAutomation(input: CreateAutomationInput): Promise<string> {
  const db = getDb();
  const rows = await db`
    insert into content_automations (
      user_id, instagram_account_id, name, description, status, timezone, brand_context,
      auto_publish, require_approval, generation_lead_minutes, image_mode, fixed_image_media_id,
      video_selection, fixed_video_media_id
    ) values (
      ${input.userId}, ${input.instagramAccountId}, ${input.name}, ${input.description}, 'PAUSED',
      ${input.timezone}, ${input.brandContext}, ${input.autoPublish}, ${input.requireApproval},
      ${input.generationLeadMinutes}, ${input.imageMode}, ${input.fixedImageMediaId},
      ${input.videoSelection}, ${input.fixedVideoMediaId}
    )
    returning id
  `;
  const automationId = rows[0].id as string;

  for (const dayOfWeek of DAYS_OF_WEEK) {
    await db`
      insert into content_automation_days (automation_id, day_of_week)
      values (${automationId}, ${dayOfWeek})
    `;
  }

  return automationId;
}

async function fetchDays(automationId: string): Promise<AutomationDayRecord[]> {
  const db = getDb();
  const rows = await db`
    select * from content_automation_days
    where automation_id = ${automationId}
    order by array_position(array['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY']::text[], day_of_week)
  `;
  return rows.map(mapDayRow);
}

async function fetchAutomationRow(id: string, userId: string): Promise<Record<string, unknown> | null> {
  const db = getDb();
  const rows = await db`
    select * from content_automations where id = ${id} and user_id = ${userId}
  `;
  return rows[0] ?? null;
}

export async function getAutomationForUser(id: string, userId: string): Promise<AutomationWithDays | null> {
  const row = await fetchAutomationRow(id, userId);
  if (!row) return null;
  const days = await fetchDays(id);
  return { ...mapAutomationRow(row), days };
}

export interface AutomationListItem extends AutomationRecord {
  activeDaysCount: number;
}

/** Lista para "Minhas automações" — sem carregar os 7 dias de cada uma, só a contagem de dias ativos. */
export async function listAutomationsForUser(userId: string): Promise<AutomationListItem[]> {
  const db = getDb();
  const rows = await db`
    select a.*, coalesce(d.active_days, 0) as active_days_count
    from content_automations a
    left join (
      select automation_id, count(*) filter (where enabled) as active_days
      from content_automation_days
      group by automation_id
    ) d on d.automation_id = a.id
    where a.user_id = ${userId}
    order by a.created_at desc
  `;
  return rows.map((row) => ({ ...mapAutomationRow(row), activeDaysCount: Number(row.active_days_count) }));
}

export interface UpdateAutomationInput {
  name?: string;
  description?: string;
  timezone?: string;
  brandContext?: string;
  autoPublish?: boolean;
  requireApproval?: boolean;
  generationLeadMinutes?: number;
  imageMode?: ImageMode;
  fixedImageMediaId?: string | null;
  videoSelection?: VideoSelection;
  fixedVideoMediaId?: string | null;
  instagramAccountId?: string;
}

/** Atualiza os campos informados (undefined = mantém o valor atual). Retorna false se a automação não existir/não for do usuário. */
export async function updateAutomation(
  id: string,
  userId: string,
  patch: UpdateAutomationInput,
): Promise<boolean> {
  const current = await fetchAutomationRow(id, userId);
  if (!current) return false;

  const name = patch.name ?? (current.name as string);
  const description = patch.description ?? ((current.description as string | null) ?? "");
  const timezone = patch.timezone ?? (current.timezone as string);
  const brandContext = patch.brandContext ?? ((current.brand_context as string | null) ?? "");
  const autoPublish = patch.autoPublish ?? Boolean(current.auto_publish);
  const requireApproval = patch.requireApproval ?? Boolean(current.require_approval);
  const generationLeadMinutes = patch.generationLeadMinutes ?? Number(current.generation_lead_minutes);
  const imageMode = patch.imageMode ?? (current.image_mode as ImageMode);
  const fixedImageMediaId =
    patch.fixedImageMediaId === undefined ? ((current.fixed_image_media_id as string | null) ?? null) : patch.fixedImageMediaId;
  const videoSelection = patch.videoSelection ?? (current.video_selection as VideoSelection);
  const fixedVideoMediaId =
    patch.fixedVideoMediaId === undefined ? ((current.fixed_video_media_id as string | null) ?? null) : patch.fixedVideoMediaId;
  const instagramAccountId = patch.instagramAccountId ?? (current.instagram_account_id as string);

  const db = getDb();
  await db`
    update content_automations set
      name = ${name}, description = ${description}, timezone = ${timezone}, brand_context = ${brandContext},
      auto_publish = ${autoPublish}, require_approval = ${requireApproval},
      generation_lead_minutes = ${generationLeadMinutes}, image_mode = ${imageMode},
      fixed_image_media_id = ${fixedImageMediaId}, video_selection = ${videoSelection},
      fixed_video_media_id = ${fixedVideoMediaId}, instagram_account_id = ${instagramAccountId},
      updated_at = now()
    where id = ${id} and user_id = ${userId}
  `;
  return true;
}

export interface UpdateAutomationDayInput {
  enabled?: boolean;
  contentType?: AutomationContentType;
  contentMode?: AutomationContentMode;
  prompt?: string;
  manualCaption?: string | null;
  visualText?: string | null;
  publishTime?: string;
  templateId?: string | null;
  styleConfig?: Record<string, unknown> | null;
  imageMediaId?: string | null;
  videoMediaId?: string | null;
}

/** Atualiza um dia específico — restrito ao dono via join com content_automations. */
export async function updateAutomationDay(
  automationId: string,
  userId: string,
  dayOfWeek: DayOfWeek,
  patch: UpdateAutomationDayInput,
): Promise<boolean> {
  const owner = await fetchAutomationRow(automationId, userId);
  if (!owner) return false;

  const db = getDb();
  const currentRows = await db`
    select * from content_automation_days where automation_id = ${automationId} and day_of_week = ${dayOfWeek}
  `;
  const current = currentRows[0];
  if (!current) return false;

  const enabled = patch.enabled ?? Boolean(current.enabled);
  const contentType = patch.contentType ?? (current.content_type as AutomationContentType);
  const contentMode = patch.contentMode ?? ((current.content_mode as AutomationContentMode | null) ?? "AI");
  const prompt = patch.prompt ?? ((current.prompt as string | null) ?? "");
  const manualCaption = patch.manualCaption === undefined ? ((current.manual_caption as string | null) ?? null) : patch.manualCaption;
  const visualText = patch.visualText === undefined ? ((current.visual_text as string | null) ?? null) : patch.visualText;
  const publishTime = patch.publishTime ?? (current.publish_time as string);
  const templateId = patch.templateId === undefined ? ((current.template_id as string | null) ?? null) : patch.templateId;
  const styleConfig =
    patch.styleConfig === undefined
      ? (current.style_config as string | Record<string, unknown> | null)
      : patch.styleConfig === null
        ? null
        : JSON.stringify(patch.styleConfig);
  const imageMediaId = patch.imageMediaId === undefined ? ((current.image_media_id as string | null) ?? null) : patch.imageMediaId;
  const videoMediaId = patch.videoMediaId === undefined ? ((current.video_media_id as string | null) ?? null) : patch.videoMediaId;

  const styleConfigJson =
    styleConfig === null || styleConfig === undefined
      ? null
      : typeof styleConfig === "string"
        ? styleConfig
        : JSON.stringify(styleConfig);

  await db`
    update content_automation_days set
      enabled = ${enabled}, content_type = ${contentType}, content_mode = ${contentMode},
      prompt = ${prompt}, manual_caption = ${manualCaption}, visual_text = ${visualText}, publish_time = ${publishTime},
      template_id = ${templateId}, style_config = ${styleConfigJson}, image_media_id = ${imageMediaId},
      video_media_id = ${videoMediaId}, updated_at = now()
    where automation_id = ${automationId} and day_of_week = ${dayOfWeek}
  `;
  return true;
}

export async function setAutomationStatus(
  id: string,
  userId: string,
  status: AutomationStatus,
): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update content_automations set status = ${status}, updated_at = now()
    where id = ${id} and user_id = ${userId}
    returning id
  `;
  return rows.length > 0;
}

export async function deleteAutomation(id: string, userId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    delete from content_automations where id = ${id} and user_id = ${userId} returning id
  `;
  return rows.length > 0;
}

/** Duplica a automação inteira (config + 7 dias) — a cópia sempre nasce PAUSADA, mesmo se a original estiver ativa. */
export async function duplicateAutomation(id: string, userId: string, newName: string): Promise<string | null> {
  const original = await getAutomationForUser(id, userId);
  if (!original) return null;

  const newId = await createAutomation({
    userId,
    instagramAccountId: original.instagramAccountId,
    name: newName,
    description: original.description,
    timezone: original.timezone,
    brandContext: original.brandContext,
    autoPublish: original.autoPublish,
    requireApproval: original.requireApproval,
    generationLeadMinutes: original.generationLeadMinutes,
    imageMode: original.imageMode,
    fixedImageMediaId: original.fixedImageMediaId,
    videoSelection: original.videoSelection,
    fixedVideoMediaId: original.fixedVideoMediaId,
  });

  for (const day of original.days) {
    await updateAutomationDay(newId, userId, day.dayOfWeek, {
      enabled: day.enabled,
      contentType: day.contentType,
      prompt: day.prompt,
      publishTime: day.publishTime,
      templateId: day.templateId,
      styleConfig: day.styleConfig,
      imageMediaId: day.imageMediaId,
      videoMediaId: day.videoMediaId,
    });
  }

  return newId;
}

/**
 * Todas as automações ATIVAS com seus 7 dias — usado só pelo cron
 * (content-automation-cron.ts), por isso sem filtro de userId: o cron
 * decide, para CADA automação, se hoje é dia de gerar (no fuso dela) e
 * usa o instagram_account_id/token daquela automação especificamente —
 * nunca mistura conta/token entre automações (seção 34/49 do briefing).
 */
export async function listActiveAutomationsWithDaysForCron(): Promise<AutomationWithDays[]> {
  const db = getDb();
  const automationRows = await db`select * from content_automations where status = 'ACTIVE'`;
  const result: AutomationWithDays[] = [];
  for (const row of automationRows) {
    const automation = mapAutomationRow(row);
    const days = await fetchDays(automation.id);
    result.push({ ...automation, days });
  }
  return result;
}

export async function touchAutomationRunTimestamps(
  id: string,
  lastRunAt: Date,
  nextRunAt: Date | null,
): Promise<void> {
  const db = getDb();
  await db`
    update content_automations set last_run_at = ${lastRunAt.toISOString()}, next_run_at = ${
      nextRunAt ? nextRunAt.toISOString() : null
    }
    where id = ${id}
  `;
}
