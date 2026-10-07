import "server-only";
import { createPhotoProviderFromEnv, type PhotoProvider } from "@/lib/carousel/photos/photo-provider";
import { CAROUSEL_TEMPLATES, isCarouselTemplateId } from "@/lib/carousel/design/templates";
import { useOwnImage as applyOwnImage } from "@/lib/carousel/backend/carousel-studio-service";
import { CarouselError, createCarouselProject } from "@/lib/carousel/backend/carousel-project-service";
import { generateCarouselProject, type GenerationDeps } from "@/lib/carousel/backend/carousel-generation-service";
import { publishCarousel, type PublishDeps } from "@/lib/carousel/backend/carousel-publish-service";
import { getProjectByAutomationRun, linkProjectToAutomationRun, listSlides, type CarouselProjectRecord, type CarouselSlideRecord } from "@/lib/carousel/backend/carousel-repository";
import { loadCarouselHistory, type CarouselHistory } from "../smart-carousel/history";
import { findRepeat, imageCombination, pickTemplate, pickTheme } from "../smart-carousel/selection";
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

export function resolveSmartCarouselTopic(day: Pick<AutomationDayRecord, "prompt" | "contentCategory">, history?: Pick<CarouselHistory, "topics">, seed = "", niche?: string | null): string {
  const prompt = day.prompt.trim();
  if (prompt) return prompt.slice(0, 200);
  if (!day.contentCategory && !niche) throw new Error("Defina o tema ou a categoria do Carrossel Inteligente.");
  return pickTheme({ category: day.contentCategory, recentTopics: history?.topics ?? [], seed, niche }).topic;
}

/** Banco de fotos sem repetir as já usadas na janela; sem resultado, tenta a consulta alternativa (tema). */
function antiRepeatProvider(base: PhotoProvider, excluded: ReadonlySet<string>, fallbackQuery: string): PhotoProvider {
  return {
    id: base.id,
    async search(query, options) {
      const limit = Math.max(options?.limit ?? 8, 15);
      let found = (await base.search(query, { limit })).filter((photo) => !excluded.has(photo.id));
      if (found.length === 0 && fallbackQuery && fallbackQuery !== query) {
        found = (await base.search(fallbackQuery, { limit })).filter((photo) => !excluded.has(photo.id));
      }
      return found;
    },
  };
}

function slidePhotoId(slide: CarouselSlideRecord): string | null {
  return ((slide.style.photo as { id?: string } | undefined)?.id) ?? null;
}

/** Primeiro título + quantos títulos repetem algum recente. */
function detectRepetition(slides: CarouselSlideRecord[], history: CarouselHistory): { hook: string | null; headlines: number } {
  const hook = slides[0]?.headline ? findRepeat(slides[0].headline, [...history.hooks, ...history.topics.map((topic) => topic)]) : null;
  const headlines = slides.filter((slide) => slide.headline && findRepeat(slide.headline, history.headlines)).length;
  return { hook: hook ? slides[0].headline : null, headlines };
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
  const categoryLabel = day.contentCategory ? CONTENT_CATEGORY_LABEL[day.contentCategory] : null;

  let project: CarouselProjectRecord | null = await getProjectByAutomationRun(runId);
  const reusedProject = project !== null;
  if (!project) {
    const history = await loadCarouselHistory(automation.id, config.antiRepeatWindow);
    const topic = resolveSmartCarouselTopic(day, history, runId);
    const available = CAROUSEL_TEMPLATES.map((template) => template.id);
    const templateId =
      config.templateMode === "FIXED" && isCarouselTemplateId(config.templateId)
        ? config.templateId
        : pickTemplate({ category: day.contentCategory, recentTemplateIds: history.templateIds, available });
    const created = await createCarouselProject({
      userId,
      topic,
      sourceKind: "AUTOMATION",
      sourceRef: runId,
      niche: categoryLabel,
      instagramAccountId: automation.instagramAccountId,
      slideCount: config.slideCount,
      templateId,
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
  let slides = await listSlides(project.id);
  if (slides.length === 0) {
    const history = await loadCarouselHistory(automation.id, config.antiRepeatWindow, project.id);
    const base = {
      userId,
      projectId: project.id,
      category: categoryLabel,
      prompt: day.prompt || null,
      slideCount: config.slideCount,
      templateMode: "FIXED" as const,
      templateId: project.templateId,
      addFinalImage: config.addFinalImage,
      generateCaption: config.generateCaption,
      instagramAccountId: automation.instagramAccountId,
    };

    // 1) Texto, com anti-repetição (tema, gancho e títulos). Repetiu → uma nova tentativa mais restritiva.
    await generateCarouselProject({ ...base, stages: ["TEXT"], avoid: { topics: history.topics, hooks: history.hooks } }, deps);
    slides = await listSlides(project.id);
    const repeat = detectRepetition(slides, history);
    if (repeat.hook || repeat.headlines >= 2) {
      warnings.push("Texto parecido com um carrossel recente: gerado novamente.");
      await generateCarouselProject(
        { ...base, stages: ["TEXT"], avoid: { topics: history.topics, hooks: [...history.hooks, ...(repeat.hook ? [repeat.hook] : []), ...history.headlines.slice(0, 10)] } },
        deps,
      );
      slides = await listSlides(project.id);
      const again = detectRepetition(slides, history);
      if (again.hook || again.headlines >= 2) warnings.push("O texto ainda lembra um carrossel recente (aceito após uma nova tentativa).");
    }

    // 2) Imagens: próprias, banco (sem repetir as da janela), combinadas ou nenhuma. Sem foto → só o modelo visual.
    if (config.imageSource === "NONE") {
      warnings.push("Imagens desligadas: os slides usam só o modelo visual.");
    } else {
      if (config.imageSource === "OWN" || config.imageSource === "COMBINED") {
        const fresh = config.ownImageMediaIds.filter((id) => !history.ownMediaIds.has(id));
        const pool = fresh.length > 0 ? fresh : config.ownImageMediaIds;
        const positions = slides.map((slide) => slide.position).filter((position) => config.imageSource === "OWN" || position % 2 === 1);
        let index = 0;
        for (const position of positions) {
          if (index >= pool.length) break;
          try {
            await applyOwnImage(userId, project.id, position, pool[index]);
            index += 1;
          } catch {
            index += 1;
            warnings.push(`Imagem própria indisponível no slide ${position}.`);
          }
        }
      }
      if (config.imageSource === "AUTO" || config.imageSource === "COMBINED") {
        const baseProvider = deps.photos === undefined ? createPhotoProviderFromEnv() : deps.photos;
        const provider = baseProvider ? antiRepeatProvider(baseProvider, history.photoIds, day.prompt || categoryLabel || project.topic) : baseProvider;
        const withImages = await generateCarouselProject({ ...base, stages: ["IMAGES"], imageSource: "AUTO" }, { ...deps, photos: provider });
        warnings.push(...withImages.warnings);
      }
      const combo = imageCombination((await listSlides(project.id)).map(slidePhotoId).filter((id): id is string => Boolean(id)));
      if (combo && history.combinations.has(combo)) warnings.push("A combinação de imagens repete um carrossel recente.");
    }

    // 3) Artes (erro de render interrompe: nada é publicado nem cobrado).
    const rendered = await generateCarouselProject({ ...base, stages: ["RENDER"] }, deps);
    warnings.push(...rendered.warnings);
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
  if (warnings.length > 0) console.info("[smart-carousel] avisos", { automationId: automation.id, runId, projectId: project.id, warnings });

  return {
    projectId: project.id,
    publicationId: published.postId,
    status: willAutoPublish ? "SCHEDULED" : "WAITING_APPROVAL",
    warnings,
    reusedProject,
  };
}
