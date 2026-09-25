import "server-only";
import { randomUUID, timingSafeEqual } from "node:crypto";
import {
  listActiveAutomationsWithDaysForCron,
  touchAutomationRunTimestamps,
} from "./automation-repository";
import {
  claimRunForGeneration,
  ensureRunForDate,
  markRunFailed,
  markRunGenerated,
} from "./automation-run-repository";
import { zonedToday, publishInstantUtc, isDueForGeneration } from "./automation-time";
import { generatePostContentForRun, generateReelContentForRun } from "./content-generation-service";
import { getInstagramMediaById, type InstagramMediaRecord } from "@/lib/instagram/backend/media-repository";
import { createDraftImagePost, createDraftReelPost } from "@/lib/instagram/backend/instagram-post-repository";
import { renderAndStoreAutomationArt } from "@/lib/instagram/backend/template-render-service";
import type { AutomationDayRecord, AutomationRecord, AutomationRunStatus } from "./automation-types";

/**
 * Cron do Piloto Automático de Conteúdo — SÓ gera conteúdo e cria/agenda a
 * publicação em instagram_posts. NUNCA fala com a Meta: quem publica de
 * verdade continua sendo o agendador já existente
 * (/api/cron/instagram-publish → publishInstagramPublication()). Dois
 * crons separados, uma única camada de publicação — exatamente a
 * arquitetura descrita em docs/content-automation.md.
 *
 * Fluxo por automação ATIVA:
 *   1. Descobre o dia da semana "de hoje" no fuso da automação.
 *   2. Se aquele dia está habilitado e já é hora de gerar (horário de
 *      publicação − generationLeadMinutes), garante a linha de
 *      automation_runs para (automationId, data) — idempotente por
 *      constraint única, nunca gera duas vezes no mesmo dia.
 *   3. Faz o claim atômico da execução (mesma técnica do agendador de
 *      publicação) e gera o conteúdo com a IA.
 *   4. Cria a publicação (DRAFT ou já SCHEDULED, conforme o modo) via
 *      createDraftImagePost/createDraftReelPost — as MESMAS funções
 *      usadas por qualquer outra publicação do Alilu, nunca uma segunda
 *      implementação.
 */

export class ContentAutomationConfigError extends Error {}

export interface ContentAutomationRunResult {
  automationId: string;
  runId: string;
  status: AutomationRunStatus | "SKIPPED";
  error?: string;
}

export interface RunContentAutomationOptions {
  now?: () => Date;
  limit?: number;
  timeBudgetMs?: number;
}

export const DEFAULT_CONTENT_AUTOMATION_LIMIT = 10;
const DEFAULT_TIME_BUDGET_MS = 45_000;

/**
 * Resolve a mídia de imagem a usar para um dia (override do dia > padrão
 * da automação). Valida posse e tipo. Retorna o registro completo (não só
 * o id) porque o modo AUTO_TEMPLATE precisa da storageUrl como imagem de
 * origem para renderizar a arte final (ver template-render-service.ts).
 */
async function resolveImageMediaId(
  automation: AutomationRecord,
  day: AutomationDayRecord,
): Promise<InstagramMediaRecord> {
  const mediaId = day.imageMediaId ?? automation.fixedImageMediaId;
  if (!mediaId) {
    throw new ContentAutomationConfigError(
      "Nenhuma imagem configurada para este dia. Defina uma imagem fixa (da automação ou deste dia específico) antes de ativar.",
    );
  }
  const media = await getInstagramMediaById(mediaId, automation.userId);
  if (!media || media.mediaType !== "image") {
    throw new ContentAutomationConfigError("A imagem configurada para este dia não foi encontrada ou não é uma imagem válida.");
  }
  return media;
}

async function resolveVideoMediaId(
  automation: AutomationRecord,
  day: AutomationDayRecord,
): Promise<string> {
  if (automation.videoSelection !== "FIXED") {
    throw new ContentAutomationConfigError(
      `Seleção de vídeo "${automation.videoSelection}" ainda não está disponível nesta etapa — use "Vídeo fixo".`,
    );
  }
  const mediaId = day.videoMediaId ?? automation.fixedVideoMediaId;
  if (!mediaId) {
    throw new ContentAutomationConfigError(
      "Nenhum vídeo configurado para este dia. Defina um vídeo fixo (da automação ou deste dia específico) antes de ativar.",
    );
  }
  const media = await getInstagramMediaById(mediaId, automation.userId);
  if (!media || media.mediaType !== "video") {
    throw new ContentAutomationConfigError("O vídeo configurado para este dia não foi encontrado ou não é um vídeo válido.");
  }
  return media.id;
}

/**
 * Resolve a legenda final (e, para POST com imageMode = AUTO_TEMPLATE, o
 * texto visual a desenhar sobre a imagem) para o dia: em modo MANUAL, usa
 * `manualCaption`/`visualText` tal como estão — NUNCA chama o provedor de
 * IA (getContentAIProvider), então uma automação com todos os dias em
 * modo manual não exige CONTENT_AI_API_KEY configurada. Em modo AI
 * (padrão), chama o gerador de sempre (content-generation-service.ts),
 * pedindo o texto visual na MESMA chamada quando `needsVisualText` for
 * true — evita duplicar custo de IA por dia. Defesa em profundidade:
 * mesmo validado na ativação (automation-service.ts), confere de novo
 * aqui — mesmo padrão já usado para imageMode/videoSelection nesta função.
 */
async function resolveCaptionForRun(
  automation: AutomationRecord,
  day: AutomationDayRecord,
  runId: string,
  kind: "POST" | "REEL" = "POST",
  needsVisualText = false,
): Promise<{ caption: string; visualText: string | null }> {
  if (day.contentMode === "MANUAL") {
    const manualCaption = day.manualCaption?.trim();
    if (!manualCaption) {
      throw new ContentAutomationConfigError(
        "Modo manual selecionado, mas nenhuma legenda foi escrita para este dia.",
      );
    }
    if (!needsVisualText) return { caption: manualCaption, visualText: null };
    const visualText = day.visualText?.trim();
    if (!visualText) {
      throw new ContentAutomationConfigError(
        "Modo manual selecionado, mas nenhum texto foi escrito para a imagem deste dia.",
      );
    }
    return { caption: manualCaption, visualText };
  }
  if (kind === "REEL") {
    const generated = await generateReelContentForRun(automation, day, runId);
    return { caption: generated.caption, visualText: null };
  }
  const generated = await generatePostContentForRun(automation, day, runId, { includeVisualText: needsVisualText });
  return { caption: generated.caption, visualText: needsVisualText ? (generated.visualText ?? null) : null };
}

/**
 * Gera o conteúdo e cria a publicação. Decide DRAFT (modo aprovação, o
 * padrão) ou já SCHEDULED (modo automático) — mas nunca publica
 * diretamente: SCHEDULED só entra na fila do agendador já existente.
 */
async function generateAndCreatePublication(
  automation: AutomationRecord,
  day: AutomationDayRecord,
  runId: string,
  publishAtUtc: Date,
): Promise<{ publicationId: string; status: Extract<AutomationRunStatus, "WAITING_APPROVAL" | "SCHEDULED"> }> {
  const willAutoPublish = automation.autoPublish && !automation.requireApproval;
  const scheduledAtUtc = willAutoPublish ? publishAtUtc : null;

  if (day.contentType === "POST") {
    const sourceMedia = await resolveImageMediaId(automation, day);
    const needsVisualText = automation.imageMode === "AUTO_TEMPLATE";
    const { caption, visualText } = await resolveCaptionForRun(automation, day, runId, "POST", needsVisualText);

    // Debug (Parte 11 do briefing) — nunca loga tokens/segredos/API keys,
    // só os identificadores e metadados necessários para diagnosticar
    // "dia errado"/"texto não apareceu na imagem" em produção.
    console.info("[content-automation-cron] conteúdo resolvido para a execução", {
      automationId: automation.id,
      automationDayId: day.id,
      runId,
      dayOfWeek: day.dayOfWeek,
      publishDateUtc: publishAtUtc.toISOString(),
      imageMode: automation.imageMode,
      templateId: day.templateId,
      contentMode: day.contentMode,
      visualTextReceived: Boolean(visualText),
      captionReceived: Boolean(caption),
    });

    let mediaId = sourceMedia.id;
    if (needsVisualText) {
      if (!visualText) {
        throw new ContentAutomationConfigError("Não foi possível obter o texto para desenhar sobre a imagem deste dia.");
      }
      mediaId = await renderAndStoreAutomationArt({
        userId: automation.userId,
        templateId: day.templateId,
        styleConfig: day.styleConfig,
        sourceImageUrl: sourceMedia.storageUrl,
        sourceMediaId: sourceMedia.id,
        visualText,
        overlayOpacity: day.overlayOpacity,
        automationRunId: runId,
      });
    }

    const publicationId = await createDraftImagePost({
      userId: automation.userId,
      instagramAccountId: automation.instagramAccountId,
      mediaId,
      caption,
      scheduledAtUtc,
      timezone: automation.timezone,
      source: "AUTOMATION",
    });
    return { publicationId, status: willAutoPublish ? "SCHEDULED" : "WAITING_APPROVAL" };
  }

  // REEL
  const video = await resolveVideoMediaId(automation, day);
  const { caption } = await resolveCaptionForRun(automation, day, runId, "REEL");
  const publicationId = await createDraftReelPost({
    userId: automation.userId,
    instagramAccountId: automation.instagramAccountId,
    mediaId: video,
    caption,
    scheduledAtUtc,
    timezone: automation.timezone,
    source: "AUTOMATION",
  });
  return { publicationId, status: willAutoPublish ? "SCHEDULED" : "WAITING_APPROVAL" };
}

export async function runContentAutomationCron(
  options: RunContentAutomationOptions = {},
): Promise<ContentAutomationRunResult[]> {
  const now = options.now ?? (() => new Date());
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_CONTENT_AUTOMATION_LIMIT, 50));
  const timeBudgetMs = options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const startedAt = Date.now();

  const automations = await listActiveAutomationsWithDaysForCron();
  const results: ContentAutomationRunResult[] = [];

  for (const automation of automations) {
    if (results.length >= limit || Date.now() - startedAt > timeBudgetMs) break;

    const nowDate = now();
    const { date, dayOfWeek } = zonedToday(nowDate, automation.timezone);
    const day = automation.days.find((candidate) => candidate.dayOfWeek === dayOfWeek);
    if (!day || !day.enabled) continue;
    const hasContentSource = day.contentMode === "MANUAL" ? Boolean(day.manualCaption?.trim()) : Boolean(day.prompt.trim());
    if (!hasContentSource) continue;

    const publishAtUtc = publishInstantUtc(date, day.publishTime, automation.timezone);
    if (!isDueForGeneration(nowDate, publishAtUtc, automation.generationLeadMinutes)) continue;

    const run = await ensureRunForDate(automation.id, day.id, automation.instagramAccountId, date);
    if (run.status !== "PENDING" && run.status !== "FAILED") {
      // Já gerado, em geração por outra instância, aguardando aprovação, etc. — nada a fazer.
      continue;
    }

    const lockToken = randomUUID();
    const claimed = await claimRunForGeneration(run.id, lockToken);
    if (!claimed) continue; // outra instância pegou o claim, ou o retry ainda não está pronto.

    try {
      const { publicationId, status } = await generateAndCreatePublication(automation, day, run.id, publishAtUtc);
      await markRunGenerated(run.id, lockToken, publicationId, status);
      results.push({ automationId: automation.id, runId: run.id, status });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida ao gerar conteúdo.";
      const outcome = await markRunFailed(run.id, lockToken, message, now);
      results.push({ automationId: automation.id, runId: run.id, status: outcome.status, error: message });
    }

    await touchAutomationRunTimestamps(automation.id, nowDate, null);
  }

  return results;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Mesmo mecanismo de autorização do agendador de publicação (Bearer
 * CRON_SECRET/INSTAGRAM_SCHEDULER_SECRET, comparação em tempo constante).
 * Reaproveitado — não é um segredo separado, apenas checado de novo aqui
 * para o novo cron continuar exigindo autenticação mesmo sendo uma rota
 * diferente. Um segredo dedicado (CONTENT_AUTOMATION_CRON_SECRET) também
 * é aceito, caso o operador prefira segredos distintos por finalidade.
 */
export function isContentAutomationCronRequestAuthorized(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const provided = header.slice("Bearer ".length).trim();
  if (provided.length < 16) return false;

  const secrets = [
    process.env.CONTENT_AUTOMATION_CRON_SECRET,
    process.env.CRON_SECRET,
    process.env.INSTAGRAM_SCHEDULER_SECRET,
  ].filter((value): value is string => typeof value === "string" && value.length >= 16);
  return secrets.some((secret) => safeEqual(provided, secret));
}
