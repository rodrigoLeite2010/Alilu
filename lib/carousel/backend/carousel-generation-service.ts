/**
 * CarouselGenerationService — o ÚNICO pipeline de geração do Carrossel
 * Inteligente. Tela manual, "Gerar exemplo"/preview, automatizador e
 * regeneração chamam este serviço; ele só COMPÕE as funções que já existem
 * (editorial → fotos → render), sem reimplementar nada:
 *
 *   tema → pesquisa → gancho → roteiro → legenda   (carousel-editorial-service)
 *        → fotos                                    (carousel-studio-service)
 *        → template                                 (project.templateId)
 *        → artes 1080×1350                          (carousel-studio-service)
 *
 * Não publica e NÃO consome cota: a cota do plano só é usada ao concluir
 * (finalizeCarousel/publishCarousel), uma única vez. Cada etapa é idempotente
 * e pode rodar sozinha (`stages`), para o automatizador dividir o trabalho em
 * várias execuções do cron sem estourar o tempo.
 */
import { CAROUSEL_LIMITS } from "../carousel-plans";
import { isCarouselTemplateId } from "../design/templates";
import { generateCarousel, type EditorialDeps, type GenerationTrace } from "./carousel-editorial-service";
import { createCarouselProject, CarouselError, requireProject } from "./carousel-project-service";
import { listSlides, updateProjectFields, type CarouselProjectRecord } from "./carousel-repository";
import { autoAssignPhotos, renderProjectSlides, setProjectTemplate, type AutoPhotoPlan, type AutoPhotoResult, type RenderProjectResult, type StudioDeps } from "./carousel-studio-service";
import type { CarouselSourceKind } from "../domain";

export type CarouselGenerationStage = "TEXT" | "IMAGES" | "RENDER";
export const ALL_GENERATION_STAGES: readonly CarouselGenerationStage[] = ["TEXT", "IMAGES", "RENDER"];

/** "AUTO" = banco de fotos configurado (Pixabay/Pexels); "NONE" = só templates, sem foto. */
export type CarouselImageSource = "AUTO" | "NONE";
/** "AUTO" = escolha automática (por ora, o modelo padrão da marca); "FIXED" = `templateId`. */
export type CarouselTemplateMode = "AUTO" | "FIXED";

export interface GenerateCarouselRequest {
  userId: string;
  /** Reaproveita um projeto existente (regeneração/etapas seguintes). Sem ele, cria um novo. */
  projectId?: string;
  /** Tema do carrossel. Obrigatório quando não há `projectId`. */
  topic?: string;
  /** Categoria/nicho (livre) usada como contexto da IA. */
  category?: string | null;
  /** Instrução extra do usuário/automação (prompt base). */
  prompt?: string | null;
  slideCount?: number;
  templateMode?: CarouselTemplateMode;
  templateId?: string | null;
  imageSource?: CarouselImageSource;
  addFinalImage?: boolean;
  generateCaption?: boolean;
  instagramAccountId?: string | null;
  sourceKind?: CarouselSourceKind;
  sourceRef?: string | null;
  topicId?: string | null;
  /** Temas/ganchos recentes que a IA deve evitar (preenchido pela anti-repetição). */
  avoid?: { topics?: string[]; hooks?: string[] };
  /** Etapas a executar (padrão: todas). */
  stages?: readonly CarouselGenerationStage[];
  /**
   * Diretiva estruturada (Piloto): prompt base + categoria + tema + histórico + regras. Vai em TODAS as etapas
   * (pesquisa, ganchos, roteiro, legenda). Sem ela, o `prompt` do usuário é usado como instrução (editor manual).
   */
  directive?: string | null;
  /** false = o tema NÃO é criação de conteúdo (texto com esse viés é refeito). Padrão: não verifica. */
  allowCreatorTopics?: boolean;
  /** Perfil de marca reduzido (só nome/tom) — usado pelo Piloto. */
  neutralBrand?: boolean;
  /** Quantidade de fotos (entre `target` e `max`); sem isso, vale a regra histórica do editor. */
  photoPlan?: AutoPhotoPlan;
  /** Rastro de diagnóstico preenchido durante a geração. */
  trace?: GenerationTrace;
}

export interface GenerateCarouselResult {
  project: CarouselProjectRecord;
  stagesRun: CarouselGenerationStage[];
  images: AutoPhotoResult | null;
  render: RenderProjectResult | null;
  /** Avisos não bloqueantes (foto que faltou, banco de fotos ausente…). */
  warnings: string[];
}

export type GenerationDeps = EditorialDeps & StudioDeps;

/** Máximo do prompt do usuário repassado à IA (antes eram só 600 caracteres, o que cortava o final do prompt). */
export const USER_PROMPT_MAX = 2500;

function avoidInstruction(prompt: string | null | undefined, avoid: GenerateCarouselRequest["avoid"], hasDirective: boolean): string | null {
  const parts: string[] = [];
  // Com diretiva, o prompt base já está inteiro nela: não duplica.
  if (!hasDirective && prompt?.trim()) parts.push(prompt.trim().slice(0, USER_PROMPT_MAX));
  const topics = (avoid?.topics ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 15);
  const hooks = (avoid?.hooks ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 15);
  if (topics.length) parts.push(`NÃO repita nem reaproveite estes temas já publicados recentemente: ${topics.join(" | ")}.`);
  if (hooks.length) parts.push(`NÃO use ganchos parecidos com estes: ${hooks.join(" | ")}.`);
  return parts.length ? parts.join(" ") : null;
}

function clampSlides(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value)) return undefined;
  return Math.min(CAROUSEL_LIMITS.maxSlides, Math.max(CAROUSEL_LIMITS.minSlides, value));
}

async function ensureProject(request: GenerateCarouselRequest, now: Date): Promise<CarouselProjectRecord> {
  if (request.projectId) return requireProject(request.userId, request.projectId);
  const topic = request.topic?.replace(/\s+/g, " ").trim().slice(0, CAROUSEL_LIMITS.topic);
  if (!topic || topic.length < 3) throw new CarouselError("INVALID", "Informe o tema do carrossel.");
  return createCarouselProject({
    userId: request.userId,
    topic,
    sourceKind: request.sourceKind ?? "TOPIC",
    sourceRef: request.sourceRef ?? null,
    topicId: request.topicId ?? null,
    niche: request.category?.trim().slice(0, 80) || null,
    instagramAccountId: request.instagramAccountId ?? null,
    slideCount: clampSlides(request.slideCount),
    templateId: request.templateMode === "FIXED" && isCarouselTemplateId(request.templateId) ? request.templateId : null,
    includeEndMedia: request.addFinalImage,
    now,
  });
}

/**
 * Executa o pipeline (todas as etapas ou só `stages`) e devolve o projeto.
 * Falha de IA → projeto FAILED e erro (nada incompleto segue adiante).
 * Falha/ausência de foto → o slide sai só com o template (nunca quebra).
 * Falha de render → erro; nada é publicado nem cobrado.
 */
export async function generateCarouselProject(request: GenerateCarouselRequest, deps: GenerationDeps = {}): Promise<GenerateCarouselResult> {
  const now = deps.now ?? new Date();
  const stages = new Set(request.stages ?? ALL_GENERATION_STAGES);
  let project = await ensureProject(request, now);
  const warnings: string[] = [];
  const stagesRun: CarouselGenerationStage[] = [];
  let images: AutoPhotoResult | null = null;
  let render: RenderProjectResult | null = null;

  if (request.templateMode === "FIXED" && isCarouselTemplateId(request.templateId) && project.templateId !== request.templateId) {
    project = await setProjectTemplate(request.userId, project.id, request.templateId);
  }
  if (request.addFinalImage !== undefined && project.includeEndMedia !== request.addFinalImage) {
    project = (await updateProjectFields(request.userId, project.id, { includeEndMedia: request.addFinalImage })) ?? project;
  }

  if (stages.has("TEXT")) {
    // Sem diretiva (editor manual) o prompt do usuário também vai à pesquisa, aos ganchos e à legenda.
    const directive = request.directive ?? (request.prompt?.trim() ? `INSTRUÇÃO DO USUÁRIO: ${request.prompt.trim().slice(0, USER_PROMPT_MAX)}` : null);
    project = await generateCarousel(request.userId, project.id, {
      ...deps,
      now,
      extraInstruction: avoidInstruction(request.prompt, request.avoid, directive != null),
      skipCaption: request.generateCaption === false,
      directive,
      forbidCreatorTopics: request.allowCreatorTopics === false,
      neutralBrand: request.neutralBrand === true,
      trace: request.trace,
    });
    stagesRun.push("TEXT");
  }

  if (stages.has("IMAGES")) {
    if (request.imageSource === "NONE") {
      warnings.push("Imagens desligadas: os slides usam só o modelo visual.");
    } else {
      images = await autoAssignPhotos(request.userId, project.id, deps, request.photoPlan);
      if (!images.providerAvailable) warnings.push("Banco de fotos não configurado: os slides usam só o modelo visual.");
      else if (images.missing.length) warnings.push(`Sem foto nos slides ${images.missing.join(", ")}: usado o modelo visual.`);
    }
    stagesRun.push("IMAGES");
  }

  if (stages.has("RENDER")) {
    if ((await listSlides(project.id)).length === 0) throw new CarouselError("INCOMPLETE", "Gere o roteiro antes de renderizar.");
    render = await renderProjectSlides(request.userId, project.id, deps);
    warnings.push(...render.warnings);
    stagesRun.push("RENDER");
  }

  return { project: await requireProject(request.userId, project.id), stagesRun, images, render, warnings };
}
