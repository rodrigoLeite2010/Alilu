import "server-only";
import { CarouselError, createCarouselProject } from "@/lib/carousel/backend/carousel-project-service";
import { generateCarouselProject, type GenerationDeps } from "@/lib/carousel/backend/carousel-generation-service";
import { publishCarousel, type PublishDeps } from "@/lib/carousel/backend/carousel-publish-service";
import { getProjectByAutomationRun, linkProjectToAutomationRun, listSlides, type CarouselProjectRecord } from "@/lib/carousel/backend/carousel-repository";
import { CONTENT_CATEGORY_LABEL, type AutomationDayRecord, type AutomationRecord, type AutomationRunStatus } from "./automation-types";

/**
 * Carrossel Inteligente dentro do Piloto Automático. NÃO tem pipeline próprio:
 * chama o MESMO CarouselGenerationService (texto → imagens → render) e o MESMO
 * publishCarousel do gerador manual. Só decide tema/categoria, liga o projeto à
 * execução e escolhe rascunho (aprovação) ou agendamento.
 *
 * Idempotência: UNIQUE (automation_run_id) em carousel_projects — a execução
 * (automação + horário) tem no máximo um projeto; um retry reaproveita o projeto
 * e nunca regenera o que já existe. Cota: só a do Carrossel Inteligente
 * (consumida uma vez em publishCarousel → finalizeCarousel); o Piloto
 * (reserveAutomationUse) NÃO é cobrado.
 */
export type SmartCarouselRunDeps = GenerationDeps & PublishDeps;

export interface SmartCarouselRunResult {
  projectId: string;
  publicationId: string;
  status: Extract<AutomationRunStatus, "WAITING_APPROVAL" | "SCHEDULED">;
  warnings: string[];
  reusedProject: boolean;
}

/** Margem mínima para agendar (a Meta/agendador exigem horário futuro). */
const MIN_SCHEDULE_LEAD_MS = 90_000;

export function resolveSmartCarouselTopic(day: Pick<AutomationDayRecord, "prompt" | "contentCategory">): string {
  const prompt = day.prompt.trim();
  if (prompt) return prompt.slice(0, 200);
  if (day.contentCategory) return CONTENT_CATEGORY_LABEL[day.contentCategory];
  throw new Error("Defina o tema ou a categoria do Carrossel Inteligente.");
}

export async function generateSmartCarouselForRun(
  automation: AutomationRecord,
  day: AutomationDayRecord,
  runId: string,
  publishAtUtc: Date,
  deps: SmartCarouselRunDeps = {},
): Promise<SmartCarouselRunResult> {
  const config = automation.smartCarousel;
  const userId = automation.userId;
  const now = deps.now ?? new Date();
  const warnings: string[] = [];

  let project: CarouselProjectRecord | null = await getProjectByAutomationRun(runId);
  const reusedProject = project !== null;
  if (!project) {
    const created = await createCarouselProject({
      userId,
      topic: resolveSmartCarouselTopic(day),
      sourceKind: "AUTOMATION",
      sourceRef: runId,
      niche: day.contentCategory ? CONTENT_CATEGORY_LABEL[day.contentCategory] : null,
      instagramAccountId: automation.instagramAccountId,
      slideCount: config.slideCount,
      includeEndMedia: config.addFinalImage,
      now,
    });
    const linked = await linkProjectToAutomationRun(userId, created.id, { automationId: automation.id, runId, scheduledFor: publishAtUtc });
    if (!linked) {
      // Outra instância criou o projeto desta execução primeiro: usa o dela.
      project = await getProjectByAutomationRun(runId);
      if (!project) throw new CarouselError("INVALID", "Não foi possível vincular o carrossel à execução.");
    } else {
      project = created;
    }
  }

  // Só gera o que ainda não existe: um retry (ex.: falha ao publicar) nunca regenera o texto.
  const slides = await listSlides(project.id);
  if (slides.length === 0) {
    const generated = await generateCarouselProject(
      {
        userId,
        projectId: project.id,
        category: day.contentCategory ? CONTENT_CATEGORY_LABEL[day.contentCategory] : null,
        prompt: day.prompt || null,
        slideCount: config.slideCount,
        templateMode: config.templateMode,
        templateId: config.templateId,
        imageSource: config.imageSource,
        addFinalImage: config.addFinalImage,
        generateCaption: config.generateCaption,
        instagramAccountId: automation.instagramAccountId,
      },
      deps,
    );
    warnings.push(...generated.warnings);
  }

  const willAutoPublish = automation.autoPublish && !automation.requireApproval;
  const minimum = Date.now() + MIN_SCHEDULE_LEAD_MS;
  const scheduleAt = new Date(Math.max(publishAtUtc.getTime(), minimum));
  const published = await publishCarousel(
    userId,
    project.id,
    {
      mode: willAutoPublish ? "SCHEDULE" : "DRAFT",
      scheduledAt: willAutoPublish ? scheduleAt.toISOString() : null,
      timezone: automation.timezone,
      accountId: automation.instagramAccountId,
      source: "AUTOMATION",
    },
    deps,
  );
  if (published.notice) warnings.push(published.notice);

  return {
    projectId: project.id,
    publicationId: published.postId,
    status: willAutoPublish ? "SCHEDULED" : "WAITING_APPROVAL",
    warnings,
    reusedProject,
  };
}
