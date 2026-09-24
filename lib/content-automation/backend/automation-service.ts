import "server-only";
import { isValidTimeZone } from "@/lib/instagram/schedule-time";
import { isPostTemplateId } from "@/lib/instagram/templates";
import { getInstagramAccountByIdForUser } from "@/lib/instagram/backend/instagram-account-repository";
import { getInstagramMediaById } from "@/lib/instagram/backend/media-repository";
import {
  cancelPost,
  InstagramPostValidationError,
  reschedulePost,
} from "@/lib/instagram/backend/instagram-post-service";
import {
  createAutomation as createAutomationInDb,
  deleteAutomation as deleteAutomationInDb,
  duplicateAutomation as duplicateAutomationInDb,
  getAutomationForUser,
  listAutomationsForUser as listAutomationsForUserInDb,
  setAutomationStatus,
  updateAutomation as updateAutomationInDb,
  updateAutomationDay as updateAutomationDayInDb,
  type AutomationListItem,
  type UpdateAutomationDayInput,
  type UpdateAutomationInput,
} from "./automation-repository";
import {
  cancelPendingRunsForAutomation,
  getRunOwnedByUser,
  listRunsForAutomationOwnedByUser,
  setRunStatus,
} from "./automation-run-repository";
import { publishInstantUtc, zonedToday } from "./automation-time";
import {
  DAYS_OF_WEEK,
  type AutomationContentMode,
  type AutomationContentType,
  type AutomationWithDays,
  type DayOfWeek,
  type ImageMode,
  type VideoSelection,
} from "./automation-types";

/**
 * Validação e regras de negócio do Piloto Automático de Conteúdo — nunca
 * confia em nada vindo do cliente sem checar posse (conta, mídia) e
 * formato, mesmo padrão de instagram-post-service.ts.
 *
 * Restrições desta etapa (ver docs/content-automation.md):
 * imageMode aceita FIXED_IMAGE/MEDIA_LIBRARY/AUTO_TEMPLATE (este último
 * renderiza o texto visual — IA ou manual — sobre a imagem escolhida no
 * servidor, ver template-render-service.ts) e videoSelection só aceita
 * FIXED (ROTATE/RANDOM ficam para uma etapa futura). O schema já reserva
 * os outros valores de videoSelection para não exigir migração quando
 * isso for implementado.
 */

export class AutomationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AutomationValidationError";
  }
}

const SUPPORTED_IMAGE_MODES: ImageMode[] = ["FIXED_IMAGE", "MEDIA_LIBRARY", "AUTO_TEMPLATE"];
const SUPPORTED_VIDEO_SELECTIONS: VideoSelection[] = ["FIXED"];
const MAX_NAME_LENGTH = 120;
const MAX_BRAND_CONTEXT_LENGTH = 2000;
const MAX_PROMPT_LENGTH = 800;
/** Mesmo limite de legenda da Meta usado em todo o resto do projeto (ver instagram-post-service.ts). */
const MAX_MANUAL_CAPTION_LENGTH = 2200;
/** Texto curto desenhado sobre a imagem (modo AUTO_TEMPLATE) — bem menor que a legenda, para não ficar ilegível no template. */
const MAX_VISUAL_TEXT_LENGTH = 120;
const PUBLISH_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function assertName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new AutomationValidationError("Dê um nome para a automação.");
  if (trimmed.length > MAX_NAME_LENGTH) throw new AutomationValidationError(`O nome pode ter no máximo ${MAX_NAME_LENGTH} caracteres.`);
  return trimmed;
}

function assertTimezone(timezone: string): string {
  if (!isValidTimeZone(timezone)) throw new AutomationValidationError("Fuso horário inválido.");
  return timezone;
}

function assertImageMode(imageMode: ImageMode): ImageMode {
  if (!SUPPORTED_IMAGE_MODES.includes(imageMode)) {
    throw new AutomationValidationError('Modo de imagem inválido.');
  }
  return imageMode;
}

function assertVideoSelection(videoSelection: VideoSelection): VideoSelection {
  if (!SUPPORTED_VIDEO_SELECTIONS.includes(videoSelection)) {
    throw new AutomationValidationError('Só "Vídeo fixo" está disponível nesta etapa para Reels.');
  }
  return videoSelection;
}

async function assertOwnedImageMedia(mediaId: string | null, userId: string): Promise<string | null> {
  if (!mediaId) return null;
  const media = await getInstagramMediaById(mediaId, userId);
  if (!media || media.mediaType !== "image") {
    throw new AutomationValidationError("Imagem selecionada não foi encontrada ou não é uma imagem.");
  }
  return media.id;
}

async function assertOwnedVideoMedia(mediaId: string | null, userId: string): Promise<string | null> {
  if (!mediaId) return null;
  const media = await getInstagramMediaById(mediaId, userId);
  if (!media || media.mediaType !== "video") {
    throw new AutomationValidationError("Vídeo selecionado não foi encontrado ou não é um vídeo.");
  }
  return media.id;
}

export interface CreateAutomationServiceInput {
  userId: string;
  instagramAccountId: string;
  name: string;
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
}

export async function createAutomation(input: CreateAutomationServiceInput): Promise<string> {
  const account = await getInstagramAccountByIdForUser(input.instagramAccountId, input.userId);
  if (!account) {
    throw new AutomationValidationError("Conta do Instagram não encontrada ou não conectada por você.");
  }

  const name = assertName(input.name);
  const timezone = assertTimezone(input.timezone ?? "America/Sao_Paulo");
  const imageMode = assertImageMode(input.imageMode ?? "FIXED_IMAGE");
  const videoSelection = assertVideoSelection(input.videoSelection ?? "FIXED");
  const fixedImageMediaId = await assertOwnedImageMedia(input.fixedImageMediaId ?? null, input.userId);
  const fixedVideoMediaId = await assertOwnedVideoMedia(input.fixedVideoMediaId ?? null, input.userId);
  const generationLeadMinutes = Math.max(0, Math.min(1440, input.generationLeadMinutes ?? 120));

  const requireApproval = input.requireApproval ?? true;
  const autoPublish = requireApproval ? false : (input.autoPublish ?? false);

  return createAutomationInDb({
    userId: input.userId,
    instagramAccountId: account.id,
    name,
    description: (input.description ?? "").trim().slice(0, 500),
    timezone,
    brandContext: (input.brandContext ?? "").trim().slice(0, MAX_BRAND_CONTEXT_LENGTH),
    autoPublish,
    requireApproval,
    generationLeadMinutes,
    imageMode,
    fixedImageMediaId,
    videoSelection,
    fixedVideoMediaId,
  });
}

export async function getAutomationDetails(id: string, userId: string): Promise<AutomationWithDays> {
  const automation = await getAutomationForUser(id, userId);
  if (!automation) throw new AutomationValidationError("Automação não encontrada.");
  return automation;
}

export async function listAutomations(userId: string): Promise<AutomationListItem[]> {
  return listAutomationsForUserInDb(userId);
}

export type UpdateAutomationServiceInput = Partial<CreateAutomationServiceInput>;

export async function updateAutomation(
  id: string,
  userId: string,
  input: UpdateAutomationServiceInput,
): Promise<void> {
  const current = await getAutomationDetails(id, userId);

  const patch: UpdateAutomationInput = {};
  if (input.name !== undefined) patch.name = assertName(input.name);
  if (input.description !== undefined) patch.description = input.description.trim().slice(0, 500);
  if (input.timezone !== undefined) patch.timezone = assertTimezone(input.timezone);
  if (input.brandContext !== undefined) patch.brandContext = input.brandContext.trim().slice(0, MAX_BRAND_CONTEXT_LENGTH);
  if (input.generationLeadMinutes !== undefined) patch.generationLeadMinutes = Math.max(0, Math.min(1440, input.generationLeadMinutes));
  if (input.imageMode !== undefined) patch.imageMode = assertImageMode(input.imageMode);
  if (input.videoSelection !== undefined) patch.videoSelection = assertVideoSelection(input.videoSelection);
  if (input.fixedImageMediaId !== undefined) patch.fixedImageMediaId = await assertOwnedImageMedia(input.fixedImageMediaId, userId);
  if (input.fixedVideoMediaId !== undefined) patch.fixedVideoMediaId = await assertOwnedVideoMedia(input.fixedVideoMediaId, userId);
  if (input.instagramAccountId !== undefined) {
    const account = await getInstagramAccountByIdForUser(input.instagramAccountId, userId);
    if (!account) throw new AutomationValidationError("Conta do Instagram não encontrada ou não conectada por você.");
    patch.instagramAccountId = account.id;
  }

  const requireApproval = input.requireApproval ?? current.requireApproval;
  patch.requireApproval = requireApproval;
  patch.autoPublish = requireApproval ? false : (input.autoPublish ?? current.autoPublish);

  const updated = await updateAutomationInDb(id, userId, patch);
  if (!updated) throw new AutomationValidationError("Automação não encontrada.");
}

export interface UpdateDayServiceInput {
  enabled?: boolean;
  contentType?: AutomationContentType;
  contentMode?: AutomationContentMode;
  prompt?: string;
  manualCaption?: string | null;
  /** Texto curto para desenhar sobre a imagem quando imageMode = "AUTO_TEMPLATE" e contentMode = "MANUAL". */
  visualText?: string | null;
  publishTime?: string;
  /** Template do compositor (ver lib/instagram/templates.ts) usado quando imageMode = "AUTO_TEMPLATE". null/ausente usa o template padrão. */
  templateId?: string | null;
  /** Estado serializado do editor (mesmo formato de serializeEditorState) — cores/fontes do template; o texto visual é sempre injetado por cima na hora de renderizar. */
  styleConfig?: Record<string, unknown> | null;
  imageMediaId?: string | null;
  videoMediaId?: string | null;
}

export async function updateAutomationDay(
  automationId: string,
  userId: string,
  dayOfWeek: DayOfWeek,
  input: UpdateDayServiceInput,
): Promise<void> {
  if (!DAYS_OF_WEEK.includes(dayOfWeek)) throw new AutomationValidationError("Dia da semana inválido.");

  const patch: UpdateAutomationDayInput = {};
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (input.contentType !== undefined) patch.contentType = input.contentType;
  if (input.contentMode !== undefined) patch.contentMode = input.contentMode;
  if (input.prompt !== undefined) {
    const trimmed = input.prompt.trim();
    if (trimmed.length > MAX_PROMPT_LENGTH) {
      throw new AutomationValidationError(`O prompt do dia pode ter no máximo ${MAX_PROMPT_LENGTH} caracteres.`);
    }
    patch.prompt = trimmed;
  }
  if (input.manualCaption !== undefined) {
    const trimmed = input.manualCaption === null ? null : input.manualCaption.trim();
    if (trimmed && trimmed.length > MAX_MANUAL_CAPTION_LENGTH) {
      throw new AutomationValidationError(`A legenda manual pode ter no máximo ${MAX_MANUAL_CAPTION_LENGTH} caracteres.`);
    }
    patch.manualCaption = trimmed;
  }
  if (input.visualText !== undefined) {
    const trimmed = input.visualText === null ? null : input.visualText.trim();
    if (trimmed && trimmed.length > MAX_VISUAL_TEXT_LENGTH) {
      throw new AutomationValidationError(`O texto sobre a imagem pode ter no máximo ${MAX_VISUAL_TEXT_LENGTH} caracteres.`);
    }
    patch.visualText = trimmed;
  }
  if (input.templateId !== undefined) {
    if (input.templateId !== null && !isPostTemplateId(input.templateId)) {
      throw new AutomationValidationError("Template inválido.");
    }
    patch.templateId = input.templateId;
  }
  if (input.styleConfig !== undefined) {
    if (input.styleConfig !== null && (typeof input.styleConfig !== "object" || Array.isArray(input.styleConfig))) {
      throw new AutomationValidationError("Configuração de estilo inválida.");
    }
    patch.styleConfig = input.styleConfig;
  }
  if (input.publishTime !== undefined) {
    if (!PUBLISH_TIME_RE.test(input.publishTime)) throw new AutomationValidationError("Horário inválido (use HH:mm).");
    patch.publishTime = input.publishTime;
  }
  if (input.imageMediaId !== undefined) patch.imageMediaId = await assertOwnedImageMedia(input.imageMediaId, userId);
  if (input.videoMediaId !== undefined) patch.videoMediaId = await assertOwnedVideoMedia(input.videoMediaId, userId);

  const updated = await updateAutomationDayInDb(automationId, userId, dayOfWeek, patch);
  if (!updated) throw new AutomationValidationError("Automação ou dia não encontrado.");
}

/**
 * Valida que a automação está pronta para rodar sozinha antes de deixar
 * ativar: todo dia habilitado precisa de prompt e de uma mídia resolvível
 * — evita descobrir isso só quando o cron falhar de madrugada.
 */
function assertReadyToActivate(automation: AutomationWithDays): void {
  const enabledDays = automation.days.filter((day) => day.enabled);
  if (enabledDays.length === 0) {
    throw new AutomationValidationError("Habilite pelo menos um dia da semana antes de ativar.");
  }
  for (const day of enabledDays) {
    if (day.contentMode === "MANUAL") {
      if (!day.manualCaption?.trim()) {
        throw new AutomationValidationError(`Escreva a legenda manual de ${day.dayOfWeek.toLowerCase()} antes de ativar.`);
      }
      if (automation.imageMode === "AUTO_TEMPLATE" && day.contentType === "POST" && !day.visualText?.trim()) {
        throw new AutomationValidationError(`Escreva o texto que vai sobre a imagem de ${day.dayOfWeek.toLowerCase()} antes de ativar.`);
      }
    } else if (!day.prompt.trim()) {
      throw new AutomationValidationError(`Defina o que publicar em ${day.dayOfWeek.toLowerCase()} antes de ativar.`);
    }
    if (day.contentType === "POST") {
      if (!(day.imageMediaId ?? automation.fixedImageMediaId)) {
        throw new AutomationValidationError(`Defina uma imagem para o dia configurado como Post (${day.dayOfWeek.toLowerCase()}).`);
      }
    } else {
      if (!(day.videoMediaId ?? automation.fixedVideoMediaId)) {
        throw new AutomationValidationError(`Defina um vídeo para o dia configurado como Reel (${day.dayOfWeek.toLowerCase()}).`);
      }
    }
  }
}

export async function activateAutomation(id: string, userId: string): Promise<void> {
  const automation = await getAutomationDetails(id, userId);
  assertReadyToActivate(automation);
  const updated = await setAutomationStatus(id, userId, "ACTIVE");
  if (!updated) throw new AutomationValidationError("Automação não encontrada.");
}

export interface PauseOptions {
  cancelScheduledRuns: boolean;
}

export async function pauseAutomation(id: string, userId: string, options: PauseOptions): Promise<void> {
  const automation = await getAutomationDetails(id, userId);
  const updated = await setAutomationStatus(id, userId, "PAUSED");
  if (!updated) throw new AutomationValidationError("Automação não encontrada.");
  if (options.cancelScheduledRuns) {
    await cancelPendingRunsForAutomation(automation.id);
  }
}

export async function archiveAutomation(id: string, userId: string): Promise<void> {
  const updated = await setAutomationStatus(id, userId, "ARCHIVED");
  if (!updated) throw new AutomationValidationError("Automação não encontrada.");
}

export async function deleteAutomation(id: string, userId: string): Promise<void> {
  const deleted = await deleteAutomationInDb(id, userId);
  if (!deleted) throw new AutomationValidationError("Automação não encontrada.");
}

export async function duplicateAutomation(id: string, userId: string): Promise<string> {
  const original = await getAutomationDetails(id, userId);
  const newId = await duplicateAutomationInDb(id, userId, `${original.name} (cópia)`.slice(0, MAX_NAME_LENGTH));
  if (!newId) throw new AutomationValidationError("Automação não encontrada.");
  return newId;
}

export async function listAutomationHistory(automationId: string, userId: string) {
  // Garante posse mesmo que a listagem também filtre por join.
  await getAutomationDetails(automationId, userId);
  return listRunsForAutomationOwnedByUser(automationId, userId);
}

/**
 * Aprova uma execução em WAITING_APPROVAL: agenda a publicação já criada
 * (DRAFT) reaproveitando reschedulePost — o MESMO caminho que "Alterar
 * horário" usa no calendário editorial manual, nunca uma nova rota de
 * publicação. Se o horário original já passou (aprovação tardia), agenda
 * para dali a 2 minutos em vez de rejeitar por estar no passado.
 */
export async function approveAutomationRun(runId: string, userId: string): Promise<void> {
  const run = await getRunOwnedByUser(runId, userId);
  if (!run) throw new AutomationValidationError("Execução não encontrada.");
  if (run.status !== "WAITING_APPROVAL") {
    throw new AutomationValidationError("Esta execução não está aguardando aprovação.");
  }
  if (!run.publicationId) {
    throw new AutomationValidationError("Esta execução não tem uma publicação gerada.");
  }

  const automation = await getAutomationDetails(run.automationId, userId);
  const day = automation.days.find((candidate) => candidate.id === run.automationDayId);
  const originalInstant = day ? publishInstantUtc(run.runDate, day.publishTime, automation.timezone) : new Date();
  const target = originalInstant.getTime() > Date.now() + 30_000 ? originalInstant : new Date(Date.now() + 120_000);

  try {
    await reschedulePost(run.publicationId, userId, target.toISOString(), automation.timezone);
  } catch (error) {
    if (error instanceof InstagramPostValidationError) throw new AutomationValidationError(error.message);
    throw error;
  }
  await setRunStatus(run.id, "SCHEDULED");
}

/** Rejeita uma execução em WAITING_APPROVAL: cancela a publicação gerada (o rascunho continua auditável no histórico). */
export async function rejectAutomationRun(runId: string, userId: string): Promise<void> {
  const run = await getRunOwnedByUser(runId, userId);
  if (!run) throw new AutomationValidationError("Execução não encontrada.");
  if (run.status !== "WAITING_APPROVAL") {
    throw new AutomationValidationError("Esta execução não está aguardando aprovação.");
  }
  if (run.publicationId) {
    try {
      await cancelPost(run.publicationId, userId);
    } catch (error) {
      if (!(error instanceof InstagramPostValidationError)) throw error;
      // Já pode estar cancelado/publicado por outro caminho — segue para marcar o run mesmo assim.
    }
  }
  await setRunStatus(run.id, "CANCELLED");
}

export { zonedToday };
