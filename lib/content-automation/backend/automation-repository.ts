import "server-only";
import { getDb } from "@/lib/db/client";
import { normalizeSmartStoryConfig, type SmartStoryConfig } from "../smart-story/config";
import {
  planScheduleReconciliation,
  type ReconcileRow,
  type SharedScheduleInput,
} from "../shared-schedule";
import {
  DAYS_OF_WEEK,
  MAX_SLOTS_PER_DAY,
  type AutomationContentCategory,
  type AutomationContentMode,
  type AutomationContentType,
  type AutomationDayRecord,
  type AutomationRecord,
  type AutomationScheduleMode,
  type AutomationSharedConfig,
  type AutomationSmartStory,
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
 * por padrão) — o "horário principal" de cada dia (slot_index = 0), que
 * nunca é apagado e é editado com UPDATE. Horários EXTRAS do mesmo dia
 * (slot_index 1, 2, …, migração 0018) são criados/removidos com
 * addAutomationSlot/removeAutomationSlot; a constraint única passa a ser
 * (automation_id, day_of_week, slot_index).
 *
 * Padrão de UPDATE parcial: igual a updatePostContent em
 * instagram-post-repository.ts — lê a linha atual, resolve em JS o que
 * "undefined = mantém" significa para cada campo, e grava um UPDATE só
 * com valores já resolvidos (nunca SQL dinâmico/CASE condicionado a
 * parâmetro).
 */

function parseStyleConfig(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string" && raw.length > 0) {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

function mapSharedConfig(row: Record<string, unknown>): AutomationSharedConfig {
  return {
    contentType: ((row.shared_content_type as AutomationContentType | null) ?? "POST"),
    contentMode: ((row.shared_content_mode as AutomationContentMode | null) ?? "AI"),
    contentCategory: (row.shared_content_category as AutomationContentCategory | null) ?? null,
    prompt: (row.shared_prompt as string | null) ?? "",
    manualCaption: (row.shared_manual_caption as string | null) ?? null,
    visualText: (row.shared_visual_text as string | null) ?? null,
    templateId: (row.shared_template_id as string | null) ?? null,
    styleConfig: parseStyleConfig(row.shared_style_config),
    overlayOpacity:
      row.shared_overlay_opacity === null || row.shared_overlay_opacity === undefined ? null : Number(row.shared_overlay_opacity),
    visualTextColor: (row.shared_visual_text_color as string | null) ?? null,
    imageMediaId: (row.shared_image_media_id as string | null) ?? null,
    videoMediaId: (row.shared_video_media_id as string | null) ?? null,
  };
}

function mapSmartStory(row: Record<string, unknown>): AutomationSmartStory {
  const enabled = row.smart_story_enabled === true;
  return { enabled, config: normalizeSmartStoryConfig(parseStyleConfig(row.smart_story_config), enabled) };
}

function mapAutomationRow(row: Record<string, unknown>): AutomationRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    instagramAccountId: row.instagram_account_id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? "",
    status: row.status as AutomationStatus,
    scheduleMode: ((row.schedule_mode as AutomationScheduleMode | null) ?? "CUSTOM"),
    smartStory: mapSmartStory(row),
    shared: mapSharedConfig(row),
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
    slotIndex: row.slot_index === null || row.slot_index === undefined ? 0 : Number(row.slot_index),
    contentCategory: (row.content_category as AutomationContentCategory | null) ?? null,
    enabled: Boolean(row.enabled),
    contentType: row.content_type as AutomationContentType,
    contentMode: (row.content_mode as AutomationContentMode | null) ?? "AI",
    prompt: (row.prompt as string | null) ?? "",
    manualCaption: (row.manual_caption as string | null) ?? null,
    visualText: (row.visual_text as string | null) ?? null,
    publishTime: row.publish_time as string,
    templateId: (row.template_id as string | null) ?? null,
    styleConfig,
    overlayOpacity: row.overlay_opacity === null || row.overlay_opacity === undefined ? null : Number(row.overlay_opacity),
    visualTextColor: (row.visual_text_color as string | null) ?? null,
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
  /** Ausente = "CUSTOM" (modelo de sempre). */
  scheduleMode?: AutomationScheduleMode;
  /** Conteúdo compartilhado inicial (só faz sentido em "SHARED_PROMPT"). */
  shared?: AutomationSharedConfig;
}

/** Cria a automação PAUSADA (o usuário ativa explicitamente depois de revisar) e as 7 linhas de dia. */
export async function createAutomation(input: CreateAutomationInput): Promise<string> {
  const db = getDb();
  const rows = await db`
    insert into content_automations (
      user_id, instagram_account_id, name, description, status, timezone, brand_context,
      auto_publish, require_approval, generation_lead_minutes, image_mode, fixed_image_media_id,
      video_selection, fixed_video_media_id, schedule_mode
    ) values (
      ${input.userId}, ${input.instagramAccountId}, ${input.name}, ${input.description}, 'PAUSED',
      ${input.timezone}, ${input.brandContext}, ${input.autoPublish}, ${input.requireApproval},
      ${input.generationLeadMinutes}, ${input.imageMode}, ${input.fixedImageMediaId},
      ${input.videoSelection}, ${input.fixedVideoMediaId}, ${input.scheduleMode ?? "CUSTOM"}
    )
    returning id
  `;
  const automationId = rows[0].id as string;
  if (input.shared) await updateSharedConfig(automationId, input.userId, input.shared);

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
    order by array_position(array['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY']::text[], day_of_week),
      slot_index
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
  /** Execuções por semana (linhas dia+horário habilitadas). */
  activeSlotsCount: number;
}

/** Lista para "Minhas automações" — sem carregar os 7 dias de cada uma, só a contagem de dias ativos. */
export async function listAutomationsForUser(userId: string): Promise<AutomationListItem[]> {
  const db = getDb();
  const rows = await db`
    select a.*, coalesce(d.active_days, 0) as active_days_count, coalesce(d.active_slots, 0) as active_slots_count
    from content_automations a
    left join (
      select automation_id, count(distinct day_of_week) filter (where enabled) as active_days,
        count(*) filter (where enabled) as active_slots
      from content_automation_days
      group by automation_id
    ) d on d.automation_id = a.id
    where a.user_id = ${userId}
    order by a.created_at desc
  `;
  return rows.map((row) => ({
    ...mapAutomationRow(row),
    activeDaysCount: Number(row.active_days_count),
    activeSlotsCount: Number(row.active_slots_count),
  }));
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
  contentCategory?: AutomationContentCategory | null;
  contentType?: AutomationContentType;
  contentMode?: AutomationContentMode;
  prompt?: string;
  manualCaption?: string | null;
  visualText?: string | null;
  publishTime?: string;
  templateId?: string | null;
  styleConfig?: Record<string, unknown> | null;
  overlayOpacity?: number | null;
  visualTextColor?: string | null;
  imageMediaId?: string | null;
  videoMediaId?: string | null;
}

/**
 * Qual linha de horário editar: um dia da semana (= o horário PRINCIPAL
 * dele, slot_index 0 — compatível com todo chamador que já existia) ou o
 * id de um horário específico (principal ou extra).
 */
export type AutomationDayRef = DayOfWeek | { slotId: string };

/** Atualiza um horário específico — restrito ao dono via join com content_automations. */
export async function updateAutomationDay(
  automationId: string,
  userId: string,
  dayRef: AutomationDayRef,
  patch: UpdateAutomationDayInput,
): Promise<boolean> {
  const owner = await fetchAutomationRow(automationId, userId);
  if (!owner) return false;

  const db = getDb();
  const currentRows =
    typeof dayRef === "string"
      ? await db`
          select * from content_automation_days
          where automation_id = ${automationId} and day_of_week = ${dayRef} and slot_index = 0
        `
      : await db`
          select * from content_automation_days
          where automation_id = ${automationId} and id = ${dayRef.slotId}
        `;
  const current = currentRows[0];
  if (!current) return false;
  const rowId = current.id as string;

  const enabled = patch.enabled ?? Boolean(current.enabled);
  const contentCategory =
    patch.contentCategory === undefined ? ((current.content_category as AutomationContentCategory | null) ?? null) : patch.contentCategory;
  const contentType = patch.contentType ?? (current.content_type as AutomationContentType);
  const contentMode = patch.contentMode ?? ((current.content_mode as AutomationContentMode | null) ?? "AI");
  const prompt = patch.prompt ?? ((current.prompt as string | null) ?? "");
  const manualCaption = patch.manualCaption === undefined ? ((current.manual_caption as string | null) ?? null) : patch.manualCaption;
  const visualText = patch.visualText === undefined ? ((current.visual_text as string | null) ?? null) : patch.visualText;
  const publishTime = patch.publishTime ?? (current.publish_time as string);
  const templateId = patch.templateId === undefined ? ((current.template_id as string | null) ?? null) : patch.templateId;
  const overlayOpacity =
    patch.overlayOpacity === undefined
      ? (current.overlay_opacity === null || current.overlay_opacity === undefined ? null : Number(current.overlay_opacity))
      : patch.overlayOpacity;
  const visualTextColor =
    patch.visualTextColor === undefined ? ((current.visual_text_color as string | null) ?? null) : patch.visualTextColor;
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
      enabled = ${enabled}, content_category = ${contentCategory}, content_type = ${contentType}, content_mode = ${contentMode},
      prompt = ${prompt}, manual_caption = ${manualCaption}, visual_text = ${visualText}, publish_time = ${publishTime},
      template_id = ${templateId}, style_config = ${styleConfigJson}, overlay_opacity = ${overlayOpacity},
      visual_text_color = ${visualTextColor}, image_media_id = ${imageMediaId},
      video_media_id = ${videoMediaId}, updated_at = now()
    where id = ${rowId} and automation_id = ${automationId}
  `;
  return true;
}

/**
 * Atualiza o conteúdo compartilhado (modo "Prompt único recorrente") —
 * UM único UPDATE, e todas as execuções futuras passam a usar o novo
 * conteúdo (o cron lê esta linha na hora de gerar). undefined = mantém.
 * Se o tipo de conteúdo mudou, espelha só `content_type` nas linhas de
 * dia/horário (o histórico e o painel leem o tipo dali).
 */
export async function updateSharedConfig(
  id: string,
  userId: string,
  patch: Partial<AutomationSharedConfig>,
): Promise<boolean> {
  const row = await fetchAutomationRow(id, userId);
  if (!row) return false;
  const current = mapSharedConfig(row);
  const next: AutomationSharedConfig = {
    contentType: patch.contentType ?? current.contentType,
    contentMode: patch.contentMode ?? current.contentMode,
    contentCategory: patch.contentCategory === undefined ? current.contentCategory : patch.contentCategory,
    prompt: patch.prompt ?? current.prompt,
    manualCaption: patch.manualCaption === undefined ? current.manualCaption : patch.manualCaption,
    visualText: patch.visualText === undefined ? current.visualText : patch.visualText,
    templateId: patch.templateId === undefined ? current.templateId : patch.templateId,
    styleConfig: patch.styleConfig === undefined ? current.styleConfig : patch.styleConfig,
    overlayOpacity: patch.overlayOpacity === undefined ? current.overlayOpacity : patch.overlayOpacity,
    visualTextColor: patch.visualTextColor === undefined ? current.visualTextColor : patch.visualTextColor,
    imageMediaId: patch.imageMediaId === undefined ? current.imageMediaId : patch.imageMediaId,
    videoMediaId: patch.videoMediaId === undefined ? current.videoMediaId : patch.videoMediaId,
  };
  const styleConfigJson = next.styleConfig === null ? null : JSON.stringify(next.styleConfig);

  const db = getDb();
  await db`
    update content_automations set
      shared_content_type = ${next.contentType}, shared_content_mode = ${next.contentMode},
      shared_content_category = ${next.contentCategory}, shared_prompt = ${next.prompt},
      shared_manual_caption = ${next.manualCaption}, shared_visual_text = ${next.visualText},
      shared_template_id = ${next.templateId}, shared_style_config = ${styleConfigJson},
      shared_overlay_opacity = ${next.overlayOpacity}, shared_visual_text_color = ${next.visualTextColor},
      shared_image_media_id = ${next.imageMediaId}, shared_video_media_id = ${next.videoMediaId},
      updated_at = now()
    where id = ${id} and user_id = ${userId}
  `;
  if (next.contentType !== current.contentType && (row.schedule_mode as string) === "SHARED_PROMPT") {
    await db`
      update content_automation_days set content_type = ${next.contentType}, updated_at = now()
      where automation_id = ${id}
    `;
  }
  return true;
}

/**
 * Liga/desliga o modo inteligente de Stories e grava a configuração
 * (já normalizada por quem chama). Um UPDATE só — não toca em dias,
 * horários, execuções nem no conteúdo compartilhado.
 */
export async function updateSmartStoryConfig(
  id: string,
  userId: string,
  next: { enabled: boolean; config: SmartStoryConfig },
): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update content_automations set
      smart_story_enabled = ${next.enabled},
      smart_story_config = ${JSON.stringify(next.config)}::jsonb,
      updated_at = now()
    where id = ${id} and user_id = ${userId}
    returning id
  `;
  return rows.length > 0;
}

/**
 * Troca o modo da agenda. Ao voltar para "CUSTOM", copia o conteúdo
 * compartilhado para as linhas habilitadas — nada que o usuário escreveu
 * se perde. Ao ir para "SHARED_PROMPT" as linhas ficam como estão (só
 * dia/horário/habilitado passam a valer) e o tipo é espelhado nelas.
 * Quem chama garante que a automação não está ATIVA.
 */
export async function setScheduleMode(id: string, userId: string, mode: AutomationScheduleMode): Promise<boolean> {
  const row = await fetchAutomationRow(id, userId);
  if (!row) return false;
  if ((row.schedule_mode as string) === mode) return true;
  const shared = mapSharedConfig(row);
  const db = getDb();
  await db`
    update content_automations set schedule_mode = ${mode}, updated_at = now()
    where id = ${id} and user_id = ${userId}
  `;
  if (mode === "CUSTOM") {
    const styleConfigJson = shared.styleConfig === null ? null : JSON.stringify(shared.styleConfig);
    await db`
      update content_automation_days set
        content_type = ${shared.contentType}, content_mode = ${shared.contentMode},
        content_category = ${shared.contentCategory}, prompt = ${shared.prompt},
        manual_caption = ${shared.manualCaption}, visual_text = ${shared.visualText},
        template_id = ${shared.templateId}, style_config = ${styleConfigJson},
        overlay_opacity = ${shared.overlayOpacity}, visual_text_color = ${shared.visualTextColor},
        image_media_id = ${shared.imageMediaId}, video_media_id = ${shared.videoMediaId},
        updated_at = now()
      where automation_id = ${id} and enabled = true
    `;
  } else {
    await db`
      update content_automation_days set content_type = ${shared.contentType}, updated_at = now()
      where automation_id = ${id}
    `;
  }
  return true;
}

/**
 * Faz as linhas de dia/horário refletirem a agenda do modo compartilhado
 * (dias × horários) — ver planScheduleReconciliation. Nunca apaga linhas
 * (o histórico de execuções depende delas): o que sai da agenda é
 * desabilitado. Devolve o número de execuções por semana, ou null se a
 * automação não for do usuário.
 */
export async function replaceSharedSchedule(
  id: string,
  userId: string,
  schedule: SharedScheduleInput,
): Promise<number | null> {
  const row = await fetchAutomationRow(id, userId);
  if (!row) return null;
  const contentType = mapSharedConfig(row).contentType;

  const db = getDb();
  const dayRows = await db`
    select d.id, d.day_of_week, d.slot_index, d.publish_time, d.enabled,
      exists (select 1 from automation_runs r where r.automation_day_id = d.id) as has_runs
    from content_automation_days d
    where d.automation_id = ${id}
  `;
  const reconcileRows: ReconcileRow[] = dayRows.map((dayRow) => ({
    id: dayRow.id as string,
    dayOfWeek: dayRow.day_of_week as DayOfWeek,
    slotIndex: Number(dayRow.slot_index),
    publishTime: dayRow.publish_time as string,
    enabled: Boolean(dayRow.enabled),
    hasRuns: Boolean(dayRow.has_runs),
  }));

  const plan = planScheduleReconciliation(reconcileRows, schedule);

  for (const rowId of plan.disable) {
    await db`
      update content_automation_days set enabled = false, updated_at = now()
      where id = ${rowId} and automation_id = ${id}
    `;
  }
  for (const item of plan.update) {
    await db`
      update content_automation_days
      set enabled = true, publish_time = ${item.publishTime}, content_type = ${contentType}, updated_at = now()
      where id = ${item.id} and automation_id = ${id}
    `;
  }
  for (const item of plan.insert) {
    await db`
      insert into content_automation_days (automation_id, day_of_week, slot_index, enabled, publish_time, content_type)
      values (${id}, ${item.dayOfWeek}, ${item.slotIndex}, true, ${item.publishTime}, ${contentType})
    `;
  }
  await db`update content_automations set updated_at = now() where id = ${id}`;
  return schedule.days.length * schedule.times.length;
}

export class AutomationSlotLimitError extends Error {}

/**
 * "+ Adicionar horário": cria um horário extra no dia (slot_index =
 * próximo livre), já habilitado e às 12:00 — o usuário ajusta tipo,
 * horário e prompt em seguida. Lança AutomationSlotLimitError se o dia já
 * tem MAX_SLOTS_PER_DAY horários. Devolve null se a automação não for do
 * usuário.
 */
export async function addAutomationSlot(
  automationId: string,
  userId: string,
  dayOfWeek: DayOfWeek,
): Promise<string | null> {
  const owner = await fetchAutomationRow(automationId, userId);
  if (!owner) return null;

  const db = getDb();
  const existing = await db`
    select slot_index from content_automation_days
    where automation_id = ${automationId} and day_of_week = ${dayOfWeek}
  `;
  if (existing.length >= MAX_SLOTS_PER_DAY) {
    throw new AutomationSlotLimitError(`Cada dia pode ter no máximo ${MAX_SLOTS_PER_DAY} horários.`);
  }
  const nextSlot = existing.reduce((max, row) => Math.max(max, Number(row.slot_index)), -1) + 1;
  const rows = await db`
    insert into content_automation_days (automation_id, day_of_week, slot_index, enabled, publish_time)
    values (${automationId}, ${dayOfWeek}, ${nextSlot}, true, '12:00')
    returning id
  `;
  return rows[0].id as string;
}

/**
 * Remove um horário EXTRA (slot_index > 0) — o horário principal do dia
 * nunca é apagado (desabilite-o em vez disso). As publicações já geradas
 * por esse horário continuam no calendário; só o histórico de execuções
 * dele deixa de existir (automation_runs tem "on delete cascade").
 */
export async function removeAutomationSlot(automationId: string, userId: string, slotId: string): Promise<boolean> {
  const owner = await fetchAutomationRow(automationId, userId);
  if (!owner) return false;
  const db = getDb();
  const rows = await db`
    delete from content_automation_days
    where id = ${slotId} and automation_id = ${automationId} and slot_index > 0
    returning id
  `;
  return rows.length > 0;
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

/**
 * Nomes das automações (sem repetir) que usam esta mídia como imagem/vídeo
 * padrão da automação OU como override de algum dia específico — usado
 * pra bloquear a exclusão de mídia em uso (ver media-delete-service.ts)
 * com uma mensagem clara em vez de deixar o dia/automação ficar sem
 * imagem silenciosamente (fixed_image_media_id/image_media_id etc. têm
 * FK "on delete set null" para instagram_media).
 */
export async function listAutomationNamesUsingMedia(mediaId: string, userId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db`
    select distinct name from content_automations
    where user_id = ${userId}
      and (fixed_image_media_id = ${mediaId} or fixed_video_media_id = ${mediaId}
        or shared_image_media_id = ${mediaId} or shared_video_media_id = ${mediaId})
    union
    select distinct ca.name from content_automation_days cad
    join content_automations ca on ca.id = cad.automation_id
    where ca.user_id = ${userId}
      and (cad.image_media_id = ${mediaId} or cad.video_media_id = ${mediaId})
  `;
  return rows.map((row) => row.name as string);
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
    scheduleMode: original.scheduleMode,
    shared: original.shared,
  });
  if (original.smartStory.enabled || Object.keys(original.smartStory.config).length > 0) {
    await updateSmartStoryConfig(newId, userId, original.smartStory);
  }

  for (const day of original.days) {
    let ref: AutomationDayRef = day.dayOfWeek;
    if (day.slotIndex > 0) {
      const slotId = await addAutomationSlot(newId, userId, day.dayOfWeek);
      if (!slotId) continue;
      ref = { slotId };
    }
    await updateAutomationDay(newId, userId, ref, {
      enabled: day.enabled,
      contentCategory: day.contentCategory,
      contentType: day.contentType,
      contentMode: day.contentMode,
      manualCaption: day.manualCaption,
      visualText: day.visualText,
      prompt: day.prompt,
      publishTime: day.publishTime,
      templateId: day.templateId,
      styleConfig: day.styleConfig,
      overlayOpacity: day.overlayOpacity,
      visualTextColor: day.visualTextColor,
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
