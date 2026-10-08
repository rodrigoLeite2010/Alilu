import "server-only";
import { createPhotoProviderFromEnv, type PhotoProvider } from "@/lib/carousel/photos/photo-provider";
import { CAROUSEL_TEMPLATES, isCarouselTemplateId } from "@/lib/carousel/design/templates";
import { useOwnImage as applyOwnImage } from "@/lib/carousel/backend/carousel-studio-service";
import { CarouselError, createCarouselProject } from "@/lib/carousel/backend/carousel-project-service";
import { generateCarouselProject, type GenerationDeps } from "@/lib/carousel/backend/carousel-generation-service";
import { publishCarousel, type PublishDeps } from "@/lib/carousel/backend/carousel-publish-service";
import { getProjectByAutomationRun, linkProjectToAutomationRun, listSlides, mergeProjectGenerationMeta, type CarouselProjectRecord, type CarouselSlideRecord } from "@/lib/carousel/backend/carousel-repository";
import type { GenerationTrace } from "@/lib/carousel/backend/carousel-editorial-service";
import { cachedPhotoProvider } from "@/lib/carousel/photos/photo-cache";
import { targetPhotoCount } from "@/lib/carousel/photos/photo-plan";
import { getCarouselCategory } from "../smart-carousel/categories";
import { buildGenerationDirective } from "../smart-carousel/directive";
import { formatCarouselDiagnostic } from "../smart-carousel/diagnostics";
import { planCarousel, type CarouselPlan } from "../smart-carousel/planner";
import { loadCarouselHistory, type CarouselHistory } from "../smart-carousel/history";
import { findRepeat, imageCombination, pickTemplate, pickTemplateByPreference, pickTheme } from "../smart-carousel/selection";
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

interface PreparedCarousel {
  project: CarouselProjectRecord;
  warnings: string[];
  reusedProject: boolean;
  /** Linha de diagnóstico (categoria, tema, histórico, prompt, modelo, imagens). */
  diagnostic: string | null;
  category: string | null;
}

/** Plano guardado no projeto (um retry reaproveita o MESMO plano). */
function planFromMeta(meta: Record<string, unknown>): CarouselPlan | null {
  const plan = meta.plan;
  if (!plan || typeof plan !== "object") return null;
  const p = plan as Record<string, unknown>;
  const category = typeof p.categoryId === "string" ? getCarouselCategory(p.categoryId) : null;
  if (!category || typeof p.topic !== "string" || typeof p.structureId !== "string" || typeof p.inviteId !== "string") return null;
  return {
    categoryId: category.id,
    categoryLabel: category.label,
    topic: p.topic,
    structureId: p.structureId as CarouselPlan["structureId"],
    structureLabel: typeof p.structureLabel === "string" ? p.structureLabel : "",
    inviteId: p.inviteId as CarouselPlan["inviteId"],
    inviteText: typeof p.inviteText === "string" ? p.inviteText : "",
    relaxed: Array.isArray(p.relaxed) ? (p.relaxed as string[]) : [],
    eligibleCategories: typeof p.eligibleCategories === "number" ? p.eligibleCategories : 0,
  };
}

/**
 * Cria (ou reaproveita) o projeto e gera texto → imagens → artes. SEM publicar e SEM cobrar.
 * `runId = null` = "Gerar exemplo": projeto avulso, não vinculado a execução (não entra no histórico anti-repetição).
 */
async function prepareSmartCarousel(
  automation: AutomationRecord,
  day: AutomationDayRecord,
  runId: string | null,
  publishAtUtc: Date,
  deps: SmartCarouselRunDeps,
): Promise<PreparedCarousel> {
  const config = automation.smartCarousel;
  const userId = automation.userId;
  const now = deps.now ?? new Date();
  const warnings: string[] = [];
  const auto = config.topicSource === "AUTO";
  const legacyLabel = day.contentCategory ? CONTENT_CATEGORY_LABEL[day.contentCategory] : null;
  const historyWindow = Math.max(config.antiRepeatWindow, config.avoidTopicWindow, config.avoidCategoryWindow);

  let project: CarouselProjectRecord | null = runId ? await getProjectByAutomationRun(runId) : null;
  const reusedProject = project !== null;
  let plan: CarouselPlan | null = project ? planFromMeta(project.generationMeta) : null;
  if (!project) {
    const history = await loadCarouselHistory(automation.id, historyWindow);
    const seed = runId ?? `preview-${automation.id}-${now.getTime()}`;
    let topic: string;
    let niche: string | null;
    let templateId: string;
    const available = CAROUSEL_TEMPLATES.map((template) => template.id);
    if (auto) {
      // ETAPA 1 — o Alilu escolhe categoria + tema (+ estrutura e convite) sem repetir o recente.
      plan = planCarousel({ config, history, seed });
      topic = plan.topic;
      niche = plan.categoryLabel;
      const category = getCarouselCategory(plan.categoryId);
      templateId =
        config.templateMode === "FIXED" && isCarouselTemplateId(config.templateId)
          ? config.templateId
          : pickTemplateByPreference({ preferred: category?.templates ?? [], recentTemplateIds: history.templateIds, available });
    } else {
      // Modo antigo (topicSource = PROMPT): o texto do prompt do dia é o tema.
      topic = resolveSmartCarouselTopic(day, history, seed);
      niche = legacyLabel;
      templateId =
        config.templateMode === "FIXED" && isCarouselTemplateId(config.templateId)
          ? config.templateId
          : pickTemplate({ category: day.contentCategory, recentTemplateIds: history.templateIds, available });
    }
    const created = await createCarouselProject({
      userId,
      topic,
      sourceKind: "AUTOMATION",
      sourceRef: runId ?? `preview:${automation.id}`,
      niche,
      instagramAccountId: automation.instagramAccountId,
      slideCount: config.slideCount,
      templateId,
      includeEndMedia: config.addFinalImage,
      now,
    });
    const linked = runId ? await linkProjectToAutomationRun(userId, created.id, { automationId: automation.id, runId, scheduledFor: publishAtUtc }) : true;
    if (!linked && runId) {
      // Outra instância criou o projeto desta execução primeiro: usa o dela.
      project = await getProjectByAutomationRun(runId);
      if (!project) throw new CarouselError("INVALID", "Não foi possível vincular o carrossel à execução.");
      plan = planFromMeta(project.generationMeta);
    } else {
      project = created;
      await mergeProjectGenerationMeta(userId, created.id, {
        schema: 2,
        topicSource: config.topicSource,
        ...(plan
          ? { categoryId: plan.categoryId, category: plan.categoryLabel, structureId: plan.structureId, inviteId: plan.inviteId, plan, allowCreatorTopics: plan.categoryId === "CRIACAO_CONTEUDO" }
          : { category: legacyLabel, allowCreatorTopics: true }),
      });
    }
  }

  // Só gera o que ainda não existe: um retry (ex.: falha ao publicar) nunca regenera o texto.
  let slides = await listSlides(project.id);
  let diagnostic: string | null = typeof project.generationMeta.diagnostic === "string" ? project.generationMeta.diagnostic : null;
  if (slides.length === 0) {
    const history = await loadCarouselHistory(automation.id, historyWindow, project.id);
    const category = plan ? getCarouselCategory(plan.categoryId) : null;
    const basePrompt = day.prompt.trim() || null;
    const textSlides = config.slideCount - (config.addFinalImage ? 1 : 0);
    const wantsPhotos = config.imageSource === "AUTO" || config.imageSource === "COMBINED";
    const photoTarget = wantsPhotos
      ? targetPhotoCount({ density: category?.imageDensity ?? "MID", min: config.minPhotos, max: config.maxPhotos, textSlides })
      : 0;
    const recentTopics = history.topics.slice(0, config.avoidTopicWindow);
    const directive = plan
      ? buildGenerationDirective({
          basePrompt,
          plan,
          recentTopics,
          recentCategories: history.categories.filter((id): id is string => Boolean(id)).map((id) => getCarouselCategory(id)?.label ?? id),
          photos: wantsPhotos && photoTarget > 0 ? { min: Math.min(config.minPhotos, config.maxPhotos), max: config.maxPhotos, target: photoTarget } : null,
        })
      : null;
    const trace: GenerationTrace = { calls: [], creatorBias: [], biasRetries: 0 };
    const base = {
      userId,
      projectId: project.id,
      category: plan?.categoryLabel ?? legacyLabel,
      prompt: day.prompt || null,
      slideCount: config.slideCount,
      templateMode: "FIXED" as const,
      templateId: project.templateId,
      addFinalImage: config.addFinalImage,
      generateCaption: config.generateCaption,
      instagramAccountId: automation.instagramAccountId,
      ...(plan ? { directive, allowCreatorTopics: plan.categoryId === "CRIACAO_CONTEUDO", neutralBrand: true } : {}),
      trace,
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
    if (trace.creatorBias.length > 0) warnings.push(`O texto ainda cita ${trace.creatorBias.join(", ")} apesar de o tema ser outro; revise.`);

    // 2) Imagens: próprias, banco (sem repetir as da janela), combinadas ou nenhuma. Sem foto → só o modelo visual.
    const imageIds: string[] = [];
    const imageQueries: string[] = [];
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
            imageIds.push(`own:${pool[index]}`);
            index += 1;
          } catch {
            index += 1;
            warnings.push(`Imagem própria indisponível no slide ${position}.`);
          }
        }
      }
      if (config.imageSource === "AUTO" || config.imageSource === "COMBINED") {
        const envProvider = deps.photos === undefined ? createPhotoProviderFromEnv() : deps.photos;
        const baseProvider = envProvider && deps.photos === undefined ? cachedPhotoProvider(envProvider) : envProvider;
        const fallbackQuery = category?.scenes[0] ?? (plan?.topic ?? day.prompt) ?? project.topic;
        const provider = baseProvider ? antiRepeatProvider(baseProvider, history.photoIds, fallbackQuery) : baseProvider;
        const withImages = await generateCarouselProject(
          { ...base, stages: ["IMAGES"], imageSource: "AUTO", photoPlan: { target: photoTarget, max: config.maxPhotos, fallbackScenes: category?.scenes } },
          { ...deps, photos: provider },
        );
        warnings.push(...withImages.warnings);
        for (const pick of withImages.images?.picks ?? []) {
          imageIds.push(`${pick.provider}:${pick.id}`);
          imageQueries.push(`${pick.position}=${pick.query}`);
        }
      }
      const combo = imageCombination((await listSlides(project.id)).map(slidePhotoId).filter((id): id is string => Boolean(id)));
      if (combo && history.combinations.has(combo)) warnings.push("A combinação de imagens repete um carrossel recente.");
    }

    // 3) Artes (erro de render interrompe: nada é publicado nem cobrado).
    const rendered = await generateCarouselProject({ ...base, stages: ["RENDER"] }, deps);
    warnings.push(...rendered.warnings);

    // Diagnóstico: o que foi escolhido, o que reuniu de histórico e o que realmente foi enviado.
    const finalSlides = await listSlides(project.id);
    const templatesUsed = new Set(finalSlides.map((slide) => slide.templateId ?? rendered.project.templateId).filter(Boolean));
    diagnostic = formatCarouselDiagnostic({
      category: plan?.categoryLabel ?? legacyLabel,
      topic: project.topic,
      topicSource: config.topicSource,
      recentCategories: history.categories.slice(0, config.avoidCategoryWindow || 3).map((id) => (id ? (getCarouselCategory(id)?.label ?? id) : null)),
      recentTopics: history.topics.slice(0, config.avoidTopicWindow),
      promptSource: basePrompt ? "AutomationSettings" : "Default",
      promptOverride: !basePrompt,
      provider: trace.provider ?? null,
      model: trace.model ?? null,
      finalPromptChars: trace.calls.length ? trace.calls.reduce((sum, call) => sum + call.promptChars, 0) : null,
      creatorBias: trace.creatorBias,
      imagesSelected: finalSlides.filter((slide) => slidePhotoId(slide) || slide.imageMediaId).length,
      imageIds,
      templatesSelected: templatesUsed.size,
      templateId: rendered.project.templateId,
      structure: plan?.structureId ?? null,
      relaxed: plan?.relaxed ?? [],
    });
    console.info(diagnostic);
    await mergeProjectGenerationMeta(userId, project.id, {
      directive,
      diagnostic,
      provider: trace.provider ?? null,
      model: trace.model ?? null,
      aiCalls: trace.calls,
      biasRetries: trace.biasRetries,
      creatorBias: trace.creatorBias,
      imageIds,
      imageQueries,
      photoTarget,
    });
  }

  return { project, warnings, reusedProject, diagnostic, category: plan?.categoryLabel ?? null };
}

export interface SmartCarouselPreviewResult {
  projectId: string;
  warnings: string[];
  /** Categoria escolhida (modo AUTO) e linha de diagnóstico da geração. */
  category: string | null;
  topic: string;
  diagnostic: string | null;
}

/** "Gerar exemplo": gera um carrossel completo para conferir o estilo — não publica, não agenda e não consome a cota. */
export async function generateSmartCarouselPreview(
  automation: AutomationRecord,
  day: AutomationDayRecord,
  deps: SmartCarouselRunDeps = {},
): Promise<SmartCarouselPreviewResult> {
  const prepared = await prepareSmartCarousel(automation, day, null, new Date(), deps);
  return { projectId: prepared.project.id, warnings: prepared.warnings, category: prepared.category, topic: prepared.project.topic, diagnostic: prepared.diagnostic };
}

export async function generateSmartCarouselForRun(
  automation: AutomationRecord,
  day: AutomationDayRecord,
  runId: string,
  publishAtUtc: Date,
  deps: SmartCarouselRunDeps = {},
): Promise<SmartCarouselRunResult> {
  const userId = automation.userId;
  const { project, warnings, reusedProject } = await prepareSmartCarousel(automation, day, runId, publishAtUtc, deps);
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
